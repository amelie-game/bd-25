import { describe, it, expect } from "vitest";
import { World } from "../modules/World";
import { hashString32 } from "./gen";
import { pickChunkBiome } from "./biomes";
import { FLOWER_DENSITY_DIVISOR, CHUNK_TILES } from "../constants";

// Reusable lightweight fake scene (mirrors other tests)
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

function getObjectsCount(world: World): number {
  return (world as any).objects.size as number;
}

function getGrassTileCount(world: World): number {
  const GRASS = (globalThis as any).assets?.blocks?.sprites?.Grass; // not available in test stub; fallback to heuristic
  // In tests we don't have real assets; we derive counts indirectly.
  // We'll approximate by counting tiles that match the most frequent non-water tile when biome is grass.
  const tiles: Uint16Array = (world as any).baseTiles;
  // Build frequency map (skip 0 which we treat as 'no tile')
  const freq = new Map<number, number>();
  for (let i = 0; i < tiles.length; i++) {
    const v = tiles[i];
    freq.set(v, (freq.get(v) || 0) + 1);
  }
  // Sort by frequency
  const entries = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  // First entry should correspond to predominant biome ground (grass or sand depending on edge water proportion)
  const predominantTile = entries.length ? entries[0][0] : 0;
  // Heuristic: treat predominant non-zero tile as grass when biome is grass.
  return entries.length ? entries[0][1] : 0;
}

describe("Flower object generation (Step 11)", () => {
  it("places a non-zero number of flowers in a grass biome chunk within loose statistical bounds", () => {
    const seed = hashString32("flower-density-seed");
    // Find a grass biome chunk (deterministic pick)
    let found = false;
    let targetCx = 0,
      targetCy = 0;
    for (let cx = 0; cx < 50 && !found; cx++) {
      const biome = pickChunkBiome(seed, cx, 0);
      if (biome === "grass") {
        found = true;
        targetCx = cx;
        targetCy = 0;
      }
    }
    expect(found).toBe(true);
    const w = new World(
      new FakeScene() as any,
      seed,
      undefined,
      targetCx,
      targetCy
    );
    const flowerCount = getObjectsCount(w);
    // Expected mean ~ grassTiles / FLOWER_DENSITY_DIVISOR (binomial). Use heuristic grass tile count.
    const grassTiles = getGrassTileCount(w);
    const expectedMean = grassTiles / FLOWER_DENSITY_DIVISOR;
    // Basic assertions: >0 and not extreme outlier (> 4x mean + small buffer)
    expect(flowerCount).toBeGreaterThan(0);
    // Allow very loose upper bound; if mean is small (e.g., <5) still cap at 60
    const upperBound = Math.max(60, expectedMean * 4 + 10);
    expect(flowerCount).toBeLessThan(upperBound);
  });

  it("does not place flowers in desert biome chunks", () => {
    const seed = hashString32("flower-biome-restrict-seed");
    let found = false;
    let targetCx = 0,
      targetCy = 0;
    for (let cx = 0; cx < 80 && !found; cx++) {
      const biome = pickChunkBiome(seed, cx, 5); // vary y to improve distribution
      if (biome === "desert") {
        found = true;
        targetCx = cx;
        targetCy = 5;
      }
    }
    expect(found).toBe(true);
    const w = new World(
      new FakeScene() as any,
      seed,
      undefined,
      targetCx,
      targetCy
    );
    expect(getObjectsCount(w)).toBe(0);
  });

  it("does not place flowers in snow biome chunks", () => {
    const seed = hashString32("flower-biome-restrict-seed-2");
    let found = false;
    let targetCx = 0,
      targetCy = 0;
    for (let cx = 0; cx < 80 && !found; cx++) {
      const biome = pickChunkBiome(seed, cx, -7);
      if (biome === "snow") {
        found = true;
        targetCx = cx;
        targetCy = -7;
      }
    }
    expect(found).toBe(true);
    const w = new World(
      new FakeScene() as any,
      seed,
      undefined,
      targetCx,
      targetCy
    );
    expect(getObjectsCount(w)).toBe(0);
  });
});
