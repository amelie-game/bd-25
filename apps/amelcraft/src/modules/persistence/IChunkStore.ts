// Phase 5+: Persistence interfaces & data contracts
// Step 2 (Collectibles): add optional `objects` snapshot for collectible world objects.

import type { SerializedObjectEntry } from "../../types";

export interface SerializedChunkDiffEntry {
  /** linear tile index */
  i: number;
  /** new tile id */
  t: number;
}

export interface SerializedTileMetaEntry {
  i: number;
  // Placeholder for future metadata (durability, resource depletion, etc.)
  // For now kept minimal; extend later.
  // d?: number;
}

export interface SerializedChunk {
  version: number;
  worldSeed: string | number;
  chunkX: number;
  chunkY: number;
  biomeId: string | null; // placeholder for future biome tagging
  diff: SerializedChunkDiffEntry[]; // sparse differences from regenerated baseline
  meta?: SerializedTileMetaEntry[]; // optional sparse metadata entries
  /** Optional full object snapshot (flowers, etc.). If absent, treat as empty set. */
  objects?: SerializedObjectEntry[];
  lastTouched: number; // epoch ms
}

export interface IChunkStore {
  load(key: string): Promise<SerializedChunk | null>;
  save(key: string, data: SerializedChunk): Promise<void>;
  delete?(key: string): Promise<void>;
  keys?(): Promise<string[]>;
}

export function chunkStorageKey(
  worldSeed: string | number,
  x: number,
  y: number
) {
  return `chunk:${worldSeed}:${x}:${y}`;
}

// Increment when the wire format meaningfully changes. Adding optional fields is backward compatible.
export const CHUNK_SERIALIZATION_VERSION = 2;
