import { GameScene } from "../scenes/GameScene";
import { World } from "./World";
import { hashString32 } from "../proc/gen";
import { IChunkStore, chunkStorageKey } from "./persistence/IChunkStore";
import { InMemoryChunkStore } from "./persistence/InMemoryChunkStore";
import { IndexedDBChunkStore } from "./persistence/IndexedDBChunkStore";
import { CHUNK_TILES, CHUNK_PIXELS, TILE_SIZE } from "../constants";
import { chunkKey } from "../utils";

// Phase 2: Initial WorldManager implementation.
// For now this simply owns the existing single World instance and provides
// an abstraction layer that will later expand to multiple chunks.

export class WorldManager {
  private shell: GameScene;
  private seed: string | number;
  private store: IChunkStore;
  // Active loaded chunks keyed by "x:y"
  private activeChunks: Map<string, World> = new Map();
  private dirtyChunks: Set<string> = new Set();
  private saveTimers: Map<string, number> = new Map();
  private saveDelayMs = 500;
  private neighborRadius = 1; // radius in chunks to keep loaded around player
  private highlight: { worldX: number; worldY: number } | null = null;
  private lastPlayerChunk: { x: number; y: number } | null = null;

  constructor(
    shell: GameScene,
    seed: string | number = "local-seed",
    store?: IChunkStore
  ) {
    this.shell = shell;
    this.seed = seed; // stored for future deterministic generation usage
    // Try IndexedDB; if construction fails (older browser / sandbox), fallback to in-memory
    try {
      this.store = store ?? new IndexedDBChunkStore();
    } catch {
      this.store = new InMemoryChunkStore();
    }
  }

  // Get (or create) a chunk
  getOrLoadChunk(chunkX: number, chunkY: number): World {
    const key = chunkKey(chunkX, chunkY);
    let chunk = this.activeChunks.get(key);
    if (chunk) return chunk;
    const chunkSeed = hashString32(`${this.seed}:${chunkX}:${chunkY}`);
    chunk = new World(
      this.shell,
      chunkSeed,
      () => this.onChunkMutate(key),
      chunkX,
      chunkY
    );
    this.activeChunks.set(key, chunk);
    // Load diff async
    this.loadExisting(chunkX, chunkY, chunk).catch((e) =>
      console.warn("Chunk load failed", e)
    );
    return chunk;
  }

  // Legacy access for code still expecting a single world (returns player current chunk or 0,0)
  getPrimaryWorld(): World {
    if (this.lastPlayerChunk) {
      return this.getOrLoadChunk(
        this.lastPlayerChunk.x,
        this.lastPlayerChunk.y
      );
    }
    return this.getOrLoadChunk(0, 0);
  }

  // Global tile coordinate helpers (tile indices across entire infinite grid)
  getTileAtGlobal(globalTileX: number, globalTileY: number) {
    const { chunkX, chunkY, localX, localY } = this.globalTileToChunk(
      globalTileX,
      globalTileY
    );
    const chunk = this.activeChunks.get(chunkKey(chunkX, chunkY));
    if (!chunk) return null;
    return chunk.getTileAt(localX, localY);
  }

  putTileAtGlobal(tile: number, globalTileX: number, globalTileY: number) {
    const { chunkX, chunkY, localX, localY } = this.globalTileToChunk(
      globalTileX,
      globalTileY
    );
    const chunk = this.getOrLoadChunk(chunkX, chunkY);
    chunk.putTileAt(tile, localX, localY);
  }

  isWalkable(x: number, y: number) {
    // x,y are pixel coordinates in global space
    const chunkX = Math.floor(x / CHUNK_PIXELS);
    const chunkY = Math.floor(y / CHUNK_PIXELS);
    const chunk = this.activeChunks.get(chunkKey(chunkX, chunkY));
    if (!chunk) return false; // if not loaded treat as not walkable until loaded (prevents stepping into void)
    return chunk.isWalkable(x, y);
  }

  setHighlightTile(worldX: number, worldY: number) {
    this.highlight = { worldX, worldY };
    // Update highlight across chunks: only owning chunk should show it
    this.activeChunks.forEach((c) => c.setHighlightTile(null));
    const chunkX = Math.floor(worldX / CHUNK_PIXELS);
    const chunkY = Math.floor(worldY / CHUNK_PIXELS);
    const key = chunkKey(chunkX, chunkY);
    const chunk = this.activeChunks.get(key);
    chunk?.setHighlightTile({ worldX, worldY });
  }

  getHighlightTile() {
    // Return highlight in chunk-local coordinates? Existing code expects {x,y} tile indices.
    // We'll attempt to find owning chunk and convert to global tile indices for external use.
    if (!this.highlight) return null;
    const { worldX, worldY } = this.highlight;
    const globalTileX = Math.floor(worldX / TILE_SIZE);
    const globalTileY = Math.floor(worldY / TILE_SIZE);
    return { x: globalTileX, y: globalTileY };
  }

