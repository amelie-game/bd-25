import { describe, it, expect } from "vitest";
import { sampleFlowerDensity } from "./density-sample";

// Provide minimal window stub for WorldManager.debugEnabled in Node test env
// @ts-ignore
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    AMEL_DEBUG_CHUNKS: false,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
  };
}

// Non-asserting informational test (will still pass). If mean zero, flags potential generation issue.

describe("Flower density sampling (informational)", () => {
  it("samples grass chunks and reports statistics", () => {
    const result = sampleFlowerDensity("local-seed", 40, 0);
    // Basic sanity: at least one grass chunk sampled
    expect(result.sampledGrassChunks).toBeGreaterThan(0);
    // If mean is 0, generation likely broken for objects
    expect(result.meanFlowers).toBeGreaterThan(0);
    // Log details (visible with --reporter verbose or console output)
    // eslint-disable-next-line no-console
    console.log("[density]", {
      sampled: result.sampledGrassChunks,
      mean: result.meanFlowers,
      min: result.minFlowers,
      max: result.maxFlowers,
      stdDev: result.stdDevFlowers,
    });
  });
});
