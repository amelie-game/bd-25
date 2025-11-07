import Phaser from "phaser";
import { assets } from "../assets";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  preload() {
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

    this.load.pack("main", "assets/pack.json");
  }

  async create() {
    const width = this.sys.game.config.width as number;
    const height = this.sys.game.config.height as number;

    // Animations
    this.anims.createFromAseprite(assets.amelie.key);

    // Game icon
    this.add
      .image(width / 2, height / 2 - 200, "game-icon")
      .setOrigin(0.5)
      .setDisplaySize(96, 96);

    const maxTitleWidth = Math.min(width * 0.9, 600); // 90% of screen width, max 600px

    const titleImage = this.add
      .image(width / 2, height / 2 - 80, "title")
      .setOrigin(0.5);

    if (titleImage.width > maxTitleWidth) {
      const scale = maxTitleWidth / titleImage.width;
      titleImage.setScale(scale);
    }

    // Make title responsive - scale to fit screen width with padding

    const hasPersistence = await this.hasPersistentState();

    let continueBtn: Phaser.GameObjects.Text | undefined;
    if (hasPersistence) {
      continueBtn = this.add
        .text(width / 2, height / 2 + 10, "Weiter", {
          font: "24px Arial",
          color: "#0ff",
          backgroundColor: "#222",
          padding: { x: 16, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
    }

    const newGameBtn = this.add
      .text(
        width / 2,
        hasPersistence ? height / 2 + 50 : height / 2 + 10,
        "Neues Spiel",
        {
          font: "24px Arial",
          color: "#0ff",
          backgroundColor: "#222",
          padding: { x: 16, y: 8 },
        }
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    newGameBtn.on("pointerdown", async () => {
      if (continueBtn) continueBtn.setColor("#0ff");
      newGameBtn.setColor("#ff0");
      await this.clearPersistentState();
      const seed = this.generateSeed();
      this.scene.start("GameScene", { seed });
    });

    if (continueBtn) {
      continueBtn.on("pointerdown", () => {
        newGameBtn.setColor("#0ff");
        continueBtn!.setColor("#ff0");
        const seed = this.getPersistedSeed() ?? "local-seed";
        this.scene.start("GameScene", { seed });
      });
    }
  }

  private async clearPersistentState() {
    try {
      // Remove all amelcraft:* keys (player + inventory)
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith("amelcraft:")) toRemove.push(k);
      }
      toRemove.forEach((k) => window.localStorage.removeItem(k));

      await new Promise<void>((resolve) => {
        const req = window.indexedDB.deleteDatabase("AmelcraftWorld");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
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

  /** All three must exist: player key, inventory key, chunks DB with store. */
  private async hasPersistentState(): Promise<boolean> {
    let hasPlayer = false;
    let hasInventory = false;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("amelcraft:player:")) hasPlayer = true;
      else if (k.startsWith("amelcraft:inventory:")) hasInventory = true;
      if (hasPlayer && hasInventory) break;
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

    return hasPlayer && hasInventory && hasChunksDB;
  }

  /** Extract first discovered persisted seed from inventory or player localStorage keys. */
  private getPersistedSeed(): string | null {
    let found: string | null = null;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k.startsWith("amelcraft:inventory:")) {
        found = k.substring("amelcraft:inventory:".length);
        break;
      }
      if (k.startsWith("amelcraft:player:")) {
        found = k.substring("amelcraft:player:".length);
      }
    }
    return found;
  }

  private generateSeed(): string {
    const rand = Math.floor(Math.random() * 0xffffffff);
    return `seed-${Date.now().toString(36)}-${rand.toString(16)}`;
  }
}
