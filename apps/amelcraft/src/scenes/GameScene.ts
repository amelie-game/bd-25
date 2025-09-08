import Phaser from "phaser";
import { TILE_SIZE } from "../main";

// Dimensions for the simple tile world
const WORLD_COLS = 100;
const WORLD_ROWS = 100;

export class GameScene extends Phaser.Scene {
  private layerGraphics!: Phaser.GameObjects.Graphics;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private camera!: Phaser.Cameras.Scene2D.Camera;
  private player!: Phaser.GameObjects.Rectangle;
  private worldPixelWidth = WORLD_COLS * TILE_SIZE;
  private worldPixelHeight = WORLD_ROWS * TILE_SIZE;
  private minZoom = 0.2;
  private maxZoom = 1;
  private lastPinchDist: number | null = null;
  // Camera always follows player; panning removed per latest requirement

  constructor() {
    super("GameScene");
  }

  preload() {}

  create() {
    this.camera = this.cameras.main;

    // Simple player representation
    const startX = (WORLD_COLS / 2) * TILE_SIZE + TILE_SIZE / 2;
    const startY = (WORLD_ROWS / 2) * TILE_SIZE + TILE_SIZE / 2;
    this.player = this.add.rectangle(
      startX,
      startY,
      TILE_SIZE,
      TILE_SIZE,
      0x00ffcc
    );
    this.player.setOrigin(0.5);

    this.physics.add.existing(this.player, false);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);

    // Setup camera to follow player
    this.camera.startFollow(this.player, true, 0.1, 0.1);
    this.camera.setBounds(0, 0, this.worldPixelWidth, this.worldPixelHeight);
    this.computeZoomBounds();
    // Initial zoom set to 1 clamped in range
    this.camera.setZoom(Phaser.Math.Clamp(1, this.minZoom, this.maxZoom));

    // Draw a minimal tile grid (performance: only draw grid lines once)
    this.layerGraphics = this.add.graphics();
    this.drawGrid();

    // Keyboard cursors (optional fallback)
    // Create cursor keys (keyboard plugin should exist in a standard Phaser scene, but add fallback)
    this.cursors = this.input.keyboard
      ? this.input.keyboard.createCursorKeys()
      : ({} as any);

    // Pointer drag movement controlling the player
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (p.isDown) {
        const speed = 400;
        const angle = Phaser.Math.Angle.Between(
          this.player.x,
          this.player.y,
          p.worldX,
          p.worldY
        );
        body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      }
    });
    this.input.on("pointerup", () => {
      body.setVelocity(0, 0);
    });

    // Wheel zoom (desktop)
    const canvas = this.game.canvas;
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        this.setZoom(this.camera.zoom * factor);
      },
      { passive: false }
    );

    // Touch pinch zoom
    canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      }
    });
    canvas.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 2 && this.lastPinchDist !== null) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const newDist = Math.sqrt(dx * dx + dy * dy);
          const ratio = newDist / this.lastPinchDist;
          this.setZoom(this.camera.zoom * ratio);
          this.lastPinchDist = newDist;
          e.preventDefault();
        }
      },
      { passive: false }
    );
    canvas.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) this.lastPinchDist = null;
    });

    // Recompute zoom bounds when scale changes
    this.scale.on("resize", () => {
      this.computeZoomBounds();
      this.setZoom(this.camera.zoom); // clamp current zoom within new bounds
    });
  }

  private drawGrid() {
    const g = this.layerGraphics;
    g.clear();
    g.lineStyle(1, 0x444444, 0.4);
    for (let x = 0; x <= this.worldPixelWidth; x += TILE_SIZE) {
      g.moveTo(x, 0);
      g.lineTo(x, this.worldPixelHeight);
    }
    for (let y = 0; y <= this.worldPixelHeight; y += TILE_SIZE) {
      g.moveTo(0, y);
      g.lineTo(this.worldPixelWidth, y);
    }
    g.strokePath();
  }

  private computeZoomBounds() {
    // Enforce: user must never zoom out beyond seeing all 100 horizontal tiles.
    // Visible horizontal tiles = camera.displayWidth / TILE_SIZE = (cam.width / zoom) / TILE_SIZE
    // To cap at 100 tiles: zoom >= cam.width / (100 * TILE_SIZE)
    const cam = this.camera;
    const fitWorldWidthZoom = cam.width / this.worldPixelWidth; // zoom at which full 100 tiles exactly fit horizontally
    // Minimum allowed zoom is exactly the zoom that fits world width. (Not using height so we never show space beyond right edge.)
    this.minZoom = fitWorldWidthZoom;
    // Max zoom: only 8 tiles visible horizontally (or at least 1.0 if screen narrower than 8 tiles). This keeps tiles large.
    const eightTilesZoom = cam.width / (8 * TILE_SIZE);
    this.maxZoom = Math.max(1, eightTilesZoom);
    if (this.maxZoom < this.minZoom) this.maxZoom = this.minZoom + 0.0001; // ensure a tiny range if device is very small
  }

  private setZoom(z: number) {
    const clamped = Phaser.Math.Clamp(z, this.minZoom, this.maxZoom);
    this.camera.setZoom(clamped);
    this.clampCamera();
  }

  private clampCamera() {
    // Ensure camera view stays within world bounds after zooming
    const cam = this.camera;
    const maxScrollX = this.worldPixelWidth - cam.displayWidth / cam.zoom;
    const maxScrollY = this.worldPixelHeight - cam.displayHeight / cam.zoom;
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, Math.max(0, maxScrollX));
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, Math.max(0, maxScrollY));
  }

  update(time: number, delta: number) {
    // Keyboard movement fallback
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const speed = 300;
    let vx = 0;
    let vy = 0;
    if (this.cursors.left?.isDown) vx -= speed;
    if (this.cursors.right?.isDown) vx += speed;
    if (this.cursors.up?.isDown) vy -= speed;
    if (this.cursors.down?.isDown) vy += speed;
    if (vx !== 0 || vy !== 0) {
      body.setVelocity(vx, vy);
    } else if (!this.input.activePointer.isDown) {
      body.setVelocity(0, 0);
    }
  }
}
