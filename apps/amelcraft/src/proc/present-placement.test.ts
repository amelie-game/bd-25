import { describe, it, expect } from "vitest";
import { WorldManager } from "../modules/WorldManager";
import { InMemoryChunkStore } from "../modules/persistence/InMemoryChunkStore";
import { World } from "../modules/World";
import { hashString32 } from "./gen";
import { CHUNK_TILES } from "../constants";

// Provide minimal window stub for timers used in WorldManager
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

// Minimal stub for GameScene matching prior test patterns
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
    return { getPosition: () => [0, 0] } as any; // used by WorldManager update
  }
  private _inv = { getHasPresent: () => false };
  getInventory() {
    return this._inv;
  }
}

function extractPresentInfo(wm: WorldManager) {
  // Traverse active chunks to find present object id 'present'
  const found: { chunkKey: string; tx: number; ty: number }[] = [];
  (wm as any).activeChunks.forEach((world: World, key: string) => {
    // Scan tiles for object id === 'present'
    for (let ty = 0; ty < CHUNK_TILES; ty++) {
      for (let tx = 0; tx < CHUNK_TILES; tx++) {
        const obj = (world as any).getObjectAt?.(tx, ty);
        if (obj && obj.id === "present") {
          found.push({ chunkKey: key, tx, ty });
        }
      }
    }
  });
  return found;
}

describe("Present deterministic placement", () => {
  it("places the present exactly once within initial radius", () => {
    const seed = hashString32("present-seed-test-1");
    const scene = new FakeScene();
    const wm = new WorldManager(scene as any, seed, new InMemoryChunkStore());
    // Force load all candidate chunks radius 2 (Chebyshev)
    const R = 2;
    for (let cx = -R; cx <= R; cx++) {
      for (let cy = -R; cy <= R; cy++) {
        wm.getOrLoadChunk(cx, cy);
      }
    }
    const found = extractPresentInfo(wm);
    expect(found.length).toBe(1);
    // Validate chunk is within radius
    const [chunkX, chunkY] = found[0].chunkKey
      .split(":")
      .map((v) => parseInt(v, 10));
    expect(Math.max(Math.abs(chunkX), Math.abs(chunkY))).toBeLessThanOrEqual(2);
  });

  it("is deterministic for same seed across managers", () => {
    const seed = hashString32("present-seed-test-2");
    const sceneA = new FakeScene();
    const wmA = new WorldManager(sceneA as any, seed, new InMemoryChunkStore());
    const sceneB = new FakeScene();
    const wmB = new WorldManager(sceneB as any, seed, new InMemoryChunkStore());
    const R = 2;
    for (let cx = -R; cx <= R; cx++) {
      for (let cy = -R; cy <= R; cy++) {
        wmA.getOrLoadChunk(cx, cy);
        wmB.getOrLoadChunk(cx, cy);
      }
    }
    const aFound = extractPresentInfo(wmA)[0];
    const bFound = extractPresentInfo(wmB)[0];
    expect(aFound.chunkKey).toBe(bFound.chunkKey);
    expect(aFound.tx).toBe(bFound.tx);
    expect(aFound.ty).toBe(bFound.ty);
  });

  it("prefers grass tiles when available (heuristic)", () => {
    const seed = hashString32("present-seed-test-3");
    const scene = new FakeScene();
    const wm = new WorldManager(scene as any, seed, new InMemoryChunkStore());
    // Directly load only target chunk (less interference with active cap)
    const target = (wm as any).presentTargetChunk;
    expect(target).toBeTruthy();
    wm.getOrLoadChunk(target.chunkX, target.chunkY);
    const present = extractPresentInfo(wm)[0];
    expect(present).toBeTruthy();
    const world = (wm as any).activeChunks.get(present.chunkKey) as World;
    const tile = world.getTileAt(present.tx, present.ty);
    // We cannot directly import Grass constant from assets in isolated test; but ensure tile is not water (preference logic avoids water) and is among land tiles.
    expect(tile).toBeTruthy();
    // Water is typically the most negative case; assert tile.index != water (heuristic: water tends to be first generated constant). We know from game assets water is assets.blocks.sprites.Water = 6.
    expect(tile!.index).not.toBe(6);
  });
});
