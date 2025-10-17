import { assets } from "../assets";
import { Block, ObjectId } from "../types";
import { Inventory } from "./Inventory";

// =============================
// Colored Sand Crafting Module
// =============================
// Single transaction: 1 flower + N (1..10) Yellow sand -> N colored sand blocks.
// Deterministic output distribution per flower id.

export interface CraftOutput {
  block: Block;
  count: number;
}

export interface CraftRecipe {
  id: ObjectId;
  description: string;
  distribute(n: number): CraftOutput[]; // deterministic mapping
}

export interface CraftValidation {
  ok: boolean;
  error?: string;
}

export interface CraftResult extends CraftValidation {
  outputs?: CraftOutput[];
}

const { Red, LightRed, LightCyan, Cyan, Blue, Magenta, LightMagenta, Yellow } =
  assets.blocks.sprites;

// Helper to build 100% recipes
function single(block: Block, n: number): CraftOutput[] {
  return [{ block, count: n }];
}

// Flower id constants (subset of ObjectId with prefix flower_)
export type FlowerId =
  | "flower_red"
  | "flower_cyan"
  | "flower_turquoise"
  | "flower_blue"
  | "flower_purple"
  | "flower_pink";

const FLOWER_RED: FlowerId = "flower_red";
const FLOWER_CYAN: FlowerId = "flower_cyan";
const FLOWER_TURQUOISE: FlowerId = "flower_turquoise";
const FLOWER_BLUE: FlowerId = "flower_blue";
const FLOWER_PURPLE: FlowerId = "flower_purple";
const FLOWER_PINK: FlowerId = "flower_pink";

export const RECIPES: Record<FlowerId, CraftRecipe> = {
  [FLOWER_RED]: {
    id: FLOWER_RED,
    description: "Red + LightRed split (odd -> Red gets extra)",
    distribute: (n: number) => {
      const light = Math.floor(n / 2);
      const red = n - light;
      return [
        { block: Red, count: red },
        { block: LightRed, count: light },
      ].filter((o) => o.count > 0);
    },
  },
  [FLOWER_CYAN]: {
    id: FLOWER_CYAN,
    description: "100% LightCyan",
    distribute: (n: number) => single(LightCyan, n),
  },
  [FLOWER_TURQUOISE]: {
    id: FLOWER_TURQUOISE,
    description: "100% Cyan (fallback for turquoise)",
    distribute: (n: number) => single(Cyan, n),
  },
  [FLOWER_BLUE]: {
    id: FLOWER_BLUE,
    description: "100% Blue",
    distribute: (n: number) => single(Blue, n),
  },
  [FLOWER_PURPLE]: {
    id: FLOWER_PURPLE,
    description: "100% Magenta",
    distribute: (n: number) => single(Magenta, n),
  },
  [FLOWER_PINK]: {
    id: FLOWER_PINK,
    description: "100% LightMagenta",
    distribute: (n: number) => single(LightMagenta, n),
  },
};

// =============================
// Validation & Simulation
// =============================
export function validateCraft(
  flowerId: FlowerId,
  sandCount: number,
  inv: Inventory
): CraftValidation {
  if (!RECIPES[flowerId]) return { ok: false, error: "Unknown recipe" };
  if (sandCount < 1 || sandCount > 10)
    return { ok: false, error: "Sand amount must be 1..10" };
  if (!inv.hasObject(flowerId)) return { ok: false, error: "Flower missing" };
  if (!inv.has(Yellow) || inv.countBlock(Yellow) < sandCount)
    return { ok: false, error: "Not enough yellow sand" };
  // Capacity check via simulation
  const outputs = RECIPES[flowerId]!.distribute(sandCount);
  if (!inv.canAddAllBlocks(outputs))
    return { ok: false, error: "Inventory capacity insufficient" };
  return { ok: true };
}

export function simulateCraft(
  flowerId: FlowerId,
  sandCount: number
): CraftOutput[] {
  const recipe = RECIPES[flowerId];
  if (!recipe || sandCount < 1) return [];
  return recipe.distribute(sandCount);
}

// =============================
// Execute (Atomic)
// =============================
export function executeCraft(
  flowerId: FlowerId,
  sandCount: number,
  inv: Inventory
): CraftResult {
  const validation = validateCraft(flowerId, sandCount, inv);
  if (!validation.ok) return validation;
  const outputs = RECIPES[flowerId]!.distribute(sandCount);
  // Apply atomic transaction
  const removedFlower = inv.removeObject(flowerId, 1);
  const removedSand = inv.removeBlock(Yellow, sandCount);
  if (!removedFlower || !removedSand) {
    // rollback (should not happen if validate passed, but safe)
    if (removedFlower) inv.addObject(flowerId);
    if (removedSand) inv.addMany(Yellow, sandCount);
    return { ok: false, error: "Removal failed" };
  }
  // Add outputs
  let allAdded = true;
  for (const out of outputs) {
    if (!inv.addMany(out.block, out.count)) {
      allAdded = false;
      break;
    }
  }
  if (!allAdded) {
    // rollback entire transaction
    inv.addObject(flowerId);
    inv.addMany(Yellow, sandCount);
    // remove any partially added outputs (simplistic rollback by brute-force removal)
    for (const out of outputs) {
      inv.removeBlock(out.block, out.count); // if counts exceeded, will drop slot as needed
    }
    return { ok: false, error: "Addition failed (rollback)" };
  }
  return { ok: true, outputs };
}

// Convenience helper for UI preview formatting
export function formatOutputs(outputs: CraftOutput[]): string {
  return outputs.map((o) => `${o.count}x${o.block}`).join(", ");
}
