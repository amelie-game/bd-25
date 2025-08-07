import Phaser from "phaser";
import { TitleScene } from "./scenes/TitleScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 480,
  height: 320,
  parent: "game",
  scene: [TitleScene],
  backgroundColor: "#222",
};

new Phaser.Game(config);
