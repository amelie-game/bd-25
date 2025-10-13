# Persistence & Diff Format

This document describes how chunks are persisted using a sparse diff overlay against a procedurally regenerated baseline.

## Goals
- Minimize storage size.
- Allow generation algorithm to evolve (versioning) while keeping player changes.
- Avoid saving full 10k-tile arrays for every chunk.

## Data Flow
1. On first load `World` generates baseline tiles deterministically from `(worldSeed, chunkX, chunkY)`.
2. Player mutations call `putTileAt` which updates `baseTiles`, compares against `baselineTiles` and updates `overlayDiff`.
3. Dirty tile indices accumulate; render flushing is batched (Phase 7).
4. Save is debounced (500ms) per chunk; also forced on unload.
5. Serialized diff is stored with metadata.

## Serialized Structure
```ts
interface SerializedChunkDiffEntry { i: number; t: number; }
interface SerializedChunk {
  version: number;          // schema/gen version (future use)
  worldSeed: string | number;
  chunkX: number;
  chunkY: number;
  biomeId: string | null;   // filled after Phase 10
  diff: SerializedChunkDiffEntry[]; // sparse differences
  meta?: { i: number }[];   // placeholder for future tile metadata
  lastTouched: number;      // epoch ms
}
```

`diff` contains only indices where `baseTiles[idx] !== baselineTiles[idx]`.

## Versioning Strategy
- Current `CHUNK_SERIALIZATION_VERSION = 1`.
- If generation logic changes, old chunks regenerate baseline then reapply diff.
- Future migrations can read `version` and translate older metadata.

## Atomicity & Reliability
- IndexedDB store writes full object under key `chunk:${worldSeed}:${x}:${y}`.
- Optional future enhancement: write to `temp:` key then swap.

## Diff Compaction
If `diff.length / (CHUNK_TILES^2)` grows beyond a threshold (e.g. >40%), we can:
1. Treat current `baseTiles` as new baseline.
2. Clear `overlayDiff`.
3. Persist empty diff (compaction).

## Rationale
Comparing arrays each save would be O(n). Maintaining a live diff map keeps mutation cost O(1) and save cost O(diff).

## Edge Cases
- Unloaded chunk with pending save: timer triggers save before destruction.
- Interrupted save: acceptable risk; next load regenerates baseline, diff missing -> player changes lost only for last unsaved interval.
