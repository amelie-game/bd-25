// Dynamically load Phaser, then run the game code
function loadPhaserAndRun(main) {
  if (window.Phaser) return main();
  var script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.js";
  script.onload = main;
  document.head.appendChild(script);
}

loadPhaserAndRun(function () {
  const tileSize = 48;
  const maxWidth = 1280;
  const maxHeight = 800;

  function getResponsiveConfig() {
    const width = Math.min(window.innerWidth, maxWidth);
    const height = Math.min(window.innerHeight, maxHeight);
    return { width, height };
  }

  const { width, height } = getResponsiveConfig();

  const config = {
    type: Phaser.AUTO,
    parent: "game-container",
    width,
    height,
    backgroundColor: "#333",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: {
      preload,
      create,
      update,
    },
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
  };

  let player;
  let camera;
  let gridGraphics;
  let debugText;
  let gridPixelWidth = 0;
  let gridPixelHeight = 0;

  function preload() {
    // Placeholder: load a simple square as player
    this.textures.generate("player", { data: ["3"], pixelWidth: tileSize });
  }

  function drawGrid(gfx, width, height, tileSize) {
    gfx.clear();
    gfx.lineStyle(1, 0x888888, 0.5);
    gridPixelWidth = Math.round(width);
    gridPixelHeight = Math.round(height);
    // Vertical lines
    for (let x = 0; x <= width; x += tileSize) {
      gfx.beginPath();
      gfx.moveTo(x, 0);
      gfx.lineTo(x, height);
      gfx.strokePath();
    }
    // Horizontal lines
    for (let y = 0; y <= height; y += tileSize) {
      gfx.beginPath();
      gfx.moveTo(0, y);
      gfx.lineTo(width, y);
      gfx.strokePath();
    }
  }

  function create() {
    // Add grid graphics
    gridGraphics = this.add.graphics();

    // Initialize camera before using it
    camera = this.cameras.main;

    // Initial zoom calculation (revert to 8 tiles)
    function setMinTileZoomAndPlayer(useCameraDisplay = false) {
      const minTiles = 8;
      // Use camera.displayWidth/displayHeight only after resize, otherwise use this.scale.width/height
      const viewWidth = useCameraDisplay
        ? camera.displayWidth
        : this.scale.width;
      const viewHeight = useCameraDisplay
        ? camera.displayHeight
        : this.scale.height;
      // Guarantee at least minTiles fully visible on both axes
      let zoomX = viewWidth / (tileSize * minTiles);
      let zoomY = viewHeight / (tileSize * minTiles);
      let zoom = Math.min(zoomX, zoomY);
      // Adjust zoom so that floor(viewHeight / (tileSize * zoom)) >= minTiles
      while (Math.floor(viewHeight / (tileSize * zoom)) < minTiles) {
        zoom *= 0.99; // decrease zoom slightly until enough tiles fit
      }
      while (Math.floor(viewWidth / (tileSize * zoom)) < minTiles) {
        zoom *= 0.99;
      }
      camera.setZoom(zoom);
      // Draw grid 2 tiles wider and higher than visible area
      const gridWidth = viewWidth / zoom + tileSize * 2;
      const gridHeight = viewHeight / zoom + tileSize * 2;
      drawGrid(gridGraphics, gridWidth, gridHeight, tileSize);

      // Calculate most centered grid cell in the drawn grid
      const cols = Math.floor(gridWidth / tileSize);
      const rows = Math.floor(gridHeight / tileSize);
      const centerCol = Math.floor(cols / 2);
      const centerRow = Math.floor(rows / 2);
      const centerX = centerCol * tileSize + tileSize / 2;
      const centerY = centerRow * tileSize + tileSize / 2;

      // Add or move player sprite in most centered grid cell
      if (!player) {
        player = this.physics.add.sprite(centerX, centerY, "player");
        player.setDisplaySize(tileSize, tileSize);
        player.setCollideWorldBounds(true);
        camera.startFollow(player, true, 0.1, 0.1);
      } else {
        player.x = centerX;
        player.y = centerY;
      }
    }
    setMinTileZoomAndPlayer.call(this, false);

    // Add debug text object
    debugText = this.add
      .text(8, 8, "", {
        font: "16px monospace",
        fill: "#ff4444",
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: { x: 8, y: 4 },
        align: "left",
        fixedWidth: 400,
      })
      .setScrollFactor(0);

    // Handle window resize
    window.addEventListener("resize", () => {
      const { width: newWidth, height: newHeight } = getResponsiveConfig();
      this.scale.resize(newWidth, newHeight);
      setTimeout(() => {
        setMinTileZoomAndPlayer.call(this, true);
      }, 0);
    });
  }

  function update() {
    // Print debug info
    if (debugText && camera) {
      const zoom = camera.zoom;
      const fullTilesX = Math.floor(camera.displayWidth / tileSize);
      const fullTilesY = Math.floor(camera.displayHeight / tileSize);
      const visibleGridState = {
        cameraDisplayWidth: camera.displayWidth,
        cameraDisplayHeight: camera.displayHeight,
        tileSize,
        fullTilesX,
        fullTilesY,
        gridPixelWidth,
        gridPixelHeight,
        zoom,
        configWidth: width,
        configHeight: height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      };
      debugText.setText(
        `Container: ${window.innerWidth} x ${window.innerHeight}\n` +
          `Visible Game World: ${Math.round(
            camera.displayWidth
          )} x ${Math.round(camera.displayHeight)}\n` +
          `Total Grid: ${Math.floor(gridPixelWidth / tileSize)} x ${Math.floor(
            gridPixelHeight / tileSize
          )}\n` +
          `Visible Grid: ${fullTilesX} x ${fullTilesY}\n` +
          `Camera Zoom: ${zoom.toFixed(2)}`
      );
    }
  }

  new Phaser.Game(config);
});
