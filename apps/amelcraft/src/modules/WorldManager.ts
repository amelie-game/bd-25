import { GameScene } from "../scenes/GameScene";
import { World } from "./World";
import { hashString32 } from "../proc/gen";
import { IChunkStore, chunkStorageKey } from "./persistence/IChunkStore";
import { InMemoryChunkStore } from "./persistence/InMemoryChunkStore";
import { IndexedDBChunkStore } from "./persistence/IndexedDBChunkStore";

// Phase 2: Initial WorldManager implementation.
// For now this simply owns the existing single World instance and provides
// an abstraction layer that will later expand to multiple chunks.

export class WorldManager {
  private shell: GameScene;
  private primaryWorld: World | null = null;
  private seed: string | number;
  private store: IChunkStore;
  private saveScheduled = false;
  private saveDelayMs = 500;
  private worldDirty = false;

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

  // Lazily create (or return) the single world/chunk for now
  getOrLoadChunk(chunkX = 0, chunkY = 0): World {
    // Future: use chunkX, chunkY & seed to load/generate chunk
    if (chunkX !== 0 || chunkY !== 0) {
      // Placeholder: multi-chunk support not implemented yet
      console.warn(
        "WorldManager multi-chunk request (%d,%d) not yet implemented; returning primary world",
        chunkX,
        chunkY
      );
    }
    if (!this.primaryWorld) {
      // Derive a per-chunk seed (for now only 0,0) using a stable hash
      const chunkSeed = hashString32(`${this.seed}:${chunkX}:${chunkY}`);
      this.primaryWorld = new World(this.shell, chunkSeed, () =>
        this.onMutate()
      );
      // Attempt to load persisted diff & apply
      this.loadExisting(chunkX, chunkY).catch((e) =>
        console.warn("Chunk load failed", e)
      );
    }
    return this.primaryWorld;
  }

  getPrimaryWorld(): World {
    return this.getOrLoadChunk(0, 0);
  }

  // Bridge helpers (will later map world pixel coordinates to specific chunks)
  getTileAt(tx: number, ty: number) {
    return this.getPrimaryWorld().getTileAt(tx, ty);
  }
  putTileAt(tile: number, tx: number, ty: number) {
    this.getPrimaryWorld().putTileAt(tile, tx, ty);
  }
  isWalkable(x: number, y: number) {
    return this.getPrimaryWorld().isWalkable(x, y);
  }

  update(time: number, delta: number) {
    // In future: determine active chunk based on player position, load/unload.
    this.primaryWorld?.update(time, delta);
    // Nothing else yet; save scheduling handled via mutation callback
  }

  destroy() {
    if (this.primaryWorld && this.worldDirty) {
      // Fire immediate save on destroy to persist last diff
      this.saveNow(0, 0).finally(() => this.primaryWorld?.destroy());
    } else {
      this.primaryWorld?.destroy();
    }
    this.primaryWorld = null;
  }

  private onMutate() {
    this.worldDirty = true;
    if (!this.saveScheduled) {
      this.saveScheduled = true;
      setTimeout(() => {
        this.saveScheduled = false;
        if (this.worldDirty) this.saveNow(0, 0);
      }, this.saveDelayMs);
    }
  }

  private async loadExisting(chunkX: number, chunkY: number) {
    const key = chunkStorageKey(this.seed, chunkX, chunkY);
    const data = await this.store.load(key);
    if (data && data.diff?.length && this.primaryWorld) {
      this.primaryWorld.applyDiff(data.diff.map((d) => ({ i: d.i, t: d.t })));
    }
  }

  private async saveNow(chunkX: number, chunkY: number) {
    if (!this.primaryWorld) return;
    const serialized = this.primaryWorld.serializeDiff(
      this.seed,
      chunkX,
      chunkY
    );
    const key = chunkStorageKey(this.seed, chunkX, chunkY);
    try {
      await this.store.save(key, serialized);
      this.worldDirty = false;
      // eslint-disable-next-line no-console
      console.log("[ChunkSave] saved", key, `diff=${serialized.diff.length}`);
    } catch (e) {
      console.warn("Failed to save chunk diff", e);
    }
  }
}
