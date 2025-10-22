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

function getObjects(world: World): Map<number, string> {
  return (world as any).objects as Map<number, string>;
}

describe("Object persistence", () => {
  it("removes collected object from subsequent serialization", () => {
    const seed = hashString32("obj-seed:1:1");
    const w1 = new World(new FakeScene() as any, seed, undefined, 1, 1);
    const objs = getObjects(w1);
    // If no flowers generated (unlikely but possible at low counts), skip test early
    if (objs.size === 0) {
      // Force add a synthetic object for test determinism (inject directly)
      (w1 as any).objects.set(0, "flower_test" as any);
    }
    const firstKey = Array.from(getObjects(w1).keys())[0];
    const firstId = getObjects(w1).get(firstKey)!;
    // Remove object (simulate collection)
    (w1 as any).removeObjectAt?.(
      firstKey % (World as any).COLUMNS,
      Math.floor(firstKey / (World as any).COLUMNS)
    );
    expect(getObjects(w1).has(firstKey)).toBe(false);
    const serialized = (w1 as any).serializeDiff("world-seed", 1, 1);
    const ids = (serialized.objects || []).map((o: any) => o.k);
    // If rock was partially collected and shrunk, its new id will appear; only assert original id absence for non-rock or final removal.
    if (!firstId.startsWith("rock_")) {
      expect(ids).not.toContain(firstId);
    }

    // Apply to fresh world: ensure removed object does not reappear
    const w2 = new World(new FakeScene() as any, seed, undefined, 1, 1);
    if (serialized.objects?.length) {
      (w2 as any).applySerializedObjects(serialized.objects);
    }
    expect(getObjects(w2).has(firstKey)).toBe(false);
  });
});
