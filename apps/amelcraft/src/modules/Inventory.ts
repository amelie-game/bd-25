import { assets } from "../assets";
import { Block, ObjectId } from "../types";

// Backward compatibility: existing HUD expects slots with numeric block ids.
// We'll maintain an internal union but expose a getSlots() returning a
// simplified structure. Legacy code using .add(Block) continues to work.
export type InventoryBlockSlot = { block: Block; count: number };
export type InventoryObjectSlot = { object: ObjectId; count: number };

export class Inventory {
  private stackSize: number;
  private slotSize: number;

  private blocks: InventoryBlockSlot[] = [];
  private objects: InventoryObjectSlot[] = [];

  constructor({
    stackSize = 99,
    slotSize = 16,
  }: { stackSize?: number; slotSize?: number } = {}) {
    this.stackSize = stackSize;
    this.slotSize = slotSize;

    const blockSpriteKeys = Object.keys(assets.blocks.sprites);
    for (let i = 0; i < Math.min(3, blockSpriteKeys.length); i++) {
      this.blocks.push({
        block:
          assets.blocks.sprites[
            blockSpriteKeys[i] as keyof typeof assets.blocks.sprites
          ],
        count: 10,
      });
    }
  }

  private findBlockSlot(block: Block): number {
    return this.blocks.findIndex((slot) => slot.block === block);
  }

  add(block: Block): boolean {
    let idx = this.findBlockSlot(block);

    if (idx !== -1) {
      let slot = this.blocks[idx];
      if (slot.count < this.stackSize) {
        slot.count++;

        return true;
      } else {
        // Stack full
        return false;
      }
    }
    // Add new slot if space
    if (this.blocks.length < this.slotSize) {
      this.blocks.push({ block, count: 1 });

      return true;
    }
    // Inventory full
    return false;
  }

  remove(block: Block): false | number {
    let idx = this.findBlockSlot(block);
    if (idx !== -1) {
      let slot = this.blocks[idx];
      slot.count--;
      if (slot.count <= 0) {
        this.blocks.splice(idx, 1);
      }

      return slot.count;
    }
    return false;
  }

  has(block: Block): boolean {
    let idx = this.findBlockSlot(block);
    return idx !== -1 && this.blocks[idx].count > 0;
  }

  // Object support (Step 7 dependency)
  addObject(id: ObjectId): boolean {
    // find existing object slot
    const idx = this.objects.findIndex((s) => s.object === id);
    if (idx !== -1) {
      const slot = this.objects[idx];
      if (slot.count < this.stackSize) {
        slot.count++;
        return true;
      }
      return false; // stack full
    }

    if (this.objects.length < this.slotSize) {
      this.objects.push({ object: id, count: 1 });
      return true;
    }
    return false; // inventory full
  }

  getBlocks(): InventoryBlockSlot[] {
    return this.blocks;
  }

  getObjects(): InventoryObjectSlot[] {
    return this.objects;
  }
}
