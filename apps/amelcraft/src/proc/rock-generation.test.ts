import { describe, it, expect } from "vitest";
import { World } from "../modules/World";
import { hashString32 } from "./gen";
import { pickChunkBiome } from "./biomes";
import { ROCK_DENSITY_DIVISOR, CHUNK_TILES } from "../constants";

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

function getObjectsMap(world: World): Map<number, string> {
  return (world as any).objects as Map<number, string>;
}

describe("Rock generation & properties", () => {
  it("places rocks across different biomes with reasonable density", () => {
    const seed = hashString32("rock-density-seed");
    // Sample one chunk of each biome (grass, desert, snow)
    const biomePositions: Record<string, { cx: number; cy: number }> = {};
    for (let cx = 0; cx < 200; cx++) {
      const biomeGrass = pickChunkBiome(seed, cx, 0);
      if (!biomePositions[biomeGrass] && biomeGrass === "grass")
        biomePositions[biomeGrass] = { cx, cy: 0 };
      const biomeDesert = pickChunkBiome(seed, cx, 5);
      if (!biomePositions[biomeDesert] && biomeDesert === "desert")
        biomePositions[biomeDesert] = { cx, cy: 5 };
      const biomeSnow = pickChunkBiome(seed, cx, -5);
      if (!biomePositions[biomeSnow] && biomeSnow === "snow")
        biomePositions[biomeSnow] = { cx, cy: -5 };
      if (biomePositions.grass && biomePositions.desert && biomePositions.snow)
        break;
    }
    expect(biomePositions.grass).toBeTruthy();
    expect(biomePositions.desert).toBeTruthy();
    expect(biomePositions.snow).toBeTruthy();

    const counts: number[] = [];
    for (const biome of ["grass", "desert", "snow"]) {
      const pos = biomePositions[biome]!;
      const w = new World(
        new FakeScene() as any,
        seed,
        undefined,
        pos.cx,
        pos.cy
      );
      const objects = getObjectsMap(w);
      const rockCount = Array.from(objects.values()).filter((id) =>
        id.startsWith("rock_")
      ).length;
      counts.push(rockCount);
      // Basic density check: Expect <= landTiles / ROCK_DENSITY_DIVISOR * 4 (loose upper bound)
      // Land tiles approximate: chunk tiles minus water ring (~ proportion). We'll just assert not excessive.
      const looseUpper =
        ((CHUNK_TILES * CHUNK_TILES) / ROCK_DENSITY_DIVISOR) * 4;
      expect(rockCount).toBeLessThanOrEqual(looseUpper + 50); // buffer
    }
    // Ensure at least some rocks across sampled biomes
    expect(counts.some((c) => c > 0)).toBe(true);
  });

  it("marks tiles with rocks as non-walkable", () => {
    const seed = hashString32("rock-walkable-seed");
    // Find a chunk with at least one rock
    let target: { cx: number; cy: number } | null = null;
    for (let cx = 0; cx < 120 && !target; cx++) {
      const w = new World(new FakeScene() as any, seed, undefined, cx, 0);
      const objects = getObjectsMap(w);
      const idx = Array.from(objects.entries()).find(([_, id]) =>
        id.startsWith("rock_")
      );
      if (idx) target = { cx, cy: 0 };
    }
    expect(target).toBeTruthy();
    const w = new World(
      new FakeScene() as any,
      seed,
      undefined,
      target!.cx,
      target!.cy
    );
    const objects = getObjectsMap(w);
    const rockEntry = Array.from(objects.entries()).find(([_, id]) =>
      id.startsWith("rock_")
    );
    expect(rockEntry).toBeTruthy();
    const linearIndex = rockEntry![0];
    const tx = linearIndex % (World as any).COLUMNS;
    const ty = Math.floor(linearIndex / (World as any).COLUMNS);
    // Convert to pixel coords (center of tile)
    const px = tx * 48 + 24 + target!.cx * (World as any).COLUMNS * 48;
    const py = ty * 48 + 24 + target!.cy * (World as any).COLUMNS * 48;
    expect(w.isWalkable(px, py)).toBe(false);
  });
});
