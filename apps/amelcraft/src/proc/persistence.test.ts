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

function accessTiles(world: World): Uint16Array {
  return (world as any).baseTiles as Uint16Array;
}

describe("Persistence diff roundtrip", () => {
  it("applies serialized diff to a fresh world deterministically", () => {
    const seed = hashString32("persist-seed:2:3");
    const w1 = new World(new FakeScene() as any, seed, undefined, 2, 3);
    const tiles1 = accessTiles(w1);
    // Choose indices (spread across array) and new values unlikely to equal baseline
    const indices = [0, Math.floor(tiles1.length / 2), tiles1.length - 1];
    indices.forEach((i, idx) => {
      const tx = i % (World as any).COLUMNS;
      const ty = Math.floor(i / (World as any).COLUMNS);
      (w1 as any).putTileAt(500 + idx, tx, ty);
    });
    const serialized = (w1 as any).serializeDiff("world-seed", 2, 3);
    expect(serialized.diff.length).toBe(indices.length);

    // Fresh world (same seed & coords)
    const w2 = new World(new FakeScene() as any, seed, undefined, 2, 3);
    const tiles2 = accessTiles(w2);
    // Ensure baseline differs before applying diff (very likely)
    const beforeDifferent = indices.some((i, idx) => tiles2[i] !== 500 + idx);
    expect(beforeDifferent).toBe(true);

    (w2 as any).applyDiff(serialized.diff);
    indices.forEach((i, idx) => {
      expect(tiles2[i]).toBe(500 + idx);
    });
  });
});
