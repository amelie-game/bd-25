import { CHUNK_PIXELS, TILE_SIZE, CHUNK_TILES } from "./constants";
import { Direction, WorldTileCoord } from "./types";

export function getDirection(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  } else if (Math.abs(dy) > 0) {
    return dy > 0 ? "down" : "up";
  }
  return "down";
}

// Convert world pixel coordinates to chunk & local tile coordinates
export function worldToChunk(wx: number, wy: number): WorldTileCoord {
  const chunkX = Math.floor(wx / CHUNK_PIXELS);
  const chunkY = Math.floor(wy / CHUNK_PIXELS);
  const localX = wx - chunkX * CHUNK_PIXELS;
  const localY = wy - chunkY * CHUNK_PIXELS;
  const tileX = Math.floor(localX / TILE_SIZE);
  const tileY = Math.floor(localY / TILE_SIZE);
  return { chunkX, chunkY, tileX, tileY };
}

// Utility to compute a unique key for a chunk (used later for maps/caches)
export function chunkKey(x: number, y: number) {
  return `${x}:${y}`;
}

// Convert a tile index inside a chunk to a linear array index (row major)
export function tileIndex(tileX: number, tileY: number) {
  return tileY * CHUNK_TILES + tileX;
}

// Inverse of tileIndex (may be useful later)
export function fromTileIndex(index: number) {
  const tileY = Math.floor(index / CHUNK_TILES);
  const tileX = index - tileY * CHUNK_TILES;
  return { tileX, tileY };
}
