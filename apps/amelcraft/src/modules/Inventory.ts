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

  countBlock(block: Block): number {
    const idx = this.findBlockSlot(block);
    return idx === -1 ? 0 : this.blocks[idx].count;
  }

  /** Attempt to remove an exact amount of a block. Returns true if fully removed. */
  removeBlock(block: Block, count: number): boolean {
    if (count <= 0) return true;
    const idx = this.findBlockSlot(block);
    if (idx === -1) return false;
    const slot = this.blocks[idx];
    if (slot.count < count) return false; // insufficient
    slot.count -= count;
    if (slot.count <= 0) this.blocks.splice(idx, 1);
    return true;
  }

  /** Add many of the same block, ensuring atomic success (all added or none). */
  addMany(block: Block, count: number): boolean {
    if (count <= 0) return true;
    // Strategy: fill existing slot if present; if not, check capacity for new slot; ensure stack limit.
    const idx = this.findBlockSlot(block);
    if (idx !== -1) {
      const slot = this.blocks[idx];
      if (slot.count + count > this.stackSize) return false; // would overflow
      slot.count += count;
      return true;
    }
    // Need a new slot
    if (this.blocks.length >= this.slotSize) return false; // no slot space
    if (count > this.stackSize) return false; // cannot exceed stack size
    this.blocks.push({ block, count });
    return true;
  }

  /** Internal helper: can we add all provided block batches atomically? */
  canAddAllBlocks(batches: { block: Block; count: number }[]): boolean {
    // Simulate capacity without mutating.
    const tempSlots = new Map<Block, number>();
    // Seed current state
    for (const slot of this.blocks) tempSlots.set(slot.block, slot.count);
    let usedSlots = this.blocks.length;
    for (const b of batches) {
      const current = tempSlots.get(b.block);
      if (current !== undefined) {
        if (current + b.count > this.stackSize) return false; // overflow existing stack
        tempSlots.set(b.block, current + b.count);
      } else {
        // need new slot
        if (usedSlots + 1 > this.slotSize) return false;
        if (b.count > this.stackSize) return false; // single batch too large
        tempSlots.set(b.block, b.count);
        usedSlots++;
      }
    }
    return true;
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

  hasObject(id: ObjectId): boolean {
    return this.objects.some((s) => s.object === id && s.count > 0);
  }

  countObject(id: ObjectId): number {
    const slot = this.objects.find((s) => s.object === id);
    return slot ? slot.count : 0;
  }

  /** Remove an exact number of objects (default 1); returns true if success (all removed). */
  removeObject(id: ObjectId, count: number = 1): boolean {
    if (count <= 0) return true;
    const idx = this.objects.findIndex((s) => s.object === id);
    if (idx === -1) return false;
    const slot = this.objects[idx];
    if (slot.count < count) return false; // insufficient
    slot.count -= count;
    if (slot.count <= 0) this.objects.splice(idx, 1);
    return true;
  }

  getTotalObjectsCount(): number {
    return this.objects.reduce((sum, s) => sum + s.count, 0);
  }
}
