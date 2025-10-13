import { describe, it, expect } from "vitest";
import { WorldManager } from "../modules/WorldManager";
import { InMemoryChunkStore } from "../modules/persistence/InMemoryChunkStore";

class FakeScene {
  getPlayer() {
    return { getPosition: () => [0, 0] as [number, number] };
  }
  make: any = {
    tilemap: () => ({
      addTilesetImage: () => ({ firstgid: 1 }),
      createBlankLayer: () => ({
        setDepth: () => {},
        setPosition: () => {},
        putTileAt: () => {},
      }),
    }),
  };
  add: any = {
    graphics: () => ({
      setDepth: () => {},
      destroy: () => {},
      clear: () => {},
      lineStyle: () => {},
      fillStyle: () => {},
      strokeRect: () => {},
      fillRect: () => {},
    }),
  };
  input: any = { keyboard: { addKey: () => ({ on: () => {} }) } };
}

describe("WorldManager metrics", () => {
  it("exposes metrics object with expected keys", () => {
    const wm = new WorldManager(
      new FakeScene() as any,
      "seed",
      new InMemoryChunkStore()
    );
    const m = wm.getMetrics();
    const keys = [
      "frame",
      "chunksLoaded",
      "chunksUnloaded",
      "savesPerformed",
      "dirtyTilesFlushed",
      "totalDirtyFlushTimeMs",
      "generationTimeMs",
      "activeChunks",
      "avgFlushBatchSize",
    ];
    keys.forEach((k) => expect(m).toHaveProperty(k));
  });
});
