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
  private dirtyBudgetPerFrame = 800; // max tiles to flush globally per frame (tunable)
  private dirtySpilloverCursor: string | null = null; // remember which chunk to resume with
  // Phase 11: performance & instrumentation metrics
  private metrics = {
    frame: 0,
    chunksLoaded: 0,
    chunksUnloaded: 0,
    savesPerformed: 0,
    dirtyTilesFlushed: 0,
    totalDirtyFlushTimeMs: 0,
    generationTimeMs: 0, // cumulative for last frame's new chunks
    activeChunks: 0,
    avgFlushBatchSize: 0,
  };
  private lastFrameDirtyFlushed = 0;
  private newChunksThisFrame: string[] = [];
  private maxNewChunksPerFrame = 2; // throttle generation bursts
  private maxActiveChunks = 9; // safety cap (e.g., 3x3 around player)

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
    if (this.activeChunks.size >= this.maxActiveChunks) {
      // Always allow ensuring the primary (0,0) chunk exists to avoid recursion
      if (!(chunkX === 0 && chunkY === 0) && this.activeChunks.has("0:0")) {
        // eslint-disable-next-line no-console
        console.warn(
          "[WorldManager] active chunk cap reached; skipping load",
          key
        );
        return this.activeChunks.get("0:0")!;
      }
    }
    // Throttle generation: if we've hit cap, skip creation (will be attempted next frame)
    if (this.newChunksThisFrame.length >= this.maxNewChunksPerFrame) {
      // Defer: return existing 0:0 if present, else proceed if this is 0:0
      if (!(chunkX === 0 && chunkY === 0) && this.activeChunks.has("0:0")) {
        return this.activeChunks.get("0:0")!;
      }
    }
    const startGen = performance.now?.() ?? Date.now();
    const chunkSeed = hashString32(`${this.seed}:${chunkX}:${chunkY}`);
    chunk = new World(
      this.shell,
      chunkSeed,
      () => this.onChunkMutate(key),
      chunkX,
      chunkY
    );
    this.activeChunks.set(key, chunk);
    this.newChunksThisFrame.push(key);
    const endGen = performance.now?.() ?? Date.now();
    this.metrics.generationTimeMs += endGen - startGen;
    this.metrics.chunksLoaded++;
    // Load diff async
    this.loadExisting(chunkX, chunkY, chunk).catch((e) =>
      console.warn("Chunk load failed", e)
    );
    return chunk;
  }

  // Helper to schedule a chunk load on a later frame when throttled
  private getOrLoadChunkDeferred(chunkX: number, chunkY: number): World {
    // Return existing if somehow created concurrently
    const existing = this.activeChunks.get(chunkKey(chunkX, chunkY));
    if (existing) return existing;
    // Create a lightweight placeholder world? For now, just create when called; throttle only prevents multiple bursts per frame
    return this.getOrLoadChunk(chunkX, chunkY);
  }

  private stubChunk: World | null = null;
  private getStubChunk(): World {
    // Retained for API compatibility; now simply return 0:0 if exists, else first active
    if (this.activeChunks.has("0:0")) return this.activeChunks.get("0:0")!;
    const first = this.activeChunks.values().next();
    if (!first.done) return first.value;
    // If no chunks at all yet, force create 0:0 ignoring throttles
    return this.getOrLoadChunk(0, 0);
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
    // Reset per-frame counters
    this.metrics.frame++;
    this.metrics.dirtyTilesFlushed = 0;
    this.metrics.totalDirtyFlushTimeMs = 0;
    this.metrics.generationTimeMs = 0;
    this.newChunksThisFrame = [];
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

    // Phase 7: batched dirty flushing respecting global budget
    this.flushDirtyBatched();
    // Post-update metrics
    this.metrics.activeChunks = this.activeChunks.size;
    if (this.metrics.dirtyTilesFlushed > 0) {
      this.metrics.avgFlushBatchSize =
        this.metrics.dirtyTilesFlushed === 0
          ? 0
          : this.metrics.dirtyTilesFlushed; // single batch approximation
    }
  }

  // Compute pixel bounds spanning all active chunks (for camera clamping)
  getActiveWorldBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    if (this.activeChunks.size === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    this.activeChunks.forEach((chunk) => {
      const { chunkX, chunkY } = chunk.getChunkCoords();
      const x0 = chunkX * CHUNK_PIXELS;
      const y0 = chunkY * CHUNK_PIXELS;
      const x1 = x0 + CHUNK_PIXELS;
      const y1 = y0 + CHUNK_PIXELS;
      if (x0 < minX) minX = x0;
      if (y0 < minY) minY = y0;
      if (x1 > maxX) maxX = x1;
      if (y1 > maxY) maxY = y1;
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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
        this.metrics.chunksUnloaded++;
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
      this.metrics.savesPerformed++;
    } catch (e) {
      console.warn("Failed to save chunk diff", e);
    }
  }

  private flushDirtyBatched() {
    let remaining = this.dirtyBudgetPerFrame;
    if (remaining <= 0 || this.activeChunks.size === 0) return;
    // Stable list of chunk keys for round-robin
    const keys = Array.from(this.activeChunks.keys());
    if (
      !this.dirtySpilloverCursor ||
      !this.activeChunks.has(this.dirtySpilloverCursor)
    ) {
      this.dirtySpilloverCursor = keys[0];
    }
    let startIndex = keys.indexOf(this.dirtySpilloverCursor);
    if (startIndex < 0) startIndex = 0;
    let i = 0;
    while (remaining > 0 && i < keys.length) {
      const key = keys[(startIndex + i) % keys.length];
      const chunk = this.activeChunks.get(key)!;
      const dirtyCount = (chunk as any).getDirtyCount?.() ?? 0;
      if (dirtyCount > 0) {
        const t0 = performance.now?.() ?? Date.now();
        // Budget share heuristic: at least 1, otherwise proportional
        const share = Math.max(
          1,
          Math.ceil((dirtyCount / this.totalDirty()) * this.dirtyBudgetPerFrame)
        );
        const allowance = Math.min(remaining, share);
        const used = (chunk as any).flushDirty?.(allowance) || 0;
        const t1 = performance.now?.() ?? Date.now();
        this.metrics.dirtyTilesFlushed += used;
        this.metrics.totalDirtyFlushTimeMs += t1 - t0;
        remaining -= used;
        if (used > 0) this.dirtySpilloverCursor = key; // continue from here next frame
      }
      i++;
    }
  }

  private totalDirty(): number {
    let total = 0;
    this.activeChunks.forEach((c) => {
      total += (c as any).getDirtyCount?.() ?? 0;
    });
    return total;
  }

  // Public accessor for metrics snapshot
  getMetrics() {
    return { ...this.metrics };
  }
}
