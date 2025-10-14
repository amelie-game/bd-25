import { assets } from "./assets";

const PlayerAnimations = Object.values(
  assets.amelie.animations
) as ReadonlyArray<
  (typeof assets.amelie.animations)[keyof typeof assets.amelie.animations]
>;
export type PlayerAnimation = (typeof PlayerAnimations)[number];

const Block = Object.values(assets.blocks.sprites) as ReadonlyArray<
  (typeof assets.blocks.sprites)[keyof typeof assets.blocks.sprites]
>;
export type Block = (typeof Block)[number];

export function isBlock(value: unknown): value is Block {
  return typeof value === "number" && Block.includes(value as Block);
}

export function toBlock(value: unknown): Block {
  if (isBlock(value)) {
    return Number(value) as Block;
  }

  throw new Error(`Invalid Block type: ${value}`);
}

const Movement = ["walk", "idle"] as const;
export type Movement = (typeof Movement)[number];

const Mode = ["collect", "move"] as const;
export type Mode = (typeof Mode)[number];

export function isMode(value: unknown): value is Mode {
  return typeof value === "string" && Mode.includes(value as Mode);
}

const Option = [...Mode, ...Block] as const;
export type Option = (typeof Option)[number];

export function toOption(value: unknown): Option {
  if (isFinite(Number(value)) && Block.includes(Number(value) as Block)) {
    return Number(value) as Block;
  }
  if (Mode.includes(value as Mode)) {
    return value as Mode;
  }

  throw new Error(`Invalid Option type: ${value}`);
}

export type Direction = "right" | "left" | "up" | "down";

export interface ChunkCoord {
  chunkX: number;
  chunkY: number;
}

export interface WorldTileCoord extends ChunkCoord {
  tileX: number; // tile coordinate inside chunk (0..CHUNK_TILES-1)
  tileY: number;
}

// ==========================
// Collectible Object Typing
// ==========================
// Derive object frame id union directly from generated assets (avoid manual list)
const ObjectSpriteValues = Object.values(
  assets.objects.sprites
) as ReadonlyArray<
  (typeof assets.objects.sprites)[keyof typeof assets.objects.sprites]
>;
export type ObjectId = (typeof ObjectSpriteValues)[number];

// Serialized representation of a collectible object inside a chunk snapshot
export interface SerializedObjectEntry {
  /** linear tile index (tx + ty * CHUNK_TILES) */
  i: number;
  /** object kind / atlas frame key */
  k: ObjectId;
}

export function isObjectId(v: unknown): v is ObjectId {
  return (
    typeof v === "string" &&
    (ObjectSpriteValues as readonly (string | number)[]).includes(v as any)
  );
}

export function isSerializedObjectEntry(v: any): v is SerializedObjectEntry {
  return (
    v &&
    typeof v === "object" &&
    typeof v.i === "number" &&
    isFinite(v.i) &&
    isObjectId(v.k)
  );
}
