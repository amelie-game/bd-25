// Chunk & world related constants and helpers
// Phase 1: Introduce chunk sizing constants and coordinate helpers

export const TILE_SIZE = 48;

// Number of tiles along one edge of a chunk (square). Currently matches existing world size
export const CHUNK_TILES = 100; // TODO: make configurable or data-driven later
export const CHUNK_PIXELS = CHUNK_TILES * TILE_SIZE;

// Collectibles / flora generation tuning
// Average: roughly 1 flower per FLOWER_DENSITY_DIVISOR grass tiles (stochastic)
export const FLOWER_DENSITY_DIVISOR = 95; // tuned (Step 14) from 140 to increase average flowers
// Average: roughly 1 rock per ROCK_DENSITY_DIVISOR land tiles (across all biomes).
// Rocks are sparser than flowers and occupy a tile (non-walkable). Adjust via tuning.
export const ROCK_DENSITY_DIVISOR = 180; // initial heuristic
// Draw depth for object sprites. Must be > ground layer (0) and < player (1) so player renders above.
export const OBJECT_DEPTH = 0.5;
