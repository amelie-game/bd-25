import { GameScene } from "../scenes/GameScene";
import { World } from "./World";
import { hashString32 } from "../proc/gen";

// Phase 2: Initial WorldManager implementation.
// For now this simply owns the existing single World instance and provides
// an abstraction layer that will later expand to multiple chunks.

export class WorldManager {
  private shell: GameScene;
  private primaryWorld: World | null = null;
  private seed: string | number;

  constructor(shell: GameScene, seed: string | number = "local-seed") {
    this.shell = shell;
    this.seed = seed; // stored for future deterministic generation usage
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
      this.primaryWorld = new World(this.shell, chunkSeed);
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
  }

  destroy() {
    this.primaryWorld?.destroy();
    this.primaryWorld = null;
  }
}
