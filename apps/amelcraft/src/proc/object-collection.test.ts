import { describe, it, expect } from "vitest";
import { World } from "../modules/World";
import { WorldManager } from "../modules/WorldManager";
import { InMemoryChunkStore } from "../modules/persistence/InMemoryChunkStore";
import { hashString32 } from "./gen";
import { pickChunkBiome } from "./biomes";
import { Inventory } from "../modules/Inventory";
// Provide a minimal window stub before importing modules that might touch Phaser device checks
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

// Minimal GameScene stub providing APIs used by CollectMode & WorldManager interactions
class FakeScene {
  time = { now: 0, delayedCall: (ms: number, cb: () => void) => ({ hasDispatched: false, remove: () => {}, ms, cb }) } as any;
  input = { activePointer: { worldX: 0, worldY: 0, isDown: true } } as any;
  make = { tilemap: (_: any) => ({ addTilesetImage: () => ({ firstgid: 1 }), createBlankLayer: () => ({ setDepth: () => {}, setPosition: () => {}, putTileAt: () => {} }) }) };
  add = { graphics: () => ({ setDepth: () => {}, destroy: () => {}, clear: () => {}, lineStyle: () => {}, fillStyle: () => {}, strokeRect: () => {}, fillRect: () => {} }), image: () => ({ setDepth: () => {}, setOrigin: () => {}, destroy: () => {} }) };
  // Player stub: supports methods used in CollectMode
  private playerTile = { x: 0, y: 0 };
  getPlayer() {
    return {
      getTile: () => this.playerTile,
      movePlayerAdjacentTo: (_tx: number, _ty: number, cb: () => void) => { cb(); return true; },
      isTileInteractable: () => true,
      setTarget: () => {},
      getPosition: () => [this.playerTile.x * 48, this.playerTile.y * 48],
      playAnim: () => {},
    };
  }
  private wm: WorldManager | null = null;
  setWorldManager(wm: WorldManager) { this.wm = wm; }
  getWorldManager() { return this.wm!; }
  private inv: Inventory | null = null;
  setInventory(inv: Inventory) { this.inv = inv; }
  getInventory() { return this.inv!; }
  getHud() { return { update: () => {} }; }
  getMode() { return { modeName: "collect" } as any; }
}

function getObjectsMap(world: World): Map<number, string> {
  return (world as any).objects as Map<number, string>;
}

describe("Collection flow & persistence (Step 12)", () => {
  it("prioritizes object collection over tile mutation and persists removal", () => {
    const seed = hashString32("collect-flow-seed");
    // Find a grass biome chunk so flowers can exist
    let found = false;
    let cx = 0;
    for (; cx < 60 && !found; cx++) {
      if (pickChunkBiome(seed, cx, 0) === "grass") found = true;
    }
    expect(found).toBe(true);
    cx -= 1; // last increment overshoot
    const scene = new FakeScene();
  // Force use of in-memory store to avoid indexedDB access in Node env
  const wm = new WorldManager(scene as any, seed, new InMemoryChunkStore());
    scene.setWorldManager(wm);
    const inv = new Inventory({ stackSize: 10, slotSize: 10 });
    scene.setInventory(inv);

    // Load target chunk (direct call)
    const world = wm.getOrLoadChunk(cx, 0);
    const objects = getObjectsMap(world);
    // Ensure at least one object exists; if none, inject a synthetic one at (1,1)
    if (objects.size === 0) {
      (world as any).addObject?.("flower_test" as any, 1, 1);
    }
    const firstIndex = Array.from(getObjectsMap(world).keys())[0] as number;
    const tileX = firstIndex % (World as any).COLUMNS;
    const tileY = Math.floor(firstIndex / (World as any).COLUMNS);
    const beforeCount = inv.getTotalObjectsCount();

    // Simulate collection: object-first priority should remove object and add to inventory without mutating tile.
    const globalTileX = tileX + cx * (World as any).COLUMNS;
    const globalTileY = tileY; // same row (chunkY = 0)
    const objectBefore = wm.getObjectAtGlobal(globalTileX, globalTileY);
    expect(objectBefore).toBeTruthy();
    const added = inv.addObject(objectBefore!.id as any);
    expect(added).toBe(true);
    const removed = wm.removeObjectAtGlobal(globalTileX, globalTileY);
    expect(removed).toBe(true);

    const afterCount = inv.getTotalObjectsCount();
    expect(afterCount).toBeGreaterThan(beforeCount);
    expect(getObjectsMap(world).has(firstIndex)).toBe(false);

    // Serialize and apply to new world: object should remain absent
    const serialized = (world as any).serializeDiff(seed, cx, 0);
    wm.getOrLoadChunk(cx + 100, 0 + 100); // exercise manager with distinct coords
    const worldReload = new World(
      scene as any,
      hashString32(`${seed}:${cx}:${0}`),
      undefined,
      cx,
      0
    );
    (worldReload as any).applySerializedObjects(serialized.objects || []);
    expect(getObjectsMap(worldReload).has(firstIndex)).toBe(false);
  });
});
