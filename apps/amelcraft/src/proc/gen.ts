// Procedural generation utilities: deterministic hashing, PRNG and biome selection

// 32-bit FNV-1a hash (simple, fast, deterministic for seeds)
export function hashString32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0; // ensure unsigned
}

// Mulberry32 PRNG (deterministic, adequate for terrain variety)
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simple 2D value noise using hashed lattice; deterministic given seed
export function makeValueNoise2D(seed: number) {
  return function noise(x: number, y: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const rnd = (ix: number, iy: number) => {
      let n = ix * 374761393 + iy * 668265263 + seed * 1446648777;
      n = (n ^ (n >> 13)) * 1274126177;
      n = n ^ (n >> 16);
      return (n & 0xffffffff) / 0xffffffff; // 0..1
    };
    const v00 = rnd(xi, yi);
    const v10 = rnd(xi + 1, yi);
    const v01 = rnd(xi, yi + 1);
    const v11 = rnd(xi + 1, yi + 1);
    const sx = smooth(xf);
    const sy = smooth(yf);
    const ix0 = v00 + (v10 - v00) * sx;
    const ix1 = v01 + (v11 - v01) * sx;
    const v = ix0 + (ix1 - ix0) * sy;
    return v * 2 - 1; // -1..1
  };
}

export interface BiomeSelection {
  biomeId: string;
  elevation: number;
  moisture: number;
}

// Simple biome picker based on elevation & moisture thresholds
export function pickBiome(elevation: number, moisture: number): string {
  if (elevation < -0.2) return "ocean";
  if (elevation < 0) return moisture > 0 ? "shore-wet" : "shore";
  if (elevation < 0.35) return moisture > 0.4 ? "grass" : "dry-grass";
  if (elevation < 0.65) return moisture > 0.5 ? "forest" : "scrub";
  return moisture > 0.3 ? "mountain" : "mountain-dry";
}
