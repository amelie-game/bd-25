import { describe, it, expect } from "vitest";
import { World } from "../modules/World";
import { hashString32 } from "./gen";

class FakeScene {
  make = {
    tilemap: (_: any) => ({
      addTilesetImage: () => ({ firstgid: 1 }),
      createBlankLayer: () => ({
        setDepth: () => {},
        setPosition: () => {},
        putTileAt: () => {},
      }),
    }),
  };
  add = {
    graphics: () => ({
      setDepth: () => {},
      destroy: () => {},
      clear: () => {},
      lineStyle: () => {},
      fillStyle: () => {},
      strokeRect: () => {},
      fillRect: () => {},
    }),
    image: () => ({
      setDepth: () => {},
      setOrigin: () => {},
      destroy: () => {},
    }),
  };
}

describe("Dirty tile flushing", () => {
  it("respects flushDirty limit", () => {
    const seed = hashString32("flush-seed:0:0");
    const w = new World(new FakeScene() as any, seed, undefined, 0, 0);
    const worldAny = w as any;
    const cols = (World as any).COLUMNS as number;
    // Mutate 50 tiles
    for (let i = 0; i < 50; i++) {
      const tx = i % cols;
      const ty = Math.floor(i / cols);
      worldAny.putTileAt(700 + i, tx, ty);
    }
    const dirtyCountBefore = worldAny.getDirtyCount();
    expect(dirtyCountBefore).toBeGreaterThanOrEqual(50);
    const processed = w.flushDirty(10);
    expect(processed).toBeLessThanOrEqual(10);
    const dirtyAfter = worldAny.getDirtyCount();
    expect(dirtyAfter).toBe(dirtyCountBefore - processed);
  });
});
