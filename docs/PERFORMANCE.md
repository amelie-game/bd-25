# Performance & Instrumentation

Phase 11 introduced structured performance controls and metrics for chunked world management.

## Dirty Tile Batching
`WorldManager.flushDirtyBatched()` distributes a global `dirtyBudgetPerFrame` (default 800) proportionally across active chunks based on each chunk's share of the total dirty tiles, preventing large frame spikes.

## Generation Throttling
`maxNewChunksPerFrame` (2) limits the number of new chunks fully generated per update to smooth exploration performance.

## Active Chunk Cap
`maxActiveChunks` (9) enforces a soft 3x3 neighborhood limit. Additional distant loads are skipped with a console warning until older chunks unload.

## Metrics Snapshot
`WorldManager.getMetrics()` returns:

| Field | Meaning |
|-------|---------|
| frame | Frame/update counter |
| chunksLoaded | Total chunks created this session |
| chunksUnloaded | Total chunks destroyed/unloaded |
| savesPerformed | Successful diff saves |
| dirtyTilesFlushed | Tiles written to tilemap this frame |
| totalDirtyFlushTimeMs | Time spent flushing in this frame (ms) |
| generationTimeMs | Time spent generating chunks this frame (ms) |
| activeChunks | Current loaded chunk count |
| avgFlushBatchSize | Approximation of average batch size (simplified) |

## Dev Overlay (F3)
Press F3 to toggle a small overlay that anchors to the camera top-left and scales with zoom. It displays the metrics above for quick profiling during development.

## Future Enhancements
- Adaptive dirty budget based on recent frame time.
- Rolling averages / percentiles for flush & generation timings.
- Memory usage estimation per chunk (tiles + diff + metadata) with warnings.
- Optional remote telemetry exporter.
