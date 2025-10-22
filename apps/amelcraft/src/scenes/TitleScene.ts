import Phaser from "phaser";
import { assets } from "../assets";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  preload() {
    // Simple loading progress bar
    const width = this.scale.width;
    const height = this.scale.height;
    const progressBox = this.add.graphics();
    const progressBar = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 12, 320, 24);

    this.load.on("progress", (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ffff, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 8, 300 * value, 16);
    });

    this.load.on("complete", () => {
      progressBar.destroy();
      progressBox.destroy();
    });

    // Load all atlases & spritesheets defined in the pack file
    // The pack file is at /assets/pack.json relative to index.html
    this.load.pack("main", "assets/pack.json");
  }

  async create() {
    const width = this.sys.game.config.width as number;
    const height = this.sys.game.config.height as number;

    // Create all animations from Aseprite for amelie (and others if needed)
    this.anims.createFromAseprite(assets.amelie.key);
    // If you have more atlases, repeat for each: this.anims.createFromAseprite("cynthia"); etc.

    this.add
      .text(width / 2, height / 2 - 40, "Amelcraft", {
        font: "32px Arial",
        color: "#fff",
      })
      .setOrigin(0.5);

    let continueBtn: Phaser.GameObjects.Text | undefined;

    const newGameBtn = this.add
      .text(width / 2, height / 2 + 50, "Neues Spiel", {
        font: "24px Arial",
        color: "#0ff",
        backgroundColor: "#222",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    newGameBtn.on("pointerdown", async () => {
      continueBtn?.setColor("#0ff");
      newGameBtn.setColor("#ff0");

      await this.clearPersistentState();
      this.scene.start("GameScene");
    });

    if (!(await this.hasPersistentState())) return;

    continueBtn = this.add
      .text(width / 2, height / 2 + 10, "Weiter", {
        font: "24px Arial",
        color: "#0ff",
        backgroundColor: "#222",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    continueBtn.on("pointerdown", () => {
      newGameBtn.setColor("#0ff");
      continueBtn.setColor("#ff0");

      this.scene.start("GameScene");
    });
  }

  /**
   * Clear all persisted Amelcraft state:
   * - Player & Inventory localStorage entries (keys starting 'amelcraft:')
   * - IndexedDB chunk database ('AmelcraftWorld') containing serialized chunk snapshots
   * Safe to call before starting a new game. If the IndexedDB deletion is blocked
   * (open tabs), it will still clear localStorage and proceed.
   */
  private async clearPersistentState(): Promise<void> {
    try {
      // Remove localStorage keys with amelcraft prefix
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith("amelcraft:")) toRemove.push(k);
      }
      toRemove.forEach((k) => window.localStorage.removeItem(k));

      // Delete IndexedDB database used by chunk persistence
      await new Promise<void>((resolve) => {
        const req = window.indexedDB.deleteDatabase("AmelcraftWorld");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve(); // ignore errors; maybe already gone
        req.onblocked = () => resolve(); // cannot delete now; treat as cleared localStorage only
      });

      // eslint-disable-next-line no-console
      console.log(
        "[TitleScene] Persistence cleared (localStorage + IndexedDB)"
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[TitleScene] Failed to clear persistence", e);
    }
  }

  /**
   * Determine if any persisted Amelcraft state exists.
   * Returns true if:
   *  1. At least one player key (amelcraft:player:*) AND
   *  2. IndexedDB database AmelcraftWorld exists and contains the 'chunks' object store.
   * If the IndexedDB open fails (e.g., blocked / unavailable), falls back to localStorage check.
   */
  private async hasPersistentState(): Promise<boolean> {
    let hasPlayer = false;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      else if (k.startsWith("amelcraft:player:")) hasPlayer = true;
      if (hasPlayer) break;
    }

    let hasChunksDB = false;
    try {
      const openReq = window.indexedDB.open("AmelcraftWorld");
      hasChunksDB = await new Promise<boolean>((resolve) => {
        openReq.onsuccess = () => {
          const db = openReq.result;
          resolve(db.objectStoreNames.contains("chunks"));
        };
        openReq.onerror = () => resolve(false);
        openReq.onblocked = () => resolve(false);
      });
    } catch {
      hasChunksDB = false;
    }

    return hasPlayer && hasChunksDB;
  }
}
