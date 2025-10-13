# Chunked Multi-Island & Biome World: Requirements & Development Plan

This document captures the agreed requirements and an incremental plan to evolve the current single 100x100 island into a lazily loaded, persistent, procedurally generated multi‑island (chunked) world with biomes.

## 1. Requirements Summary

### World Partitioning
- World divided into chunks; CURRENT: 1 chunk = 1 island = 100 x 100 tiles.
- Avoid hard‑coding 100; introduce `CHUNK_TILES` constant.
- Future: allow multiple chunks per island or non‑island ocean chunks.

### Lazy Lifecycle
- Keep only current chunk and neighbor radius (default 1) in memory.
- Load/generate on demand; unload distant chunks (destroy render + keep serialized state only).

### Persistence
- Preserve modifications (placed / removed blocks, collected resources, metadata) across unload.
- Asynchronous save/load (initial: IndexedDB or localStorage fallback; later remote sync).
- Store version + world seed for deterministic reconstruction.
- Persist *diffs* against procedural baseline to reduce payload size.

### Data vs Rendering Separation
- Modes act on data model, not sprites.
- Rendering = projection of authoritative tile data arrays.
- Mutations: update data -> mark dirty -> minimal render diff.

### Biomes & Generation
- Deterministic per chunk: `biome = f(seed, chunkX, chunkY)` using noise / hash.
- Biome defines palette, resources, decoration rules.
- Procedural algorithm produces baseline `baseTiles` + entities/decor.

### Seamless Player Navigation
- Detect chunk transitions via player world position.
- Preload neighbor chunks when player nears boundary (threshold e.g. 80% of chunk extent).

