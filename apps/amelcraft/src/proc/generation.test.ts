import { describe, it, expect } from "vitest";
import { World } from "../modules/World";
import { hashString32 } from "./gen";

// Lightweight fake GameScene providing minimal API used by World constructor
class FakeScene {
  // Provide stubs for methods used
  make = {
    tilemap: ({ tileWidth, tileHeight, width, height }: any) => {
      return {
        addTilesetImage: () => ({ firstgid: 1 }),
        createBlankLayer: () => ({
          setDepth: () => {},
          setPosition: () => {},
          putTileAt: () => {},
        }),
      } as any;
    },
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

function snapshotTiles(world: World) {
  // Access private via cast for test; acceptable in internal tests
  const anyWorld = world as any;
  const arr: Uint16Array = anyWorld.baseTiles;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < arr.length; i++) {
    h ^= arr[i];
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

describe("World generation determinism", () => {
  it("produces identical base tiles for same seed & chunk coords", () => {
    const seed = hashString32("test-seed:0:0");
    const scene1 = new FakeScene();
    const scene2 = new FakeScene();
    const w1 = new World(scene1 as any, seed, undefined, 0, 0);
    const w2 = new World(scene2 as any, seed, undefined, 0, 0);
    const hash1 = snapshotTiles(w1);
    const hash2 = snapshotTiles(w2);
    expect(hash1).toBe(hash2);
  });
});
