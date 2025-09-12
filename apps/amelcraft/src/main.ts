import Phaser from "phaser";
import { TitleScene } from "./scenes/TitleScene";
import { GameScene } from "./scenes/GameScene";

// Shared constants
const TILE_SIZE = 48;

function getViewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

const { width, height } = getViewportSize();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width,
  height,
  parent: "game",
  backgroundColor: "#222",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  scene: [TitleScene, GameScene],
};

const game = new Phaser.Game(config);

// Handle window resize (RESIZE scale mode changes canvas automatically; we forward event if needed elsewhere)
window.addEventListener("resize", () => {
  // Nothing else required here currently; scenes can listen to scale resize event
});

// Export constants if needed by scenes (future use)
export { TILE_SIZE };
