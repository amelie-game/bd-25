import Phaser from "phaser";
import { TILE_SIZE } from "../main";

// Dimensions for the simple tile world
const WORLD_COLS = 100;
const WORLD_ROWS = 100;

export class GameScene extends Phaser.Scene {
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private camera!: Phaser.Cameras.Scene2D.Camera;
  private player!: Phaser.GameObjects.Sprite;
  private isDragging = false;
  private target: { x: number; y: number } | null = null;
  private moveSpeed = 248; // pixels per second (from PoC)
  private lastDirection: "right" | "left" | "up" | "down" = "down";
  private worldPixelWidth = WORLD_COLS * TILE_SIZE;
  private worldPixelHeight = WORLD_ROWS * TILE_SIZE;
  private minZoom = 0.2;
  private maxZoom = 1;
  private lastPinchDist: number | null = null;
  private cameraMarginFraction = 0.1; // dead-zone margin fraction
  // Camera always follows player; panning removed per latest requirement

  constructor() {
    super("GameScene");
  }

  preload() {}

  create() {
    this.camera = this.cameras.main;
    this.camera.roundPixels = true;

    // Player sprite using amelie atlas (preloaded in TitleScene)
    const startX = (WORLD_COLS / 2) * TILE_SIZE + TILE_SIZE / 2;
    const startY = (WORLD_ROWS / 2) * TILE_SIZE + TILE_SIZE / 2;
    this.player = this.add.sprite(startX, startY, "amelie", "50"); // default to first walk-right frame
    this.player.setOrigin(0.5, 0.75); // feet alignment
    // Disable smoothing (important for crisp pixel art)
    (this.player as any).setSmooth && (this.player as any).setSmooth(false);
    this.createPlayerAnimations();
    this.player.play("idle-down");

    // Manual camera control (dead-zone) instead of continuous follow
    this.camera.setBounds(0, 0, this.worldPixelWidth, this.worldPixelHeight);
    this.computeZoomBounds();
    // Initial zoom set to 1 clamped in range
    this.camera.setZoom(Phaser.Math.Clamp(1, this.minZoom, this.maxZoom));

    // Create ground tilemap layer filled with tile index 10
    const map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: WORLD_COLS,
      height: WORLD_ROWS,
    });
    const tileset = map.addTilesetImage("blocks");
    // Fallback: if not found, add manually from cache texture
    const ts =
      tileset ??
      map.addTilesetImage("blocks", undefined, TILE_SIZE, TILE_SIZE, 0, 0);
    const layer = map.createBlankLayer("ground", ts!);
    if (!layer) {
      // Fallback: if layer creation failed, skip silently
      // (Should not happen if tileset is valid.)
    } else {
      this.groundLayer = layer as Phaser.Tilemaps.TilemapLayer;
      this.groundLayer.fill(10, 0, 0, WORLD_COLS, WORLD_ROWS);
      this.groundLayer.setDepth(0);
    }
    this.player.setDepth(1);

    // Keyboard cursors (optional fallback)
    // Create cursor keys (keyboard plugin should exist in a standard Phaser scene, but add fallback)
    this.cursors = this.input.keyboard
      ? this.input.keyboard.createCursorKeys()
      : ({} as any);

    // Pointer drag movement (PoC style)
    const canvas = this.game.canvas;
    let pointerMoveHandler: ((ev: PointerEvent) => void) | null = null;
    let pointerUpHandler: (() => void) | null = null;
    canvas.addEventListener("pointerdown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const world = this.screenToWorld(localX, localY);
      this.isDragging = true;
      this.target = { x: world.x, y: world.y };
      pointerMoveHandler = (ev: PointerEvent) => {
        if (this.isDragging) {
          const lx = ev.clientX - rect.left;
          const ly = ev.clientY - rect.top;
          const w = this.screenToWorld(lx, ly);
          this.target = { x: w.x, y: w.y };
        }
      };
      canvas.addEventListener("pointermove", pointerMoveHandler);
      pointerUpHandler = () => {
        this.isDragging = false;
        this.target = null;
        if (pointerMoveHandler)
          canvas.removeEventListener("pointermove", pointerMoveHandler);
        if (pointerUpHandler)
          canvas.removeEventListener("pointerup", pointerUpHandler);
      };
      canvas.addEventListener("pointerup", pointerUpHandler, { once: true });
    });

    // Wheel zoom (desktop)
    // (canvas already defined above)
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

  // Grid removed; ground now represented by tilemap

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
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const maxScrollX = this.worldPixelWidth - viewW;
    const maxScrollY = this.worldPixelHeight - viewH;
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, Math.max(0, maxScrollX));
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, Math.max(0, maxScrollY));
  }

  update(time: number, delta: number) {
    // Keyboard movement fallback
    // Pointer drag movement update (PoC logic: horizontal then vertical)
    const previousX = this.player.x;
    const previousY = this.player.y;
    if (this.isDragging && this.target) {
      const dx = this.target.x - this.player.x;
      const dy = this.target.y - this.player.y;
      const step = this.moveSpeed * (delta / 1000);
      const snap = 2; // pixel threshold
      if (Math.abs(dx) > snap) {
        // Horizontal movement first
        if (Math.abs(dx) < step) {
          this.player.x = this.target.x;
        } else {
          this.player.x += step * Math.sign(dx);
        }
        this.lastDirection = dx < 0 ? "left" : "right";
        this.player.play(`walk-${this.lastDirection}`, true);
      } else if (Math.abs(dy) > snap) {
        if (Math.abs(dy) < step) {
          this.player.y = this.target.y;
        } else {
          this.player.y += step * Math.sign(dy);
        }
        this.lastDirection = dy < 0 ? "up" : "down";
        this.player.play(`walk-${this.lastDirection}`, true);
      } else {
        // Arrived
        this.player.x = this.target.x;
        this.player.y = this.target.y;
        this.player.play(`idle-${this.lastDirection}`, true);
      }
    } else {
      // Idle
      this.player.play(`idle-${this.lastDirection}`, true);
    }

    // Camera dead-zone handling
    this.updateCameraDeadZone();
  }

  private createPlayerAnimations() {
    // Helper to create animation from numeric frame range
    const make = (
      key: string,
      start: number,
      end: number,
      frameRate = 8,
      repeat = -1
    ) => {
      if (this.anims.exists(key)) return;
      const frames: Phaser.Types.Animations.AnimationFrame[] = [];
      for (let i = start; i <= end; i++)
        frames.push({ key: "amelie", frame: i.toString() });
      this.anims.create({ key, frames, frameRate, repeat });
    };
    // Idle (loop slowly)
    make("idle-right", 10, 15, 6);
    make("idle-up", 20, 25, 6);
    make("idle-left", 30, 35, 6);
    make("idle-down", 40, 45, 6);
    // Walk (faster)
    make("walk-right", 50, 55, 10);
    make("walk-up", 60, 65, 10);
    make("walk-left", 70, 75, 10);
    make("walk-down", 80, 85, 10);
  }

  private updateCameraDeadZone() {
    const cam = this.camera;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const marginX = viewW * this.cameraMarginFraction;
    const marginY = viewH * this.cameraMarginFraction;
    const leftEdge = cam.scrollX + marginX;
    const rightEdge = cam.scrollX + viewW - marginX;
    const topEdge = cam.scrollY + marginY;
    const bottomEdge = cam.scrollY + viewH - marginY;
    let changed = false;
    if (this.player.x < leftEdge) {
      cam.scrollX = this.player.x - marginX;
      changed = true;
    } else if (this.player.x > rightEdge) {
      cam.scrollX = this.player.x + marginX - viewW;
      changed = true;
    }
    if (this.player.y < topEdge) {
      cam.scrollY = this.player.y - marginY;
      changed = true;
    } else if (this.player.y > bottomEdge) {
      cam.scrollY = this.player.y + marginY - viewH;
      changed = true;
    }
    if (changed) this.clampCamera();
  }

  private screenToWorld(screenX: number, screenY: number) {
    const cam = this.camera;
    return {
      x: cam.scrollX + screenX / cam.zoom,
      y: cam.scrollY + screenY / cam.zoom,
    };
  }
}
