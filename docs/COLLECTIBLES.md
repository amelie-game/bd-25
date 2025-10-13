## Collectible Objects (Flowers & Future Resources)

### Status
Planned – implementation not yet merged. This document is the authoritative design reference while adding flower (and later rock) collectibles to the world.

---

## 1. Goals

1. Procedurally distribute flower objects on grass-biome islands (per chunk).
2. Player collection prioritizes an object (flower) over ground tile mutation when present.
3. Collected flower:
   - Added to inventory (stacking logic similar to blocks, but as a distinct item kind).
   - Removed visually and from world state.
4. Flower presence / absence persists (survives reload) just like mutated tiles.
5. Keep architecture forward-compatible for additional object types (rocks) and richer metadata (durability, growth, etc.).

Non-goals (for this first pass): regrowth, tool requirements, animation, deterministic baseline diff compression (we store full object list initially), multi-layer pathfinding interactions.

---

## 2. Terminology

| Term | Meaning |
|------|---------|
| Tile | Terrain base (numeric ID sourced from `assets.blocks.sprites`). |
| Object | A collectible entity placed "on" a tile (flower, rock). Not encoded as tile ID. |
| Chunk | 100×100 tile region (see `CHUNK_TILES`). Owns tiles + objects. |
| Baseline Tiles | Procedurally generated initial tile array (used for diffing). |
| Overlay Diff | Sparse tile mutations relative to baseline. |

---

## 3. Data Model Additions

```ts
// Object identity (matches frame names in objects atlas)
type ObjectId =
  | 'flower_red' | 'flower_cyan' | 'flower_yellow'
  | 'flower_turquoise' | 'flower_blue' | 'flower_purple' | 'flower_pink'
  // (rocks reserved for later)
  ;

interface WorldObject {
  id: ObjectId;          // atlas frame key
  i: number;             // linear tile index (tx + ty * CHUNK_TILES)
  sprite: Phaser.GameObjects.Image; // runtime only (not serialized)
}

interface SerializedObjectEntry {
  i: number;  // linear tile index
  k: ObjectId; // kind / frame key
}

// Extend SerializedChunk (IChunkStore) with:
interface SerializedChunk {
  ...
  objects?: SerializedObjectEntry[]; // Optional full snapshot (first implementation)
}

// Inventory
type InventoryItem =
  | { kind: 'block'; id: Block; count: number }
  | { kind: 'object'; id: ObjectId; count: number };
```

Rationale: Keep initial persistence simple (complete object list) → easier to reason about, small size (expected dozens max per chunk). Can evolve to diff-of-removals later if a deterministic baseline for objects is introduced.

---

## 4. Procedural Generation (Flowers)

Generation occurs inside `World.generateIsland()` (or a new helper invoked after tile generation) only if the biome kind is `grass`.

Algorithm:
1. Inspect all tiles after base land generation.
2. For each grass tile (not sand/water), with probability `p = 1 / FLOWER_DENSITY_DIVISOR` attempt placement.
3. Randomly choose a flower variant with uniform distribution across available frames.
4. Ensure no duplicate object already at that index.
5. Store as `WorldObject` (create sprite) and append to internal object map.

Constants (add to `constants.ts` or a new config file):
```ts
export const FLOWER_DENSITY_DIVISOR = 140;  // tweak for desired density
export const OBJECT_DEPTH = 5;              // draw order (ground=0, objects=5, player>5, highlight=10)
```

Determinism: Use the existing per-chunk RNG (`mulberry32(seed)`) so flower placement is predictable. Because we are *persisting* the full object list, determinism is nice but not strictly required for correctness now; it *will* matter if/when we switch to diff-of-removals.

---

## 5. World Integration

Add to `World`:
```ts
private objects: Map<number, WorldObject> = new Map();

addObject(id: ObjectId, tx: number, ty: number): void;
getObjectAt(tx: number, ty: number): WorldObject | null;
removeObjectAt(tx: number, ty: number): boolean; // returns true if removed

serializeObjects(): SerializedObjectEntry[];
applySerializedObjects(list: SerializedObjectEntry[]): void;
```

Rendering: Each object -> `this.shell.add.image(offsetX + tx*TILE_SIZE + TILE_SIZE/2, offsetY + ty*TILE_SIZE + TILE_SIZE/2, assets.objects.key, id)` with `setDepth(OBJECT_DEPTH)`. Destroy sprite when object removed or chunk destroyed.

Persistence hooks:
* Include `objects` array inside `serializeDiff` return value.
* In `WorldManager.loadExisting`, after applying tile diff, if `data.objects` present → call `applySerializedObjects`.
* Any add/remove triggers `onMutate()` so chunk save scheduling includes object changes.

Backward compatibility: Old saved chunks without `objects` simply load with none (fine). New code must tolerate `objects` missing.

---

## 6. WorldManager Helpers

Add convenience methods for global coordinates:
```ts
getObjectAtGlobal(tileX: number, tileY: number): WorldObject | null;
removeObjectAtGlobal(tileX: number, tileY: number): boolean;
```
These mirror existing tile helpers and translate global tile coordinates to chunk-local indices.

---

## 7. Collection Flow Changes

Amend `CollectMode.finishCollection(tx, ty)` logic:
1. Query `worldManager.getObjectAtGlobal(tx, ty)`.
2. If found:
   - Attempt `inventory.addObject(obj.id)`.
   - If added, `worldManager.removeObjectAtGlobal(tx, ty)` and HUD refresh.
   - Return early (skip tile mutation logic).