### Performance & Memory
- Active tile cap = (#activeChunks * CHUNK_TILES^2).
- Incremental tile updates vs full re-renders.
- Destroy textures/sprites on unload; retain shared atlas only.
- Throttle generation & persistence; debounce saves (e.g. 500ms after last mutation).

### Mutation Tracking
- Maintain overlay map (sparse) or separate array for changed tiles.
- Serialize only changed indices.
- Resource depletion & durability tracked in per‑tile metadata map.

### Extensibility
- Biome registry (data driven; allows later weather, ambient SFX, spawn tables).
- Clear interfaces for chunk storage and generation enabling swapping implementations.

### Testing & Determinism
- Given identical seed + (chunkX, chunkY): identical biome + base layout.
- Mutation persistence validated across unload/reload cycles.
- Versioning guards against generation algorithm drift (migration path).

### Edge Cases / Risks
- Rapid boundary crossing (ensure prefetch prevents hitching).
- Interrupted save (use atomic write or temp key then swap).
- Algorithm changes invalidating old diffs (store gen version; optional regen + merge diffs).
- Memory spikes from simultaneous loads (queue & cap concurrency).
- Large diff growth (periodic compaction: rebuild baseline & reset diff if diff ratio high).

## 2. Target Data Model (Draft)

```
WorldManager
  seed: string | number
  activeChunks: Map<ChunkKey, Chunk>
  store: IChunkStore
  getOrLoadChunk(chunkX, chunkY): Promise<Chunk>
  update(playerPos)
  unloadFar(centerChunk, radius)

Chunk
  key: string ("x:y")
  coords: { x: number; y: number }
  biomeId: string
  baseTiles: Uint16Array (length = CHUNK_TILES * CHUNK_TILES)
  overlayDiff: Map<number, TileId>
  meta: Map<number, TileMeta>  // durability, resource state
  dirtyTiles: Set<number>
  rendered: boolean
  ensureRendered(scene)
  applyTile(index, tileId)
  serializeDiff(): SerializedChunk
  unload(): void

BiomeRegistry
  register(id, biomeDef)
  get(id)

Interfaces
  interface IChunkStore {
    load(key: string): Promise<SerializedChunk | null>;
    save(key: string, data: SerializedChunk): Promise<void>;
    prune?(predicate): Promise<void>;
  }
```

Tile addressing helper: `index = tileY * CHUNK_TILES + tileX`.

## 3. Operational Flow
1. Player moves → compute current chunk from world coords.
2. WorldManager ensures current + neighbors loaded (generate or load + apply diff).
3. Distant chunks scheduled for unload (save diff, destroy visuals, delete references).
4. Mutations (collect/place) call `setTileAt(worldX, worldY, tileId)` → mark dirty.
5. Render step flushes dirty tiles (batch, capped per frame to avoid spikes).
6. Debounced persistence saves dirty chunks.

## 4. Procedural Generation Outline
1. Derive noise seeds from world seed + chunk coords (hash).
2. Generate elevation, moisture noise layers.
3. Map to biome (lookup thresholds grid or Voronoi partition).
4. Populate base tile array (water, sand, grass, stone, etc.).
5. Secondary pass: decorations/resources (trees, rocks) into meta/diff overlays.
6. Return `Chunk` with filled `baseTiles` & initial diff (often empty).

## 5. Persistence Format (Initial Proposal)

```
SerializedChunk {
  version: number;          // generation/persistence schema version
  seed: string | number;    // world seed for regen validation
  biomeId: string;
  coords: { x: number; y: number };
  diff: Array<[number, TileId]>;      // sparse diff vs regenerated baseline
  meta?: Array<[number, TileMeta]>;   // optional sparse metadata
  lastTouched: number;       // epoch ms
}
```

Storage key: `chunk:${worldSeed}:${x}:${y}`.

## 6. Incremental Development Phases

| Phase | Goal | Key Artifacts |
|-------|------|---------------|
| 1 | Introduce chunk constants & helpers | `constants.ts`, conversion funcs |
| 2 | WorldManager + adapt existing single world | `WorldManager.ts`, refactor `World` → `Chunk` shim |
| 3 | Data-first tile array & render projection | `ChunkData`, replace direct sprite logic |
| 4 | Deterministic procedural generation | noise utils, biome selection |
| 5 | Persistence interfaces & in-memory + IndexedDB store | `IChunkStore`, `IndexedDBChunkStore` |
| 6 | Lazy load/unload & neighbor retention | world update loop integration |
| 7 | Dirty-tile diff rendering optimization | batching, caps |
| 8 | Refactor modes to data API | update Collect/Place/Move modes |
| 9 | Tests: determinism & persistence | unit tests for generation & reload |
| 10 | Biome registry & multiple biomes | biome configs |
| 11 | Performance instrumentation & safeguards | logging, dev overlay |
| 12 | Documentation & polish | update ARCHITECTURE.md, add diagrams |

## 7. Detailed Todo Checklist

```markdown
- [x] Phase 1: Add chunk sizing constants and coordinate helpers
- [x] Phase 2: Introduce WorldManager and adapt existing World into single-chunk abstraction
- [x] Phase 3: Implement data-first tile array (Uint16Array) and refactor rendering to consume it
- [x] Phase 4: Add deterministic procedural generation (seed + biome selection)
- [x] Phase 5: Define persistence interfaces and implement IndexedDB + in-memory fallback
- [x] Phase 6: Implement lazy load/unload logic around player position
- [x] Phase 7: Add dirty-tile diff rendering and batch updates
- [x] Phase 8: Refactor modes (collect/place) to operate on data layer
- [x] Phase 9: Add tests for determinism, persistence, and mutation correctness
- [x] Phase 10: Add biome registry and extend biome diversity
- [x] Phase 11: Performance instrumentation, throttling, and memory safeguards
- [ ] Phase 12: Documentation updates (architecture, persistence format, biome system)
```

## 8. Initial Interfaces (Sketch)

```ts
// constants.ts
export const CHUNK_TILES = 100; // future configurable
export const CHUNK_PIXELS = CHUNK_TILES * TILE_SIZE; // TILE_SIZE existing

export function worldToChunk(wx: number, wy: number) {
  const chunkX = Math.floor(wx / CHUNK_PIXELS);
  const chunkY = Math.floor(wy / CHUNK_PIXELS);
  const localX = wx - chunkX * CHUNK_PIXELS;
  const localY = wy - chunkY * CHUNK_PIXELS;
  const tileX = Math.floor(localX / TILE_SIZE);
  const tileY = Math.floor(localY / TILE_SIZE);
  return { chunkX, chunkY, tileX, tileY };
}

// WorldManager API (draft)
class WorldManager {
  getTileAt(wx: number, wy: number) {/* ... */}
  setTileAt(wx: number, wy: number, tile: number) {/* ... */}
  update(playerPos: { x: number; y: number }) {/* neighbor load/unload */}
}
```

## 9. Metrics & Instrumentation
- Generation time per chunk (ms)
- Save payload bytes
- Active chunk count & memory estimate
- Dirty tile flush count per frame
- Load/unload events (dev console overlay)

## 10. Future Enhancements
- Multi-layer chunks (ground, objects, decals).
- Entity streaming (NPCs, mobs) similar to chunks.
- Server authoritative persistence & syncing.
- Biome transitions & gradient blending between adjacent chunk edges.
- World map overview (fog of war / discovered chunks).

## 11. Cross References
- See `ARCHITECTURE.md` for overall architectural philosophy; this plan fits within the incremental, Kaizen approach — starting simple, layering complexity only as required.

---
Prepared: 2025-10-13
