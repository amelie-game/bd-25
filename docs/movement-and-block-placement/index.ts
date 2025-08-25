// Dynamically load Phaser, then run the game code
function loadPhaserAndRun(main) {
  if (window.Phaser) return main();
  var script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.js";
  script.onload = main;
  document.head.appendChild(script);
}

// @ts-ignore: Phaser is loaded dynamically
declare var Phaser: any;
loadPhaserAndRun(function () {
  let player: any;
  let isDragging = false;
  let target: { x: number; y: number } | null = null;
  const moveSpeed = 248; // pixels per second
  const tileSize = 48;
  const gridWidth = 20;
  const gridHeight = 15;

  // Animation frame rate calculation
  const animFrameRate = Math.max(4, Math.min(12, Math.round(moveSpeed / 32)));

  // Game state
  const worldTiles: number[][] = Array.from({ length: gridWidth }, () =>
    Array(gridHeight).fill(0)
  );

  // Highlighted tiles around player
  let highlightedTiles: any[] = [];
  let debugBoundingBox: any = null; // Debug rectangle to show player bounds
  let gameScene: any;

  function preload() {
    // Load the 'dude' sprite sheet for player
    this.load.spritesheet(
      "player",
      "https://labs.phaser.io/assets/sprites/dude.png",
      {
        frameWidth: 32,
        frameHeight: 48,
      }
    );

    // Load block sprite for placement
    this.load.image("block", "https://labs.phaser.io/assets/sprites/block.png");
  }

  function create() {
    gameScene = this;

    // Create player at center of screen
    player = this.add.sprite(
      this.sys.game.config.width / 2,
      this.sys.game.config.height / 2,
      "player"
    );
    player.setScale(2);
    player.setDepth(100); // Ensure player is rendered above blocks

    // Define walking and idle animations
    this.anims.create({
      key: "left",
      frames: this.anims.generateFrameNumbers("player", { start: 0, end: 3 }),
      frameRate: animFrameRate,
      repeat: -1,
    });
    this.anims.create({
      key: "turn",
      frames: [{ key: "player", frame: 4 }],
      frameRate: Math.max(2, Math.round(animFrameRate * 2)),
    });
    this.anims.create({
      key: "right",
      frames: this.anims.generateFrameNumbers("player", { start: 5, end: 8 }),
      frameRate: animFrameRate,
      repeat: -1,
    });
    this.anims.create({
      key: "up",
      frames: this.anims.generateFrameNumbers("player", { start: 0, end: 3 }),
      frameRate: animFrameRate,
      repeat: -1,
    });
    this.anims.create({
      key: "down",
      frames: this.anims.generateFrameNumbers("player", { start: 5, end: 8 }),
      frameRate: animFrameRate,
      repeat: -1,
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
          0x444444
        )
        .setOrigin(0)
        .setAlpha(0.3);
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
          0x444444
        )
        .setOrigin(0)
        .setAlpha(0.3);
    }

    // Initial highlight of tiles around player
    updateHighlightedTiles();

    // Handle drag movement
    const canvas = this.sys.game.canvas;
    let pointerMoveHandler: ((ev: PointerEvent) => void) | null = null;
    let pointerUpHandler: (() => void) | null = null;

    canvas.addEventListener("pointerdown", (e) => {
      const worldX = e.offsetX;
      const worldY = e.offsetY;
      const tileX = Math.floor(worldX / tileSize);
      const tileY = Math.floor(worldY / tileSize);

      // Check if clicking on a highlighted tile for block placement
      if (isHighlightedTile(tileX, tileY)) {
        placeBlock(tileX, tileY);
        return;
      }

      // Otherwise start dragging
      isDragging = true;
      target = { x: worldX, y: worldY };

      pointerMoveHandler = (ev: PointerEvent) => {
        if (isDragging) {
          target = { x: ev.offsetX, y: ev.offsetY };
        }
      };
      canvas.addEventListener("pointermove", pointerMoveHandler);

      pointerUpHandler = () => {
        isDragging = false;
        target = null;
        if (pointerMoveHandler)
          canvas.removeEventListener("pointermove", pointerMoveHandler);
        if (pointerUpHandler)
          canvas.removeEventListener("pointerup", pointerUpHandler);
      };
      canvas.addEventListener("pointerup", pointerUpHandler);
    });
  }

  function getPlayerOccupiedTiles(): Array<{ x: number; y: number }> {
    // Adjust bounding box to match visible sprite size more accurately
    // Custom adjustments for better collision detection
    const baseWidth = 24 * 2; // 48px base
    const baseHeight = 36 * 2; // 72px base

    // Apply custom adjustments: 3px left, 1px right, -1px top, +11px bottom
    const left = player.x - baseWidth / 2 - 3; // 3 pixels wider to the left (was 2)
    const right = player.x + baseWidth / 2 + 1; // 1 pixel wider to the right
    const top = player.y - baseHeight / 2 + 1; // 1 pixel smaller from the top
    const bottom = player.y + baseHeight / 2 + 11; // 11 pixels bigger to the bottom (was 6)

    // Find all tiles that the player overlaps
    const occupiedTiles: Array<{ x: number; y: number }> = [];
    const leftTile = Math.floor(left / tileSize);
    const rightTile = Math.floor(right / tileSize);
    const topTile = Math.floor(top / tileSize);
    const bottomTile = Math.floor(bottom / tileSize);

    for (let x = leftTile; x <= rightTile; x++) {
      for (let y = topTile; y <= bottomTile; y++) {
        if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
          occupiedTiles.push({ x, y });
        }
      }
    }

    return occupiedTiles;
  }
  function updateHighlightedTiles() {
    // Clear existing highlights and debug box
    highlightedTiles.forEach((tile) => tile.destroy());
    highlightedTiles = [];
    if (debugBoundingBox) {
      debugBoundingBox.destroy();
      debugBoundingBox = null;
    }

    // Calculate and draw debug bounding box with custom adjustments
    const baseWidth = 24 * 2; // 48px base
    const baseHeight = 36 * 2; // 72px base

    // Apply same adjustments as collision detection: 3px left, 1px right, -1px top, +11px bottom
    const left = player.x - baseWidth / 2 - 3;
    const right = player.x + baseWidth / 2 + 1;
    const top = player.y - baseHeight / 2 + 1;
    const bottom = player.y + baseHeight / 2 + 11;

    // Calculate center and dimensions for the rectangle
    const rectCenterX = (left + right) / 2;
    const rectCenterY = (top + bottom) / 2;
    const rectWidth = right - left;
    const rectHeight = bottom - top;

    debugBoundingBox = gameScene.add.rectangle(
      rectCenterX,
      rectCenterY,
      rectWidth,
      rectHeight,
      0xff0000,
      0 // transparent fill
    );
    debugBoundingBox.setStrokeStyle(2, 0xff0000); // red border
    debugBoundingBox.setDepth(150); // Above everything else for debugging

    // Get tiles occupied by player
    const occupiedTiles = getPlayerOccupiedTiles();
    const occupiedSet = new Set(occupiedTiles.map((t) => `${t.x},${t.y}`));

    // Get all tiles around the occupied area
    const tilesToCheck = new Set<string>();
    occupiedTiles.forEach((tile) => {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const tileX = tile.x + dx;
          const tileY = tile.y + dy;
          if (
            tileX >= 0 &&
            tileX < gridWidth &&
            tileY >= 0 &&
            tileY < gridHeight
          ) {
            tilesToCheck.add(`${tileX},${tileY}`);
          }
        }
      }
    });

    // Highlight neighboring tiles that are not occupied by player
    tilesToCheck.forEach((tileKey) => {
      if (!occupiedSet.has(tileKey)) {
        const [tileX, tileY] = tileKey.split(",").map(Number);

        // Check if tile is empty
        if (worldTiles[tileX][tileY] === 0) {
          // Create highlight rectangle
          const highlight = gameScene.add.rectangle(
            tileX * tileSize + tileSize / 2,
            tileY * tileSize + tileSize / 2,
            tileSize,
            tileSize,
            0x00ff00,
            0.3
          );
          highlight.setStrokeStyle(2, 0x00ff00);
          highlight.setDepth(50); // Above blocks but below player
          highlightedTiles.push(highlight);
        }
      }
    });
  }

  function isHighlightedTile(tileX: number, tileY: number): boolean {
    // Get tiles occupied by player
    const occupiedTiles = getPlayerOccupiedTiles();
    const occupiedSet = new Set(occupiedTiles.map((t) => `${t.x},${t.y}`));

    // Check if this tile is occupied by player
    if (occupiedSet.has(`${tileX},${tileY}`)) {
      return false;
    }

    // Check if this tile is neighboring any occupied tile
    for (const occupiedTile of occupiedTiles) {
      const dx = Math.abs(tileX - occupiedTile.x);
      const dy = Math.abs(tileY - occupiedTile.y);
      if (dx <= 1 && dy <= 1) {
        // This tile is neighboring an occupied tile, check if it's empty
        return (
          tileX >= 0 &&
          tileX < gridWidth &&
          tileY >= 0 &&
          tileY < gridHeight &&
          worldTiles[tileX][tileY] === 0
        );
      }
    }

    return false;
  }

  function placeBlock(tileX: number, tileY: number) {
    if (
      tileX >= 0 &&
      tileX < gridWidth &&
      tileY >= 0 &&
      tileY < gridHeight &&
      worldTiles[tileX][tileY] === 0
    ) {
      worldTiles[tileX][tileY] = 1;

      // Add a block sprite underneath the player
      const block = gameScene.add.sprite(
        tileX * tileSize + tileSize / 2,
        tileY * tileSize + tileSize / 2,
        "block"
      );
      block.displayWidth = tileSize;
      block.displayHeight = tileSize;
      block.setDepth(10); // Below player and highlights

      // Update highlights since the grid changed
      updateHighlightedTiles();
    }
  }

  function update(time: number, delta: number) {
    const previousPlayerX = player.x;
    const previousPlayerY = player.y;

    if (isDragging && target) {
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const step = moveSpeed * (delta / 1000);
      const snapThreshold = 2; // pixels

      // Always walk horizontally first, then vertically
      if (Math.abs(dx) > snapThreshold) {
        // Move horizontally only
        if (Math.abs(dx) < step) {
          player.x = target.x;
        } else {
          player.x += step * Math.sign(dx);
        }
        // Play horizontal animation
        if (dx < 0) {
          player.anims.play("left", true);
        } else {
          player.anims.play("right", true);
        }
      } else if (Math.abs(dy) > snapThreshold) {
        // Only move vertically after horizontal is done
        if (Math.abs(dy) < step) {
          player.y = target.y;
        } else {
          player.y += step * Math.sign(dy);
        }
        // Play vertical animation
        if (dy < 0) {
          player.anims.play("up", true);
        } else {
          player.anims.play("down", true);
        }
      } else {
        // Snap to target and idle
        player.x = target.x;
        player.y = target.y;
        player.anims.play("turn");
      }
    } else {
      // Not moving, idle
      if (player && player.anims) player.anims.play("turn");
    }

    // Update highlighted tiles whenever player moves or is dragging
    // Since player can span multiple tiles, we need frequent updates
    if (
      isDragging ||
      Math.abs(player.x - previousPlayerX) > 0 ||
      Math.abs(player.y - previousPlayerY) > 0
    ) {
      updateHighlightedTiles();
    }
  }

  const config = {
    type: Phaser.AUTO,
    width: Math.min(window.innerWidth, tileSize * gridWidth),
    height: Math.min(window.innerHeight, tileSize * gridHeight),
    backgroundColor: "#87ceeb",
    parent: "game-container",
    scene: {
      preload,
      create,
      update,
    },
  };

  new Phaser.Game(config);
});
