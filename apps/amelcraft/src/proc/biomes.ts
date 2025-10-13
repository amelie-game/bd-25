// Simple biome registry for Phase 10
import { hashString32 } from "./gen";

export interface BiomeDefinition {
  id: string;
  label: string;
  // base ground tile id resolver (provided tile sprite ids externally)
  kind: "grass" | "desert" | "snow";
}

const registry = new Map<string, BiomeDefinition>();

export function registerBiome(def: BiomeDefinition) {
  registry.set(def.id, def);
}

export function getBiome(id: string) {
  return registry.get(id);
}

export function listBiomes() {
  return Array.from(registry.values());
}

// Deterministically pick a biome per chunk based on world seed & chunk coords
export function pickChunkBiome(
  worldSeed: string | number,
  chunkX: number,
  chunkY: number
): string {
  const biomes = listBiomes();
  if (biomes.length === 0) throw new Error("No biomes registered");
  const h = hashString32(`${worldSeed}:${chunkX}:${chunkY}:biome`);
  const idx = h % biomes.length;
  return biomes[idx].id;
}

// Initialize default three biomes
registerBiome({ id: "grass", label: "Grass Island", kind: "grass" });
registerBiome({ id: "desert", label: "Desert Island", kind: "desert" });
registerBiome({ id: "snow", label: "Snow Island", kind: "snow" });
