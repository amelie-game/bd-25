export type InventorySlot = { block: number; count: number };

export class Inventory {
  private slots: InventorySlot[] = [];
  private maxSlots: number;
  private stackSize: number;
  constructor(maxSlots: number, stackSize: number) {
    this.maxSlots = maxSlots;
    this.stackSize = stackSize;
  }
  add(block: number): boolean {/* TODO */ return true; }
  remove(block: number): boolean {/* TODO */ return true; }
  has(block: number): boolean {/* TODO */ return true; }
  getSlots() { return this.slots; }
}