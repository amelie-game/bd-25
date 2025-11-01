// Flower density sampling helper (Step 14 QA)
// Non-runtime utility: can be imported in tests or dev console.
import { World } from "../modules/World";
import { hashString32 } from "./gen";
import { pickChunkBiome } from "./biomes";
import { InMemoryChunkStore } from "../modules/persistence/InMemoryChunkStore";
import { WorldManager } from "../modules/WorldManager";

// Minimal scene stub for headless sampling (copies pattern from existing tests)
class HeadlessScene {
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
  // Minimal inventory stub so WorldManager can query present ownership.
  private _inv = { getHasPresent: () => false };
  getInventory() {
    return this._inv;
  }
}

export interface DensitySampleResult {
  seed: string | number;
  sampledGrassChunks: number;
  meanFlowers: number;
  minFlowers: number;
  maxFlowers: number;
  stdDevFlowers: number;
  counts: number[];
  grassTileCounts: number[];
  meanGrassTiles: number;
  flowersPerGrassRatio: number; // meanFlowers / meanGrassTiles
}

export function sampleFlowerDensity(
  seed: string | number,
  count = 50,
  y = 0
): DensitySampleResult {
  const scene = new HeadlessScene() as any;
  const wm = new WorldManager(scene, seed, new InMemoryChunkStore());
  const counts: number[] = [];
  const grassTileCounts: number[] = [];
  let sampled = 0;
  for (let cx = 0; cx < count; cx++) {
    const biome = pickChunkBiome(seed, cx, y);
    if (biome !== "grass") continue; // sample only grass biome chunks
    const world = wm.getOrLoadChunk(cx, y);
    const n = (world as any).getObjectsCount?.() ?? 0;
    counts.push(n);
    // Estimate grass tiles: we have baseTiles array; count entries matching predominant grass tile id.
    const base: Uint16Array = (world as any).baseTiles;
    // Build frequency map quickly (limit to first pass). For performance, sample entire array.
    const freq = new Map<number, number>();
    for (let i = 0; i < base.length; i++) {
      const v = base[i];
      freq.set(v, (freq.get(v) || 0) + 1);
    }
    // Heuristic: grass biome predominant non-water, non-sand tile is grass. Sort by frequency descending.
    const entries = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
    const predominantCount = entries.length ? entries[0][1] : 0;
    grassTileCounts.push(predominantCount);
    sampled++;
  }
  const mean = counts.reduce((s, v) => s + v, 0) / (counts.length || 1);
  const meanGrass =
    grassTileCounts.reduce((s, v) => s + v, 0) / (grassTileCounts.length || 1);
  const variance =
    counts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) /
    (counts.length || 1);
  const stdDev = Math.sqrt(variance);
  return {
    seed,
    sampledGrassChunks: sampled,
    meanFlowers: mean,
    minFlowers: counts.length ? Math.min(...counts) : 0,
    maxFlowers: counts.length ? Math.max(...counts) : 0,
    stdDevFlowers: stdDev,
    counts,
    grassTileCounts,
    meanGrassTiles: meanGrass,
    flowersPerGrassRatio: meanGrass ? mean / meanGrass : 0,
  };
}

// Convenience: run from console if bundled (guard for browser env)
// @ts-ignore
if (typeof window !== "undefined") {
  // @ts-ignore
  (window as any).AMEL_SAMPLE_FLOWERS = (
    seed: string | number = "local-seed",
    count = 50
  ) => {
    return sampleFlowerDensity(seed, count);
  };
}