  update(time: number, delta: number) {
    // Determine player location & active chunk
    const player = this.shell.getPlayer?.();
    if (player) {
      const [px, py] = player.getPosition();
      const playerChunkX = Math.floor(px / CHUNK_PIXELS);
      const playerChunkY = Math.floor(py / CHUNK_PIXELS);
      if (
        !this.lastPlayerChunk ||
        this.lastPlayerChunk.x !== playerChunkX ||
        this.lastPlayerChunk.y !== playerChunkY
      ) {
        this.lastPlayerChunk = { x: playerChunkX, y: playerChunkY };
        this.ensureNeighborChunks(playerChunkX, playerChunkY);
        this.unloadFarChunks(playerChunkX, playerChunkY);
      }
    }
    // Update all active chunks
    this.activeChunks.forEach((chunk) => chunk.update(time, delta));
  }

  destroy() {
    // Save & destroy all active chunks
    const promises: Promise<any>[] = [];
    this.activeChunks.forEach((chunk, keyStr) => {
      const { chunkX, chunkY } = chunk.getChunkCoords();
      promises.push(this.saveNow(chunkX, chunkY, chunk));
      chunk.destroy();
    });
    this.activeChunks.clear();
    this.dirtyChunks.clear();
    this.saveTimers.forEach((t) => clearTimeout(t));
    this.saveTimers.clear();
    Promise.all(promises).catch(() => {});
  }

  private globalTileToChunk(globalTileX: number, globalTileY: number) {
    const chunkX = Math.floor(globalTileX / CHUNK_TILES);
    const chunkY = Math.floor(globalTileY / CHUNK_TILES);
    const localX = globalTileX - chunkX * CHUNK_TILES;
    const localY = globalTileY - chunkY * CHUNK_TILES;
    return { chunkX, chunkY, localX, localY };
  }

  private ensureNeighborChunks(centerX: number, centerY: number) {
    for (let dx = -this.neighborRadius; dx <= this.neighborRadius; dx++) {
      for (let dy = -this.neighborRadius; dy <= this.neighborRadius; dy++) {
        this.getOrLoadChunk(centerX + dx, centerY + dy);
      }
    }
  }

  private unloadFarChunks(centerX: number, centerY: number) {
    const toUnload: string[] = [];
    this.activeChunks.forEach((chunk, keyStr) => {
      const { chunkX, chunkY } = chunk.getChunkCoords();
      const dist = Math.max(
        Math.abs(chunkX - centerX),
        Math.abs(chunkY - centerY)
      );
      if (dist > this.neighborRadius) toUnload.push(keyStr);
    });
    toUnload.forEach((keyStr) => {
      const chunk = this.activeChunks.get(keyStr);
      if (!chunk) return;
      const { chunkX, chunkY } = chunk.getChunkCoords();
      // save immediately (best effort) then destroy
      this.saveNow(chunkX, chunkY, chunk).finally(() => {
        chunk.destroy();
        this.activeChunks.delete(keyStr);
      });
    });
  }

  private onChunkMutate(key: string) {
    this.dirtyChunks.add(key);
    if (this.saveTimers.has(key)) return; // already scheduled
    const timer = window.setTimeout(() => {
      this.saveTimers.delete(key);
      if (!this.dirtyChunks.has(key)) return;
      const parts = key.split(":");
      const cx = parseInt(parts[0], 10);
      const cy = parseInt(parts[1], 10);
      const chunk = this.activeChunks.get(key);
      if (chunk) this.saveNow(cx, cy, chunk);
    }, this.saveDelayMs);
    this.saveTimers.set(key, timer);
  }

  private async loadExisting(chunkX: number, chunkY: number, chunk: World) {
    const key = chunkStorageKey(this.seed, chunkX, chunkY);
    const data = await this.store.load(key);
    if (data && data.diff?.length) {
      chunk.applyDiff(data.diff.map((d) => ({ i: d.i, t: d.t })));
    }
  }

  private async saveNow(chunkX: number, chunkY: number, chunk?: World) {
    const keyStr = chunkKey(chunkX, chunkY);
    const c = chunk ?? this.activeChunks.get(keyStr);
    if (!c) return;
    const serialized = c.serializeDiff(this.seed, chunkX, chunkY);
    const storageKey = chunkStorageKey(this.seed, chunkX, chunkY);
    try {
      await this.store.save(storageKey, serialized);
      this.dirtyChunks.delete(keyStr);
      // eslint-disable-next-line no-console
      console.log(
        "[ChunkSave] saved",
        storageKey,
        `diff=${serialized.diff.length}`,
        `active=${this.activeChunks.size}`
      );
    } catch (e) {
      console.warn("Failed to save chunk diff", e);
    }
  }
}
