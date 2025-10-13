import Phaser from "phaser";
import { assets } from "../assets";
import { TILE_SIZE, CHUNK_TILES, CHUNK_PIXELS } from "../constants";
import { GameScene } from "../scenes/GameScene";
import { tileIndex } from "../utils";
import { makeValueNoise2D, mulberry32, pickBiome } from "../proc/gen";
import { SerializedChunkDiffEntry } from "./persistence/IChunkStore";

export class World {
  // For backward compatibility in existing code paths; delegates to chunk constants
  static COLUMNS = CHUNK_TILES;
  static ROWS = CHUNK_TILES;

  private shell: GameScene;
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private dimensions: [width: number, height: number] = [
    World.COLUMNS * TILE_SIZE,
    World.ROWS * TILE_SIZE,
  ];
  private highlightTile: { x: number; y: number } | null = null;
  private gfx: Phaser.GameObjects.Graphics | null = null;
  // Data-first representation of tiles (one layer for now) - current state
  private baseTiles: Uint16Array = new Uint16Array(CHUNK_TILES * CHUNK_TILES);
  // Baseline snapshot (procedurally generated) used for diffing
  private baselineTiles: Uint16Array | null = null;
  // Sparse diff overlay (index -> tileId) relative to baseline
  private overlayDiff: Map<number, number> = new Map();
  // Track dirty tile indices for incremental rendering
  private dirty: Set<number> = new Set();
  private initialized = false;

  private seed: number; // per-chunk seed (32-bit)
  private chunkX: number;
  private chunkY: number;
  private offsetX: number;
  private offsetY: number;

