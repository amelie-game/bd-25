import { describe, it, expect } from "vitest";
import { WorldManager } from "../modules/WorldManager";
import { InMemoryChunkStore } from "../modules/persistence/InMemoryChunkStore";
import { CHUNK_TILES, TILE_SIZE } from "../constants";
import { hashString32 } from "./gen";

// Window stub for timers
// @ts-ignore
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    navigator: { userAgent: "test" },
    document: { createElement: () => ({ getContext: () => ({}) }) },
    location: { href: "http://localhost" },
  } as any;
}

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
  getPlayer() {
    return { getPosition: () => [0, 0] } as any;
  }
  private _inv = { getHasPresent: () => false };
  getInventory() {
    return this._inv;
  }
}

describe("Present walkability", () => {
  it("makes tile with present object non-walkable", () => {
    const seed = hashString32("present-walkable-seed");
    const wm = new WorldManager(
      new FakeScene() as any,
      seed,
      new InMemoryChunkStore()
    );
    const target = (wm as any).presentTargetChunk;
    expect(target).toBeTruthy();
    const world = wm.getOrLoadChunk(target.chunkX, target.chunkY);
    // Extract present tile index by scanning objects
    let presentTx = -1,
      presentTy = -1;
    for (let ty = 0; ty < CHUNK_TILES; ty++) {
      for (let tx = 0; tx < CHUNK_TILES; tx++) {
        const obj = (world as any).getObjectAt?.(tx, ty);
        if (obj && obj.id === "present") {
          presentTx = tx;
          presentTy = ty;
          break;
        }
      }
      if (presentTx !== -1) break;
    }
    expect(presentTx).not.toBe(-1);
    // Convert to global pixel coordinates
    const globalX =
      target.chunkX * CHUNK_TILES * TILE_SIZE +
      presentTx * TILE_SIZE +
      TILE_SIZE / 2;
    const globalY =
      target.chunkY * CHUNK_TILES * TILE_SIZE +
      presentTy * TILE_SIZE +
      TILE_SIZE / 2;
    const walkable = wm.isWalkable(globalX, globalY);
    expect(walkable).toBe(false);
  });
});
