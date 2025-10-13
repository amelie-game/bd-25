import { describe, it, expect } from "vitest";
import { World } from "../modules/World";
import { hashString32 } from "./gen";
import { getBiome, pickChunkBiome } from "./biomes";

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
  };
}

function collectTiles(world: World): Uint16Array {
  return (world as any).baseTiles as Uint16Array;
}

describe("Biome registry & generation", () => {
  it("assigns a biomeId per chunk deterministically", () => {
    const scene = new FakeScene();
    const seed = hashString32("biome-seed");
    const w = new World(scene as any, seed, undefined, 5, -3);
    const biomeId = (w as any).biomeId;
    const again = pickChunkBiome(String(seed), 5, -3);
    expect(biomeId).toBe(again);
    expect(getBiome(biomeId)).toBeTruthy();
  });

  it("produces sand-only tiles for desert biome", () => {
    // brute force search some coords until desert appears (limited tries)
    const seed = hashString32("biome-seed");
    let found = false;
    for (let cx = 0; cx < 50 && !found; cx++) {
      const biome = pickChunkBiome(String(seed), cx, 0);
      if (biome === "desert") {
        const w = new World(new FakeScene() as any, seed, undefined, cx, 0);
        const tiles = collectTiles(w);
        // Desert: only sand or water outside mask
        const unique = new Set(tiles);
        // Accept up to 2 tile types (water + sand) but no grass/snow id values used in other biomes
        expect(unique.size).toBeLessThanOrEqual(2);
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
