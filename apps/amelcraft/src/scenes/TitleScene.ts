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

  create() {
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

    const continueBtn = this.add
      .text(width / 2, height / 2 + 10, "Weiter", {
        font: "24px Arial",
        color: "#0ff",
        backgroundColor: "#222",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const newGameBtn = this.add
      .text(width / 2, height / 2 + 50, "Neues Spiel", {
        font: "24px Arial",
        color: "#0ff",
        backgroundColor: "#222",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    newGameBtn.on("pointerdown", () => {
      continueBtn.setColor("#0ff");
      newGameBtn.setColor("#ff0");
      this.scene.start("GameScene");
    });

    continueBtn.on("pointerdown", () => {
      // TODO: Continue game logic
      newGameBtn.setColor("#0ff");
      continueBtn.setColor("#ff0");
    });
  }
}
