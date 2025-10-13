# Biomes

Three deterministic biomes are currently implemented:

| Biome  | Kind Description | Tile Rules |
|--------|------------------|------------|
| grass  | Green island     | Interior = Grass, edge ring (outer ~10% radius) = Sand, water outside mask |
| desert | Sandy island     | Land = Sand, water outside mask |
| snow   | Snow island      | Interior = Snow, edge ring = Sand, water outside mask |

## Selection Algorithm
Biome chosen per chunk using a hash modulo registry size:

```
hash = hashString32(`${worldSeed}:${chunkX}:${chunkY}:biome`)
biomeIndex = hash % registeredBiomes.length
```

Deterministic for a given `worldSeed` and coordinates.

## Island Shape
Island mask uses radial falloff + multi-scale value noise to produce elevation; `isLand = elevation > -0.05`.

## Edge Ring
Edge classified where radial falloff > 0.9 producing a sand shoreline for grass & snow biomes.

## Registry
`biomes.ts` currently registers:
```ts
interface BiomeDefinition { id: string; label: string; kind: 'grass'|'desert'|'snow'; }
```
Future: replace `kind` with richer biome config (palette, decoration rules, spawn tables).

## Future Ideas
- Matrix-based selection using moisture & temperature noise instead of pure hash.
- Cross-chunk blending to soften sharp biome borders.
- Decoration pass (trees, rocks) seeded per chunk for consistent placement.