  constructor(
    shell: GameScene,
    seed: number,
    private onMutate?: () => void,
    chunkX = 0,
    chunkY = 0
  ) {
    this.shell = shell;
    this.seed = seed;
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.offsetX = this.chunkX * CHUNK_PIXELS;
    this.offsetY = this.chunkY * CHUNK_PIXELS;

    // --- Tilemap and Tileset ---
    const map = this.shell.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: World.COLUMNS,
      height: World.ROWS,
    });
    if (!map) {
      console.warn("Tilemap creation failed");
      return;
    }

    const tileset = map.addTilesetImage(assets.blocks.key);
    if (!tileset) {
      console.warn("Tileset creation failed for key:", assets.blocks.key);
      return;
    }

    const layer = map.createBlankLayer("ground", tileset);
    if (!layer) {
      console.warn("Tilemap layer creation failed");
      return;
    }

    this.map = map;
    this.groundLayer = layer;
    this.groundLayer.setDepth(0);
    // Position this chunk's layer at its world offset so each chunk draws in correct place
    this.groundLayer.setPosition(this.offsetX, this.offsetY);

    this.gfx = this.shell.add.graphics();
    this.gfx.setDepth(10);

    // Populate data array & render
    this.generateIsland(); // now deterministic using seed
    // Capture baseline snapshot after generation (before player mutations)
    this.baselineTiles = new Uint16Array(this.baseTiles);
    this.flushAll();
    this.initialized = true;
  }

  destroy() {
    if (this.gfx) {
      this.gfx.destroy();
      this.gfx = null;
    }
  }

  update(_time: number, _delta: number) {
    if (!this.gfx) return;
    this.gfx.clear();

    const tile = this.highlightTile;
    if (!tile) return;

    const { x, y } = tile;
    // Apply chunk world offset so highlight draws at correct global position
    const sx = this.offsetX + x * TILE_SIZE;
    const sy = this.offsetY + y * TILE_SIZE;
    this.gfx.lineStyle(2, 0x00ff00, 0.7);
    this.gfx.fillStyle(0x00ff00, 0.12);
    this.gfx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
    this.gfx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

    // Dirty flushing now centrally scheduled by WorldManager (Phase 7)
  }

  getHighlightTile() {
    return this.highlightTile;
  }

  setHighlightTile(tile: { worldX: number; worldY: number } | null) {
    if (!tile) {
      this.highlightTile = null;
      return;
    }
    // Translate global world pixel coords to this chunk's local tile indices
    const localX = tile.worldX - this.offsetX;
    const localY = tile.worldY - this.offsetY;
    const tx = Math.floor(localX / TILE_SIZE);
    const ty = Math.floor(localY / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= World.COLUMNS || ty >= World.ROWS) {
      this.highlightTile = null; // outside this chunk
      return;
    }
    this.highlightTile = { x: tx, y: ty };
  }

  isWalkable(x: number, y: number): boolean {
    // Convert global world pixel coords to local tile indices
    const localX = x - this.offsetX;
    const localY = y - this.offsetY;
    const tx = Math.floor(localX / TILE_SIZE);
    const ty = Math.floor(localY / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= World.COLUMNS || ty >= World.ROWS)
      return false;
    const idx = tileIndex(tx, ty);
    const tileId = this.baseTiles[idx];
    return tileId !== assets.blocks.sprites.Water; // Non-water walkable for now
  }

  getTileAt(tx: number, ty: number) {
    // Chunk-local tile lookup
    if (tx < 0 || ty < 0 || tx >= World.COLUMNS || ty >= World.ROWS)
      return null;
    const idx = tileIndex(tx, ty);
    const index = this.baseTiles[idx];
    return { index } as Phaser.Tilemaps.Tile;
  }

  putTileAt(tile: number, tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= World.COLUMNS || ty >= World.ROWS) return;
    const idx = tileIndex(tx, ty);
    if (this.baseTiles[idx] === tile) return; // no change
    this.baseTiles[idx] = tile;
    this.dirty.add(idx);
    if (this.baselineTiles) {
      const baseline = this.baselineTiles[idx];
      if (tile === baseline) this.overlayDiff.delete(idx);
      else this.overlayDiff.set(idx, tile);
    }
    this.onMutate && this.onMutate();
  }

  getChunkCoords() {
    return { chunkX: this.chunkX, chunkY: this.chunkY };
  }

  getDimensions(): [width: number, height: number] {
    return this.dimensions;
  }

  generateIsland() {
    const GRASS = assets.blocks.sprites.Grass;
    const WATER = assets.blocks.sprites.Water;
    const SAND = assets.blocks.sprites.Yellow;
    const BROWN = assets.blocks.sprites.Brown;
    const SNOW = assets.blocks.sprites.Snow;

    const width = World.COLUMNS;
    const height = World.ROWS;

    // Create deterministic RNG & noise
    const rng = mulberry32(this.seed);
    const elevationNoise = makeValueNoise2D(this.seed ^ 0x9e3779b1);
    const moistureNoise = makeValueNoise2D(this.seed ^ 0x85ebca77);

    // Island mask via radial falloff blended with elevation noise.
    // Enlarged island: slightly increase effective radius & reduce negative bias.
    const cx = width / 2;
    const cy = height / 2;
    const ISLAND_RADIUS_SCALE = 1.08; // >1 expands land area
    const maxRadius = Math.min(cx, cy) * 0.95 * ISLAND_RADIUS_SCALE;

    let waterCount = 0,
      sandCount = 0,
      grassCount = 0,
      brownCount = 0,
      snowCount = 0;
    const shapeFactor = 0.9 + rng() * 0.3; // slight bump so centers are fuller
    const radialPower = 1.15; // lower power flattens curve -> larger island

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const dx = x - cx + 0.5;
        const dy = y - cy + 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const falloff = dist / maxRadius; // 0 center → ~1 edge
        // Radial positive component (higher in center, 0 or negative at edge after subtraction)
        const radial =
          Math.pow(Math.max(0, 1 - falloff), radialPower) * shapeFactor;
        // Sample noises at multiple scales (combined elevation & moisture)
        const e =
          elevationNoise(x * 0.04, y * 0.04) * 0.6 +
          elevationNoise(x * 0.09, y * 0.09) * 0.3 +
          elevationNoise(x * 0.16, y * 0.16) * 0.1;
        const m =
          moistureNoise(x * 0.05, y * 0.05) * 0.7 +
          moistureNoise(x * 0.12, y * 0.12) * 0.3;
        // New elevation formula: combine radial bulge with noise and lighter downward bias
        let elevation = e * 0.5 + radial * 1.05 - 0.15; // expanded land mass
        // Clamp to plausible range
        elevation = Math.max(-1, Math.min(1, elevation));
        const moisture = (m + 1) / 2; // normalize to 0..1
        const biome = pickBiome(elevation, moisture);
        const idx = tileIndex(x, y);
        let tileId: number = WATER; // default ocean
        switch (biome) {
          case "ocean":
            tileId = WATER;
            waterCount++;
            break;
          case "shore":
          case "shore-wet":
            tileId = SAND;
            sandCount++;
            break;
          case "grass":
          case "dry-grass":
            tileId = GRASS;
            grassCount++;
            break;
          case "forest":
          case "scrub":
            tileId = BROWN;
            brownCount++;
            break;
          case "mountain":
          case "mountain-dry":
            tileId = SNOW;
            snowCount++;
            break;
        }
        this.baseTiles[idx] = tileId;
      }
    }

    // Lightweight deterministic stats for debugging variety (only log if devtools open heuristic)
    // eslint-disable-next-line no-console
    if (
      typeof window !== "undefined" &&
      ((window as any).__DEV__ ||
        (typeof navigator !== "undefined" && navigator.webdriver === false))
    ) {
      console.log(
        `[WorldGen] chunk (${this.chunkX},${this.chunkY}) biome tile counts`,
        {
          water: waterCount,
          sand: sandCount,
          grass: grassCount,
          brown: brownCount,
          snow: snowCount,
        }
      );
    }
  }

  // Flush all tiles (initial population)
  private flushAll() {
    if (!this.groundLayer) return;
    for (let y = 0; y < World.ROWS; y++) {
      for (let x = 0; x < World.COLUMNS; x++) {
        const idx = tileIndex(x, y);
        const tileId = this.baseTiles[idx];
        this.groundLayer.putTileAt(tileId, x, y);
      }
    }
  }

  // Flush up to `limit` dirty tiles (if limit omitted, flush all)
  flushDirty(limit?: number): number {
    if (!this.groundLayer || !this.dirty.size) return 0;
    let processed = 0;
    if (limit === undefined) limit = this.dirty.size;
    const toWrite: number[] = [];
    for (const idx of this.dirty) {
      toWrite.push(idx);
      if (toWrite.length >= limit) break;
    }
    for (const idx of toWrite) {
      const ty = Math.floor(idx / World.COLUMNS);
      const tx = idx - ty * World.COLUMNS;
      this.groundLayer.putTileAt(this.baseTiles[idx], tx, ty);
      this.dirty.delete(idx);
      processed++;
    }
    return processed;
  }

  getDirtyCount() {
    return this.dirty.size;
  }

  // Serialize sparse diff for persistence
  serializeDiff(worldSeed: string | number, chunkX: number, chunkY: number) {
    const diff: SerializedChunkDiffEntry[] = [];
    this.overlayDiff.forEach((tileId, i) => diff.push({ i, t: tileId }));
    return {
      version: 0, // real version stamped by store
      worldSeed,
      chunkX,
      chunkY,
      biomeId: null, // placeholder
      diff,
      lastTouched: Date.now(),
    };
  }

  // Apply previously saved diff onto current (assumes baseline already generated)
  applyDiff(entries: SerializedChunkDiffEntry[]) {
    for (const { i, t } of entries) {
      if (i < 0 || i >= this.baseTiles.length) continue;
      this.baseTiles[i] = t;
      this.overlayDiff.set(i, t);
      this.dirty.add(i);
    }
    this.flushDirty();
  }
}
