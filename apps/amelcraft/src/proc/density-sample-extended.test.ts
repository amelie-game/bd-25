import { describe, it, expect } from "vitest";
import { sampleFlowerDensity } from "./density-sample";

// Provide minimal window stub for WorldManager.debugEnabled and timers
// @ts-ignore
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    AMEL_DEBUG_CHUNKS: false,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
  };
}

describe("Extended flower density sampling", () => {
  it("samples a wider range of chunks for ratio metrics", () => {
    const result = sampleFlowerDensity("local-seed", 120, 0);
    expect(result.sampledGrassChunks).toBeGreaterThan(10);
    // Ratio should be > 0 and << 1 given sparsity
    expect(result.flowersPerGrassRatio).toBeGreaterThan(0);
    // Log metrics
    // eslint-disable-next-line no-console
    console.log("[density-extended]", {
      sampled: result.sampledGrassChunks,
      meanFlowers: result.meanFlowers,
      meanGrassTiles: result.meanGrassTiles,
      ratio: result.flowersPerGrassRatio,
      minFlowers: result.minFlowers,
      maxFlowers: result.maxFlowers,
      stdDevFlowers: result.stdDevFlowers,
    });
  });
});
