// Type-only import for Phaser types
import type PhaserType from "phaser";

// Module context for global augmentation
export {};
declare global {
  interface Window {
    Phaser?: typeof PhaserType;
  }
}

// Dynamically load Phaser, then run the game code
function loadPhaserAndRun(main: () => void): void {
  if (window.Phaser) return main();
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.js";
  script.onload = main;
  document.head.appendChild(script);
}

loadPhaserAndRun(() => {
  const tileSize = 48;
  const gridWidth = 10;
  const gridHeight = 8;
  // 0 = empty, 1 = block
  const worldTiles: number[][] = Array.from({ length: gridWidth }, () =>
    Array(gridHeight).fill(0)
  );

  // Use PhaserType for type checking
  type SceneType = PhaserType.Scene;

  function preload(this: SceneType): void {
    this.load.image("block", "https://labs.phaser.io/assets/sprites/block.png");
  }

  function create(this: SceneType): void {
    this.input.on("pointerdown", (pointer: any) => {
      // Use 'any' for pointer since Phaser types may not be available at runtime
      const tileX = Math.floor(pointer.worldX / tileSize);
      const tileY = Math.floor(pointer.worldY / tileSize);
      if (
        tileX >= 0 &&
        tileX < gridWidth &&
        tileY >= 0 &&
        tileY < gridHeight &&
        worldTiles[tileX][tileY] === 0
      ) {
        worldTiles[tileX][tileY] = 1;
        // Add a block sprite that fills the tile (48x48)
        const block = this.add.sprite(
          tileX * tileSize + tileSize / 2,
          tileY * tileSize + tileSize / 2,
          "block"
        );
        block.displayWidth = tileSize;
        block.displayHeight = tileSize;
      }
    });
    // Draw grid lines for clarity
    for (let x = 0; x <= gridWidth; x++) {
      this.add
        .line(
          0,
          0,
          x * tileSize,
          0,
          x * tileSize,
          gridHeight * tileSize,
          0x888888
        )
        .setOrigin(0);
    }
    for (let y = 0; y <= gridHeight; y++) {
      this.add
        .line(
          0,
          0,
          0,
          y * tileSize,
          gridWidth * tileSize,
          y * tileSize,
          0x888888
        )
        .setOrigin(0);
    }
  }

  // Use PhaserType for config typing
  const config: PhaserType.Types.Core.GameConfig = {
    type: window.Phaser ? window.Phaser.AUTO : 0,
    width: tileSize * gridWidth,
    height: tileSize * gridHeight,
    backgroundColor: "#bada55",
    parent: "game-container",
    scene: {
      preload,
      create,
    },
  };

  // @ts-ignore: Phaser is loaded dynamically
  new window.Phaser!.Game(config);
});