3. Else run existing tile collection logic (tile transforms + adding block to inventory).

Collection time: unchanged (1s). Possible future variation per object.

---

## 8. Inventory & HUD Adjustments

Inventory changes:
* Store entries as `InventoryItem` union.
* Add helper predicates:
  - `isSameItem(a,b)` (same kind + id).
* Provide `addBlock(blockId)` and `addObject(objectId)` thin wrappers or a generic `addItem(item)`.

HUD changes (minimal viable):
* When mapping slots to UI data, if `kind==='block'` keep existing sprite discovery.
* If `kind==='object'`, provide atlas key `objects` and frame name = `id` so renderer can draw it (requires HUD component update to accept a `sheet` + `frame` pair OR a generic descriptor).
* If HUD currently assumes numeric block ID, extend its data contract (e.g., include `category: 'block' | 'object'`).

Backward compatibility: Accept existing block-only structures; new properties optional. Fallback display (text label) if rendering path not yet implemented.

---

## 9. Persistence Format Example

```jsonc
{
  "version": 1,
  "worldSeed": "local-seed",
  "chunkX": 0,
  "chunkY": 0,
  "biomeId": "grass",
  "diff": [ { "i": 5050, "t": 11 } ],
  "objects": [
    { "i": 4321, "k": "flower_red" },
    { "i": 7890, "k": "flower_blue" }
  ],
  "lastTouched": 1730000000000
}
```

If `objects` absent, treat as empty list.

---

## 10. Testing Strategy

Unit / Integration tests (place in `proc/` or new test file):
1. Generation Density: For a grass biome chunk, count flowers; assert within expected bounds (e.g., 0 < count < CHUNK_TILES*CHUNK_TILES / FLOWER_DENSITY_DIVISOR * 2).
2. Biome Restriction: Desert / snow biome chunks either produce zero flowers.
3. Collection: Simulate adding a flower at tile, collect → inventory increments, object removed, tile unchanged.
4. Persistence: After removal, serialize + reload (apply diff & objects) → ensure flower not present.
5. Backward Compatibility: Loading a serialized chunk without `objects` does not throw.

Edge cases (manual QA):
* Collect while moving across chunk boundary.
* Collecting multiple flowers quickly (inventory stacking works, no duplicates remain in world).
* Saving & reloading with mixed tile mutations and object removals.

---

## 11. Performance Considerations

* Expected flower count per chunk is small (< ~80 @ current density). Full list serialization negligible.
* Object lookups use a `Map<number,WorldObject>` O(1).
* Save size overhead: each object entry ~ (index + small string) – acceptable; could compress later.
* Future optimization: store baseline deterministic placement and only track removals to reduce I/O.

---

## 12. Future Enhancements (Not in First Pass)

* Rocks with longer collection times or tool gating.
* Object-specific animations / particle effects on collection.
* Regrowth timers or seasonal generation refresh.
* Deterministic baseline + diff-of-removals for compact saves.
* Object metadata (durability, growth stage) via `SerializedTileMetaEntry` or a parallel `objectsMeta` extension.
* Pathfinding collision if certain objects become blocking.

---

## 13. Implementation Checklist

```
1. [x] Extend types: ObjectId, InventoryItem, SerializedObjectEntry
2. [x] Update IChunkStore interfaces & version note (optional objects[] field)
3. [ ] Add object container & API to World (add/get/remove, serialize/apply)
4. [ ] Procedural flower generation (grass biome only) with density constant
5. [ ] Rendering for objects (depth ordering) & cleanup on destroy
6. [ ] WorldManager global helpers (get/remove object at global coords)
7. [ ] Modify CollectMode to prioritize object collection
8. [ ] Refactor Inventory for union item kind (block/object) & stacking rules
9. [ ] HUD adaptations for object items (sprite frame rendering)
10. [ ] Persistence wiring (save & load objects field)
11. [ ] Tests: generation density + biome restriction
12. [ ] Tests: collection flow & persistence
13. [ ] Documentation updates (this file – keep in sync if design shifts)
14. [ ] Manual QA & tuning (flower density, visual overlap)
```

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Inventory / HUD break due to new union type | Introduce adapters; keep old code paths until fully migrated. |
| Save incompatibility | Optional `objects` field guarded by presence checks. |
| Visual clutter / performance with too many objects | Density constant tweak; future culling if needed. |
| Future diff optimization complexity | Keep simple full snapshot now; encapsulate serialization for easy swap later. |

---

## 15. Quick Reference (Dev Cheatsheet)

| Concern | Location / Action |
|---------|-------------------|
| Add new object kind | Append frame to objects atlas + extend `ObjectId` union. |
| Force re-gen (dev) | Clear IndexedDB chunk keys or change world seed. |
| Adjust density | `FLOWER_DENSITY_DIVISOR` constant. |
| Rendering order | `OBJECT_DEPTH` constant. |

---

## 16. Open Questions (Track & Resolve Before Expanding to Rocks)

1. Should flower collection have its own animation or sound cue? (Placeholder now.)
2. Should we prevent flower placement on edge sand tiles of grass biome? (Currently yes— only on grass.)
3. Should inventory differentiate categories visually? (Deferred.)

---

End of design.
