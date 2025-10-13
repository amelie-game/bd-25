import Phaser from "phaser";
import { assets } from "../assets";
import { TILE_SIZE, CHUNK_TILES } from "../constants";
import { GameScene } from "../scenes/GameScene";
import { tileIndex } from "../utils";
import { makeValueNoise2D, mulberry32, pickBiome } from "../proc/gen";

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
  // Data-first representation of tiles (one layer for now)
  private baseTiles: Uint16Array = new Uint16Array(CHUNK_TILES * CHUNK_TILES);
  // Track dirty tile indices for incremental rendering
  private dirty: Set<number> = new Set();
  private initialized = false;

  private seed: number; // per-chunk seed (32-bit)

  constructor(shell: GameScene, seed: number) {
    this.shell = shell;
    this.seed = seed;

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

    this.gfx = this.shell.add.graphics();
    this.gfx.setDepth(10);

    // Populate data array & render
    this.generateIsland(); // now deterministic using seed
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
    const sx = x * TILE_SIZE;
    const sy = y * TILE_SIZE;
    this.gfx.lineStyle(2, 0x00ff00, 0.7);
    this.gfx.fillStyle(0x00ff00, 0.12);
    this.gfx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
    this.gfx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

    // Apply pending dirty tile updates after highlight drawing (if any)
    if (this.dirty.size) this.flushDirty();
  }

  getHighlightTile() {
    return this.highlightTile;
  }

  setHighlightTile(tile: { worldX: number; worldY: number } | null) {
    if (!tile) {
      this.highlightTile = null;
      return;
    }

    // Convert to tile coords. We use the world tile dimensions as a heuristic:
    // tile indices should be within [0, COLUMNS-1] and [0, ROWS-1].
    // If values are outside that range we assume they're pixel coordinates.
    let tx = Math.floor(tile.worldX / TILE_SIZE);
    let ty = Math.floor(tile.worldY / TILE_SIZE);

    // Clamp to valid tile range so drawing can't go off-world.
    tx = Phaser.Math.Clamp(tx, 0, World.COLUMNS - 1);
    ty = Phaser.Math.Clamp(ty, 0, World.ROWS - 1);

    this.highlightTile = { x: tx, y: ty };
  }

  isWalkable(x: number, y: number): boolean {
    // Convert world pixel coords to tile indices
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    if (tx < 0 || ty < 0 || tx >= World.COLUMNS || ty >= World.ROWS)
      return false;
    const idx = tileIndex(tx, ty);
    const tileId = this.baseTiles[idx];
    return tileId !== assets.blocks.sprites.Water; // Non-water walkable for now
  }

  getTileAt(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= World.COLUMNS || ty >= World.ROWS)
      return null;
    const idx = tileIndex(tx, ty);
    const index = this.baseTiles[idx];
    // Emulate Phaser tile object minimally for existing mode logic
    return { index } as Phaser.Tilemaps.Tile; // Future: richer abstraction
  }

  putTileAt(tile: number, tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= World.COLUMNS || ty >= World.ROWS) return;
    const idx = tileIndex(tx, ty);
    if (this.baseTiles[idx] === tile) return; // no change
    this.baseTiles[idx] = tile;
    this.dirty.add(idx);
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
      (window as any).__DEV__ ||
      (typeof navigator !== "undefined" && navigator.webdriver === false)
    ) {
      console.log("[WorldGen] chunk (0,0) biome tile counts", {
        water: waterCount,
        sand: sandCount,
        grass: grassCount,
        brown: brownCount,
        snow: snowCount,
      });
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

  private flushDirty() {
    if (!this.groundLayer || !this.dirty.size) return;
    this.dirty.forEach((idx) => {
      const ty = Math.floor(idx / World.COLUMNS);
      const tx = idx - ty * World.COLUMNS;
      this.groundLayer.putTileAt(this.baseTiles[idx], tx, ty);
    });
    this.dirty.clear();
  }
}
