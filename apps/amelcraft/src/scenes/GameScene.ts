import Phaser from "phaser";
import { TILE_SIZE } from "../main";
import { assets } from "../assets";

// Dimensions for the simple tile world
const WORLD_COLS = 100;
const WORLD_ROWS = 100;

export class GameScene extends Phaser.Scene {
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
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
    // Use the first walk-right frame from assets.amelie.animations or fallback to frame index "50"
    const defaultFrame = "50";
    this.player = this.add.sprite(
      startX,
      startY,
      assets.amelie.key,
      defaultFrame
    );
    this.player.setOrigin(0.5, 0.75); // feet alignment
    // Disable smoothing (important for crisp pixel art)
    (this.player as any).setSmooth && (this.player as any).setSmooth(false);
    // Animations are now created in TitleScene using createFromAseprite
    this.player.play(assets.amelie.animations.AmelieIdleDown);

    // Manual camera control (dead-zone) instead of continuous follow
    this.camera.setBounds(0, 0, this.worldPixelWidth, this.worldPixelHeight);
    this.computeZoomBounds();
    // Initial zoom set to 1 clamped in range
    this.camera.setZoom(Phaser.Math.Clamp(1, this.minZoom, this.maxZoom));

    // Create ground tilemap layer filled with tile index for water
    const map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: WORLD_COLS,
      height: WORLD_ROWS,
    });
    const tileset = map.addTilesetImage(assets.blocks.key);
    // Fallback: if not found, add manually from cache texture
    const ts =
      tileset ??
      map.addTilesetImage(
        assets.blocks.key,
        undefined,
        TILE_SIZE,
        TILE_SIZE,
        0,
        0
      );
    const layer = map.createBlankLayer("ground", ts!);
    if (!layer) {
      // Fallback: if layer creation failed, skip silently
      // (Should not happen if tileset is valid.)
    } else {
      this.groundLayer = layer as Phaser.Tilemaps.TilemapLayer;
      // Generate island terrain (grass & water)
      this.groundLayer.fill(
        Number(assets.blocks.sprites.Water),
        0,
        0,
        WORLD_COLS,
        WORLD_ROWS
      ); // start as water
      this.generateIsland();
      this.groundLayer.setDepth(0);
    }
    this.player.setDepth(1);

    // (Keyboard cursors removed for now)

    // Pointer drag movement using Phaser input (zoom aware)
    this.setupPointerControls();

    const canvas = this.game.canvas;

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
    // Helper to get animation key from assets map
    const getAnim = (
      type: "walk" | "idle",
      dir: "right" | "left" | "up" | "down"
    ) => {
      if (type === "walk") {
        switch (dir) {
          case "right":
            return assets.amelie.animations.AmelieWalkRight;
          case "left":
            return assets.amelie.animations.AmelieWalkLeft;
          case "up":
            return assets.amelie.animations.AmelieWalkUp;
          case "down":
            return assets.amelie.animations.AmelieWalkDown;
        }
      } else {
        switch (dir) {
          case "right":
            return assets.amelie.animations.AmelieIdleRight;
          case "left":
            return assets.amelie.animations.AmelieIdleLeft;
          case "up":
            return assets.amelie.animations.AmelieIdleUp;
          case "down":
            return assets.amelie.animations.AmelieIdleDown;
        }
      }
    };

    // Keyboard movement fallback
    // Pointer drag movement update (PoC logic: horizontal then vertical)
    if (this.isDragging && this.target) {
      const feetX = this.player.x;
      const feetY = this.player.y; // origin already biased to feet
      const dx = this.target.x - feetX;
      const dy = this.target.y - feetY;
      const step = this.moveSpeed * (delta / 1000);
      const snap = 2; // pixel threshold for snapping to target
      let moved = false;

      // Attempt horizontal movement first (classic Zelda style), but only if walkable
      if (Math.abs(dx) > snap) {
        const moveX = Math.sign(dx) * Math.min(step, Math.abs(dx));
        const newX = feetX + moveX;
        if (this.isWalkable(newX, feetY)) {
          this.player.x = newX;
          this.lastDirection = dx < 0 ? "left" : "right";
          this.player.play(getAnim("walk", this.lastDirection), true);
          moved = true;
        }
      }
      // If horizontal either done or blocked, try vertical
      if (!moved && Math.abs(dy) > snap) {
        const moveY = Math.sign(dy) * Math.min(step, Math.abs(dy));
        const newY = feetY + moveY;
        if (this.isWalkable(feetX, newY)) {
          this.player.y = newY;
          this.lastDirection = dy < 0 ? "up" : "down";
          this.player.play(getAnim("walk", this.lastDirection), true);
          moved = true;
        }
      }

      const arrived = Math.abs(dx) <= snap && Math.abs(dy) <= snap;
      if (!moved) {
        if (arrived) {
          // Snap to target if target tile itself is walkable
          if (this.isWalkable(this.target.x, this.target.y)) {
            this.player.x = this.target.x;
            this.player.y = this.target.y;
          }
          this.player.play(getAnim("idle", this.lastDirection), true);
          this.isDragging = false; // stop further processing
        } else {
          // Path blocked (likely water). If target itself isn't walkable, cancel drag.
          if (!this.isWalkable(this.target.x, this.target.y)) {
            this.isDragging = false;
            this.target = null;
            this.player.play(getAnim("idle", this.lastDirection), true);
          } else {
            // Still en route but blocked this frame (corner); stay idle anim facing last direction
            this.player.play(getAnim("idle", this.lastDirection), true);
          }
        }
      }
    } else {
      this.player.play(getAnim("idle", this.lastDirection), true);
    }

    // Camera dead-zone handling
    this.updateCameraDeadZone();
  }

  // Animations are now created in TitleScene using createFromAseprite

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

  // --- World Generation Helpers ---
  private generateIsland() {
    if (!this.groundLayer) return;
    const GRASS = Number(assets.blocks.sprites.Grass); // tileset index for grass
    const WATER = Number(assets.blocks.sprites.Water); // tileset index for water
    const width = WORLD_COLS;
    const height = WORLD_ROWS;
    const total = width * height;
    // Target grass ratio between 0.60 and 0.80
    const targetRatio = Phaser.Math.FloatBetween(0.63, 0.77);
    const cx = width / 2;
    const cy = height / 2;
    // Random elliptical radii (gives large-scale variety)
    const baseArea = targetRatio * total;
    const baseRadius = Math.sqrt(baseArea / Math.PI);
    const radX = baseRadius * Phaser.Math.FloatBetween(0.9, 1.35);
    const radY = baseRadius * Phaser.Math.FloatBetween(0.85, 1.25);

    // Layered value noise parameters
    const off1x = Math.random() * 1000;
    const off1y = Math.random() * 1000;
    const off2x = Math.random() * 2000;
    const off2y = Math.random() * 2000;
    const off3x = Math.random() * 3000;
    const off3y = Math.random() * 3000;
    const s1 = Phaser.Math.FloatBetween(0.025, 0.045); // large features
    const s2 = s1 * 2.3; // medium
    const s3 = s1 * 5.1; // small
    const noiseScale = Phaser.Math.FloatBetween(0.32, 0.4); // influence of noise on shoreline

    // Prepare mask
    const mask: boolean[][] = Array.from({ length: width }, () =>
      Array<boolean>(height).fill(false)
    );
    let grassCount = 0;

    const valueNoise = (x: number, y: number): number => {
      // 2D value noise with bilinear interpolation & smoothstep
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const smooth = (t: number) => t * t * (3 - 2 * t);
      const rnd = (ix: number, iy: number) => {
        let n = ix * 374761393 + iy * 668265263;
        n = (n ^ (n >> 13)) * 1274126177;
        n = n ^ (n >> 16);
        return (n & 0xffffffff) / 0xffffffff; // 0..1
      };
      const v00 = rnd(xi, yi);
      const v10 = rnd(xi + 1, yi);
      const v01 = rnd(xi, yi + 1);
      const v11 = rnd(xi + 1, yi + 1);
      const sx = smooth(xf);
      const sy = smooth(yf);
      const ix0 = Phaser.Math.Linear(v00, v10, sx);
      const ix1 = Phaser.Math.Linear(v01, v11, sx);
      const v = Phaser.Math.Linear(ix0, ix1, sy);
      return v * 2 - 1; // -1..1
    };

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const dx = x - cx + 0.5;
        const dy = y - cy + 0.5;
        const distNorm = Math.sqrt(
          (dx * dx) / (radX * radX) + (dy * dy) / (radY * radY)
        );
        // Layered coherent noise (multi-octave)
        const n1 = valueNoise(x * s1 + off1x, y * s1 + off1y);
        const n2 = valueNoise(x * s2 + off2x, y * s2 + off2y);
        const n3 = valueNoise(x * s3 + off3x, y * s3 + off3y);
        const layered = 0.55 * n1 + 0.3 * n2 + 0.15 * n3; // already in -1..1 range weighting
        // Adjust shoreline: subtract noise so negative noise pushes outward (larger island in some lobes)
        const shape = distNorm - layered * noiseScale;
        const inside = shape < 1;
        if (inside) {
          mask[x][y] = true;
          grassCount++;
        }
      }
    }

    // Edge smoothing (same approach as before)
    const dirs8 = [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      /*self*/ [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ];
    const smoothPass = () => {
      const copy = mask.map((c) => c.slice());
      for (let x = 1; x < width - 1; x++) {
        for (let y = 1; y < height - 1; y++) {
          let count = 0;
          for (const [dx, dy] of dirs8) if (copy[x + dx][y + dy]) count++;
          if (count >= 5) mask[x][y] = true;
          else if (count <= 2) mask[x][y] = false;
        }
      }
    };
    smoothPass();
    smoothPass();

    // Recount after smoothing
    grassCount = 0;
    for (let x = 0; x < width; x++)
      for (let y = 0; y < height; y++) if (mask[x][y]) grassCount++;
    let ratio = grassCount / total;

    // Ratio adjustment to stay within [0.6,0.8]
    if (ratio < 0.6 || ratio > 0.8) {
      const edgeGrass: Array<[number, number]> = [];
      const edgeWater: Array<[number, number]> = [];
      const dirs4 = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (let x = 1; x < width - 1; x++) {
        for (let y = 1; y < height - 1; y++) {
          const isGrass = mask[x][y];
          let boundary = false;
          for (const [dx, dy] of dirs4) {
            const nx = x + dx,
              ny = y + dy;
            if (mask[nx][ny] !== isGrass) {
              boundary = true;
              break;
            }
          }
          if (boundary) (isGrass ? edgeGrass : edgeWater).push([x, y]);
        }
      }
      if (ratio < 0.6) {
        Phaser.Utils.Array.Shuffle(edgeWater);
        for (const [x, y] of edgeWater) {
          if (ratio >= 0.6) break;
          if (!mask[x][y]) {
            mask[x][y] = true;
            grassCount++;
            ratio = grassCount / total;
          }
        }
      } else {
        Phaser.Utils.Array.Shuffle(edgeGrass);
        for (const [x, y] of edgeGrass) {
          if (ratio <= 0.8) break;
          if (mask[x][y]) {
            mask[x][y] = false;
            grassCount--;
            ratio = grassCount / total;
          }
        }
      }
    }

    // Apply tiles
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        this.groundLayer.putTileAt(mask[x][y] ? GRASS : WATER, x, y);
      }
    }
  }

  private setupPointerControls() {
    // Use Phaser's pointer events to get accurate worldX/worldY regardless of zoom/scroll
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.isWalkable(p.worldX, p.worldY)) return; // ignore clicks on water
      this.isDragging = true;
      this.target = { x: p.worldX, y: p.worldY };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      if (!this.isWalkable(p.worldX, p.worldY)) return; // don't update target onto water
      this.target = { x: p.worldX, y: p.worldY };
    });
    this.input.on("pointerup", () => {
      this.isDragging = false;
      this.target = null;
    });
    this.input.on("pointerupoutside", () => {
      this.isDragging = false;
      this.target = null;
    });
  }

  // Determine if a world position is walkable (currently grass tile index 10)
  private isWalkable(worldX: number, worldY: number): boolean {
    if (!this.groundLayer) return false;
    const tile = this.groundLayer.getTileAtWorldXY(worldX, worldY, true);
    if (!tile) return false;
    return tile.index === Number(assets.blocks.sprites.Grass); // grass
  }
}
