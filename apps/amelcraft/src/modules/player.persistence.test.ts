import { describe, it, expect, beforeEach } from "vitest";
import { Player } from "./Player";

// Minimal fake GameScene shell for Player dependencies
class FakeScene {
  add = {
    sprite: (x: number, y: number, _key: string, _frame: number) => {
      return {
        x,
        y,
        setOrigin: () => {},
        setSmooth: () => {},
        setDepth: () => {},
        play: () => {},
      } as any;
    },
  };
  anims = {
    exists: () => true,
    create: () => {},
  } as any;
  time = {
    addEvent: (_cfg: any) => ({ remove: () => {} }),
  } as any;
  getWorldManager() {
    return { isWalkable: () => true } as any;
  }
}

// Polyfill localStorage & timers if missing
// @ts-ignore
globalThis.window = globalThis.window || ({} as any);
// @ts-ignore
if (!window.localStorage) {
  const store = new Map<string, string>();
  // @ts-ignore
  window.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}
// @ts-ignore
if (typeof window.setTimeout !== "function")
  window.setTimeout = setTimeout as any;
// @ts-ignore
if (typeof window.clearTimeout !== "function")
  window.clearTimeout = clearTimeout as any;

describe("Player position persistence", () => {
  beforeEach(() => {
    // @ts-ignore
    window.localStorage.clear();
  });

  it("saves and restores position", () => {
    const shell = new FakeScene() as any;
    const p1 = new Player({ shell, start: [100, 200] });
    p1.enablePersistence("seed-xyz", 10); // fast save
    p1.setPosition(300, 450);
    p1.saveNow();
    const raw = window.localStorage.getItem("amelcraft:player:seed-xyz");
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw!);
    expect(data.x).toBe(300);
    expect(data.y).toBe(450);
    // New instance should load saved position
    const p2 = new Player({ shell, start: [0, 0] });
    p2.enablePersistence("seed-xyz");
    const [x, y] = p2.getPosition();
    expect(x).toBe(300);
    expect(y).toBe(450);
  });
});
