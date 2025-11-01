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
  /** Non-placeable, non-craftable special flag indicating player owns a present. */
  private hasPresent: boolean = true;
  // Persistence -------------------------------------------------------------
  private storageKey: string | null = null;
  private saveDelayMs = 500;
  private saveTimer: number | null = null;
  private dirty = false;
  private autosaveEnabled = false;
  private static SERIALIZATION_VERSION = 2; // bumped for hasPresent field

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
        this.markDirty();

        return true;
      } else {
        // Stack full
        return false;
      }
    }
    // Add new slot if space
    if (this.blocks.length < this.slotSize) {
      this.blocks.push({ block, count: 1 });
      this.markDirty();

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
      this.markDirty();

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
    this.markDirty();
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
      this.markDirty();
      return true;
    }
    // Need a new slot
    if (this.blocks.length >= this.slotSize) return false; // no slot space
    if (count > this.stackSize) return false; // cannot exceed stack size
    this.blocks.push({ block, count });
    this.markDirty();
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
        this.markDirty();
        return true;
      }
      return false; // stack full
    }

    if (this.objects.length < this.slotSize) {
      this.objects.push({ object: id, count: 1 });
      this.markDirty();
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

  /** Whether the special present has been obtained. */
  getHasPresent(): boolean {
    return this.hasPresent;
  }

  /** Mark the present as obtained. Returns true if state changed. */
  obtainPresent(): boolean {
    if (this.hasPresent) return false; // already had it
    this.hasPresent = true;
    this.markDirty();
    return true;
  }

  /** For testing or admin tools: clear the present flag. */
  clearPresent(): void {
    if (!this.hasPresent) return;
    this.hasPresent = false;
    this.markDirty();
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
    this.markDirty();
    return true;
  }

  getTotalObjectsCount(): number {
    return this.objects.reduce((sum, s) => sum + s.count, 0);
  }

  // =============================
  // Persistence API
  // =============================
  /** Enable automatic persistence to localStorage scoped by seed. */
  enablePersistence(seed: string | number, saveDelayMs: number = 500) {
    this.storageKey = `amelcraft:inventory:${seed}`;
    this.saveDelayMs = saveDelayMs;
    this.autosaveEnabled = true;
    // Attempt load
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        this.applySerialized(data);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Inventory persistence load failed", e);
    }
  }

  /** Serialize current inventory to plain JSON suitable for storage. */
  serialize() {
    const blocks = this.blocks.map((s) => ({ b: s.block, c: s.count }));
    const objects = this.objects.map((s) => ({ o: s.object, c: s.count }));
    return {
      version: Inventory.SERIALIZATION_VERSION,
      stackSize: this.stackSize,
      slotSize: this.slotSize,
      blocks,
      objects: objects.length ? objects : undefined,
      hasPresent: this.hasPresent || undefined,
      ts: Date.now(),
    };
  }

  /** Apply serialized data (clears existing state). */
  private applySerialized(data: any) {
    if (!data || typeof data !== "object") return;
    // Basic version gate (allow future migrations)
    if (typeof data.version !== "number") return;
    this.blocks = [];
    this.objects = [];
    if (Array.isArray(data.blocks)) {
      for (const entry of data.blocks) {
        if (
          !entry ||
          typeof entry.b !== "number" ||
          typeof entry.c !== "number"
        )
          continue;
        if (entry.c <= 0) continue;
        this.blocks.push({ block: entry.b as Block, count: entry.c });
      }
    }
    if (Array.isArray(data.objects)) {
      for (const entry of data.objects) {
        if (
          !entry ||
          typeof entry.o !== "string" ||
          typeof entry.c !== "number"
        )
          continue;
        if (entry.c <= 0) continue;
        this.objects.push({ object: entry.o as ObjectId, count: entry.c });
      }
    }
    // Special flag (defaults false if absent)
    this.hasPresent = !!data.hasPresent;
    // After load, mark clean (avoid immediate save)
    this.dirty = false;
  }

  private markDirty() {
    this.dirty = true;
    if (this.autosaveEnabled) this.scheduleSave();
  }

  private scheduleSave() {
    if (!this.storageKey) return;
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), this.saveDelayMs);
  }

  /** Force immediate save if dirty. */
  saveNow() {
    if (!this.storageKey) return;
    if (!this.dirty) return; // skip if nothing changed
    try {
      const payload = this.serialize();
      window.localStorage.setItem(this.storageKey, JSON.stringify(payload));
      this.dirty = false;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Inventory persistence save failed", e);
    }
  }

  destroy() {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    // Best-effort final save
    this.saveNow();
  }
}
