import { describe, it, expect } from "vitest";
import { WorldManager } from "../modules/WorldManager";
import { assets } from "../assets";
import { InMemoryChunkStore } from "../modules/persistence/InMemoryChunkStore";
import { Inventory } from "../modules/Inventory";
import { hashString32 } from "./gen";

// Window stub (similar to other tests)
// @ts-ignore
if (typeof (globalThis as any).window === "undefined") {
  const wnd: any = {
    navigator: { userAgent: "test" },
    document: { createElement: () => ({ getContext: () => ({}) }) },
    location: { href: "http://localhost" },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
  };
  (globalThis as any).window = wnd;
}

class FakeScene {
  add = {
    image: () => ({
      setDepth: () => {},
      setOrigin: () => {},
      destroy: () => {},
    }),
    graphics: () => ({
      setDepth: () => {},
      destroy: () => {},
      clear: () => {},
      lineStyle: () => {},
      strokeRect: () => {},
      fillStyle: () => {},
      fillRect: () => {},
    }),
  } as any;
  make = {
    tilemap: (_opts: any) => ({
      addTilesetImage: () => ({ firstgid: 1 }),
      createBlankLayer: () => ({
        setDepth: () => {},
        setPosition: () => {},
        putTileAt: () => {},
      }),
    }),
  } as any;
  getHud() {
    return { update: () => {} };
  }
  private inv: Inventory | null = null;
  setInventory(inv: Inventory) {
    this.inv = inv;
  }
  getInventory() {
    return this.inv!;
  }
}

describe("Present collection", () => {
  it("collects present only once and sets inventory flag", () => {
    const seed = hashString32("present-test-seed");
    const scene = new FakeScene();
    const wm = new WorldManager(scene as any, seed, new InMemoryChunkStore());
    const inv = new Inventory({ stackSize: 5, slotSize: 5 });
    scene.setInventory(inv);
    const world = wm.getOrLoadChunk(0, 0);
    // Manually place present at 2,2
    const placed = (world as any).addObject?.(
      (assets.objects.sprites as any).Present,
      2,
      2
    );
    expect(placed).toBe(true);
    const globalTileX = 2; // chunkX 0
    const globalTileY = 2; // chunkY 0
    expect(inv.getHasPresent()).toBe(false);
    const objBefore = wm.getObjectAtGlobal(globalTileX, globalTileY);
    expect(objBefore).toBeTruthy();
    const changed = inv.obtainPresent();
    expect(changed).toBe(true);
    const removed = wm.removeObjectAtGlobal(globalTileX, globalTileY);
    expect(removed).toBe(true);
    expect(inv.getHasPresent()).toBe(true);
    const changedAgain = inv.obtainPresent();
    expect(changedAgain).toBe(false);
    const objAfter = wm.getObjectAtGlobal(globalTileX, globalTileY);
    expect(objAfter).toBeNull();
  });
});
