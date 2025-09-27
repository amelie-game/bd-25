import { assets } from "../assets";

export type InventorySlot = { block: number; count: number };

export class Inventory {
  private stackSize: number;
  private slotSize: number;

  private slots: InventorySlot[] = [];

  constructor({
    stackSize = 99,
    slotSize = 16,
  }: { stackSize?: number; slotSize?: number } = {}) {
    this.stackSize = stackSize;
    this.slotSize = slotSize;

    const blockSpriteKeys = Object.keys(assets.blocks.sprites);
    for (let i = 0; i < Math.min(3, blockSpriteKeys.length); i++) {
      this.slots.push({
        block:
          assets.blocks.sprites[
            blockSpriteKeys[i] as keyof typeof assets.blocks.sprites
          ],
        count: 10,
      });
    }
  }

  private findSlot(block: number): number {
    return this.slots.findIndex((slot) => slot.block === block);
  }

  add(block: number): boolean {
    let idx = this.findSlot(block);

    if (idx !== -1) {
      let slot = this.slots[idx];
      if (slot.count < this.stackSize) {
        slot.count++;

        return true;
      } else {
        // Stack full
        return false;
      }
    }
    // Add new slot if space
    if (this.slots.length < this.slotSize) {
      this.slots.push({ block, count: 1 });

      return true;
    }
    // Inventory full
    return false;
  }

  remove(block: number): false | number {
    let idx = this.findSlot(block);
    if (idx !== -1) {
      let slot = this.slots[idx];
      slot.count--;
      if (slot.count <= 0) {
        this.slots.splice(idx, 1);
      }

      return slot.count;
    }
    return false;
  }

  has(block: number): boolean {
    let idx = this.findSlot(block);
    return idx !== -1 && this.slots[idx].count > 0;
  }

  getSlots() {
    return this.slots;
  }
}
