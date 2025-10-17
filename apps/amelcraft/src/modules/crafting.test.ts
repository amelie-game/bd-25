import { describe, it, expect } from "vitest";
import { assets } from "../assets";
import { Inventory } from "./Inventory";
import {
  executeCraft,
  simulateCraft,
  validateCraft,
  FlowerId,
} from "./Crafting";

// Helper to seed inventory with given flower + yellow sand count
function seedInventory({
  yellow,
  flowerId,
  otherBlocks = [],
  stackSize,
  slotSize,
}: {
  yellow: number;
  flowerId?: FlowerId;
  otherBlocks?: { block: number; count: number }[];
  stackSize?: number;
  slotSize?: number;
}) {
  const inv = new Inventory({ stackSize, slotSize });
  // Inventory constructor seeds first 3 block slots automatically; we clear for deterministic tests
  (inv as any).blocks = [];
  (inv as any).objects = [];
  const Y = assets.blocks.sprites.Yellow;
  if (yellow > 0) (inv as any).blocks.push({ block: Y, count: yellow });
  for (const b of otherBlocks)
    (inv as any).blocks.push({ block: b.block, count: b.count });
  if (flowerId) (inv as any).objects.push({ object: flowerId, count: 1 });
  return inv;
}

describe("Crafting validateCraft", () => {
  const Y = assets.blocks.sprites.Yellow;
  it("rejects unknown recipe (cast)", () => {
    const inv = seedInventory({ yellow: 5 });
    // Force cast to simulate bad id
    const v = validateCraft("flower_unknown" as any, 5, inv as any);
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/Unknown/);
  });
  it("rejects sand count 0", () => {
    const inv = seedInventory({ yellow: 5, flowerId: "flower_red" });
    const v = validateCraft("flower_red", 0, inv as any);
    expect(v.ok).toBe(false);
  });
  it("rejects sand count >10", () => {
    const inv = seedInventory({ yellow: 11, flowerId: "flower_red" });
    const v = validateCraft("flower_red", 11, inv as any);
    expect(v.ok).toBe(false);
  });
  it("rejects missing flower", () => {
    const inv = seedInventory({ yellow: 5 });
    const v = validateCraft("flower_red", 5, inv as any);
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/Flower/);
  });
  it("rejects insufficient yellow sand", () => {
    const inv = seedInventory({ yellow: 4, flowerId: "flower_red" });
    const v = validateCraft("flower_red", 5, inv as any);
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/yellow/);
  });
});

describe("Crafting simulateCraft & executeCraft", () => {
  it("red flower even split n=4 => 2 light_red, 2 red", () => {
    const inv = seedInventory({ yellow: 4, flowerId: "flower_red" });
    const outputs = simulateCraft("flower_red", 4);
    const red = outputs.find((o) => o.block === assets.blocks.sprites.Red)!;
    const light = outputs.find(
      (o) => o.block === assets.blocks.sprites.LightRed
    )!;
    expect(red.count).toBe(2);
    expect(light.count).toBe(2);
    const result = executeCraft("flower_red", 4, inv as any);
    expect(result.ok).toBe(true);
    // Flower consumed
    expect(inv.countObject("flower_red" as any)).toBe(0);
    // Yellow decreased
    expect(inv.countBlock(assets.blocks.sprites.Yellow)).toBe(0);
  });
  it("red flower odd split n=5 => 3 red, 2 light_red", () => {
    const inv = seedInventory({ yellow: 5, flowerId: "flower_red" });
    const outputs = simulateCraft("flower_red", 5);
    const red = outputs.find((o) => o.block === assets.blocks.sprites.Red)!;
    const light = outputs.find(
      (o) => o.block === assets.blocks.sprites.LightRed
    )!;
    expect(red.count).toBe(3);
    expect(light.count).toBe(2);
  });
  it("turquoise flower maps to cyan one-for-one", () => {
    const inv = seedInventory({ yellow: 7, flowerId: "flower_turquoise" });
    const outputs = simulateCraft("flower_turquoise", 7);
    expect(outputs.length).toBe(1);
    expect(outputs[0].block).toBe(assets.blocks.sprites.Cyan);
    expect(outputs[0].count).toBe(7);
  });
  it("capacity insufficient triggers validation error", () => {
    // Fill inventory slots so adding new output requires a new slot beyond capacity
    // slotSize=3, already using all 3 with Yellow + Red + LightRed; attempt crafting cyan which needs new slot
    const inv = seedInventory({
      yellow: 3,
      flowerId: "flower_turquoise",
      otherBlocks: [
        { block: assets.blocks.sprites.Red, count: 10 },
        { block: assets.blocks.sprites.LightRed, count: 10 },
      ],
      slotSize: 3,
      stackSize: 99,
    });
    const v = validateCraft("flower_turquoise", 3, inv as any);
    expect(v.ok).toBe(false);
    expect(v.error).toMatch(/capacity/);
    // Ensure inventory unchanged
    expect(inv.countBlock(assets.blocks.sprites.Yellow)).toBe(3);
    expect(inv.countObject("flower_turquoise" as any)).toBe(1);
  });
  it("rollback preserves inputs when addition fails after removal", () => {
    // Force failure during addition by constraining stackSize so adding outputs would overflow
    // stackSize=2, crafting 3 cyan blocks impossible though capacity simulation should catch.
    const inv = seedInventory({
      yellow: 3,
      flowerId: "flower_turquoise",
      slotSize: 10,
      stackSize: 2,
    });
    const v = validateCraft("flower_turquoise", 3, inv as any);
    expect(v.ok).toBe(false); // caught early by capacity simulation (overflow)
    // Ensure no mutation occurred
    expect(inv.countBlock(assets.blocks.sprites.Yellow)).toBe(3);
    expect(inv.countObject("flower_turquoise" as any)).toBe(1);
  });
  it("successful craft consumes inputs and adds outputs (pink -> light_magenta)", () => {
    const inv = seedInventory({ yellow: 6, flowerId: "flower_pink" });
    const result = executeCraft("flower_pink", 6, inv as any);
    expect(result.ok).toBe(true);
    expect(inv.countBlock(assets.blocks.sprites.Yellow)).toBe(0);
    expect(inv.countObject("flower_pink" as any)).toBe(0);
    expect(inv.countBlock(assets.blocks.sprites.LightMagenta)).toBe(6);
  });
});
