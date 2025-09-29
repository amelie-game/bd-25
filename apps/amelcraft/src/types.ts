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

export function toBlock(value: unknown): Block {
  if (isFinite(Number(value)) && Block.includes(Number(value) as Block)) {
    return Number(value) as Block;
  }

  throw new Error(`Invalid Block type: ${value}`);
}

const Mode = ["collect", "move"] as const;
export type Mode = (typeof Mode)[number];

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
