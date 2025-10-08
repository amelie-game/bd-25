import Phaser from "phaser";

declare global {
  interface Window {
    /** Optional global Phaser game instance exposed for debug/HUD rendering */
    game?: Phaser.Game;
  }
}

export {};
