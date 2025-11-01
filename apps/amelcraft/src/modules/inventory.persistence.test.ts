import { describe, it, expect, beforeEach } from "vitest";
import { Inventory } from "./Inventory";
import { assets } from "../assets";

// Provide minimal localStorage polyfill for test environment
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}

// @ts-ignore
globalThis.window = globalThis.window || ({} as any);
// @ts-ignore
if (!globalThis.window.localStorage) {
  // @ts-ignore
  globalThis.window.localStorage = new MemoryStorage();
}
// Polyfill timers if missing (Vitest jsdom vs node environment safety)
// @ts-ignore
if (typeof window.setTimeout !== "function") {
  // @ts-ignore
  window.setTimeout = setTimeout as any;
}
// @ts-ignore
if (typeof window.clearTimeout !== "function") {
  // @ts-ignore
  window.clearTimeout = clearTimeout as any;
}

describe("Inventory persistence", () => {
  beforeEach(() => {
    // @ts-ignore
    window.localStorage.clear();
  });

  it("roundtrips blocks & objects via localStorage", () => {
    const inv = new Inventory({ stackSize: 50, slotSize: 8 });
    inv.enablePersistence("seed-abc", 10); // fast save
    // Clear seeded blocks for deterministic test
    (inv as any).getBlocks().splice(0); // direct mutation for test determinism
    const { Yellow, Red } = assets.blocks.sprites;
    inv.addMany(Yellow, 5);
    inv.addMany(Red, 3);
    inv.addObject("flower_red" as any);
    inv.addObject("flower_red" as any);
    // Obtain special present flag
    inv.obtainPresent();
    inv.saveNow();
    const raw = window.localStorage.getItem("amelcraft:inventory:seed-abc");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.blocks.length).toBe(2);
    expect(parsed.objects[0].c).toBe(2);
    expect(parsed.hasPresent).toBe(true);
    // New inventory instance loads existing
    const inv2 = new Inventory({ stackSize: 50, slotSize: 8 });
    inv2.enablePersistence("seed-abc");
    expect(inv2.countBlock(Yellow)).toBe(5);
    expect(inv2.countBlock(Red)).toBe(3);
    expect(inv2.countObject("flower_red" as any)).toBe(2);
    expect(inv2.getHasPresent()).toBe(true);
  });
});
