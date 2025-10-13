// Chunk & world related constants and helpers
// Phase 1: Introduce chunk sizing constants and coordinate helpers

export const TILE_SIZE = 48;

// Number of tiles along one edge of a chunk (square). Currently matches existing world size
export const CHUNK_TILES = 100; // TODO: make configurable or data-driven later
export const CHUNK_PIXELS = CHUNK_TILES * TILE_SIZE;
