# Testing

Automated tests (Vitest) validate deterministic generation, persistence integrity, batching semantics, biome assignment, and metrics shape without requiring a browser rendering context.

## Stack
- Runner: Vitest (Node environment)
- Location: `apps/amelcraft/src/proc/*.test.ts`
- Stubbing: Lightweight FakeScene implements only the Phaser APIs touched by World (tilemap & graphics creation) so tests run headless.

## Current Tests
| Test | Purpose |
|------|---------|
| generation.test.ts | Identical base tile hash for same seed & chunk coords |
| persistence.test.ts | Round‑trip apply of serialized diff reproduces mutations |
| dirty-flush.test.ts | flushDirty(limit) respects limit and reduces dirty set |
| biomes.test.ts | Deterministic biome selection; desert palette constraint |
| metrics.test.ts | Metrics object exposes required fields |

## Adding a New Test
1. Create `<feature>.test.ts` under the relevant module folder.
2. Import { describe, it, expect } from `vitest`.
3. Stub any additional Phaser methods the code path needs.
4. Run `npm test` (script `test` in `apps/amelcraft/package.json`).

## Future Coverage Targets
- Persistence migration when version increments.
- Performance regression: ensure flush never exceeds budget under synthetic large dirty sets.
- Biome distribution statistics over an N×N chunk sample.
- Property-based shoreline ring invariant.

## Philosophy
The suite favors fast, deterministic logic tests over integration tests; rendering & input are already exercised interactively. As systems grow (entities, decorations, metadata), we can expand stubs or introduce a lightweight headless Phaser renderer if needed.
