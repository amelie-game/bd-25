import Phaser from "phaser";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create() {
    const width = this.sys.game.config.width as number;
    const height = this.sys.game.config.height as number;
    this.add
      .text(width / 2, height / 2 - 40, "Amelcraft", {
        font: "32px Arial",
        color: "#fff",
      })
      .setOrigin(0.5);

    const newGameBtn = this.add
      .text(width / 2, height / 2 + 10, "New Game", {
        font: "24px Arial",
        color: "#0ff",
        backgroundColor: "#222",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const continueBtn = this.add
      .text(width / 2, height / 2 + 50, "Continue", {
        font: "24px Arial",
        color: "#0ff",
        backgroundColor: "#222",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    newGameBtn.on("pointerdown", () => {
      // TODO: Start new game scene
      continueBtn.setColor("#0ff");
      newGameBtn.setColor("#ff0");
    });

    continueBtn.on("pointerdown", () => {
      // TODO: Continue game logic
      newGameBtn.setColor("#0ff");
      continueBtn.setColor("#ff0");
    });
  }
}
