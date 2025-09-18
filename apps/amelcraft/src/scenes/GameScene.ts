// ===================
// === DEPENDENCIES ===
// ===================
import Phaser from "phaser";
import "../hud/HUD.js";
import { TILE_SIZE } from "../main";
import { assets } from "../assets";

type Direction = "right" | "left" | "up" | "down";
type Movement = "walk" | "idle";

// ===================
// === CONFIGURATION ===
// ===================
// Block collection time in milliseconds
const COLLECT_BLOCK_TIME_MS = 1000;
const WORLD_COLS = 100;
const WORLD_ROWS = 100;
const INTERACT_RANGE = 2; // tiles
const MOVE_SPEED = 248; // pixels per second
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 1;
// ...other constants can be added here...

// ===================
// === GAME SCENE  ===
// ===================
export class GameScene extends Phaser.Scene {
  // Timer for delayed collection start (not Phaser timer)
  private pendingCollectionTimeout: any = null;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private camera!: Phaser.Cameras.Scene2D.Camera;
  private player!: Phaser.GameObjects.Sprite;
  private target: { x: number; y: number } | null = null;
  private pointerDownTime: number | null = null;
  private pointerDownTile: { x: number; y: number } | null = null;
  private collectingBlock: {
    x: number;
    y: number;
    startTime: number;
    timer: Phaser.Time.TimerEvent;
  } | null = null;
  private collectionProgress: number = 0;
  private highlightTile: { x: number; y: number } | null = null;
  private alwaysHighlightTiles: { x: number; y: number }[] = [];
  private INTERACT_RANGE = INTERACT_RANGE; // tiles
  private moveSpeed = MOVE_SPEED; // pixels per second (from PoC)
  private lastDirection: Direction = "down";
  private worldPixelWidth = WORLD_COLS * TILE_SIZE;
  private worldPixelHeight = WORLD_ROWS * TILE_SIZE;
  private minZoom = MIN_ZOOM;
  private maxZoom = MAX_ZOOM;
  private lastPinchDist: number | null = null;
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private hudEl: HTMLElement | null = null;
  private selectedTool: number | "dig" = "dig";

  constructor() {
    super("GameScene");
  }

  // ===================
  // === HELPERS: Direction, Animation, Tile, Range ===
  // ===================
  private getDirection(dx: number, dy: number): Direction {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? "right" : "left";
    } else if (Math.abs(dy) > 0) {
      return dy > 0 ? "down" : "up";
    }
    return this.lastDirection;
  }

  private getAnim(type: Movement, dir: Direction) {
    const anims = assets.amelie.animations;
    if (type === "walk") {
      switch (dir) {
        case "right":
          return anims.AmelieWalkRight;
        case "left":
          return anims.AmelieWalkLeft;
        case "up":
          return anims.AmelieWalkUp;
        case "down":
          return anims.AmelieWalkDown;
      }
    } else {
      switch (dir) {
        case "right":
          return anims.AmelieIdleRight;
        case "left":
          return anims.AmelieIdleLeft;
        case "up":
          return anims.AmelieIdleUp;
        case "down":
          return anims.AmelieIdleDown;
      }
    }
  }

  // --- Helper: Tile and Range Checks ---
  private getPlayerTile(): { x: number; y: number } {
    return {
      x: Math.floor(this.player.x / TILE_SIZE),
      y: Math.floor(this.player.y / TILE_SIZE),
    };
  }

  private getTileAt(tx: number, ty: number) {
    return this.groundLayer?.getTileAt(tx, ty);
  }

  private isInInteractRange(tx: number, ty: number): boolean {
    const { x: px, y: py } = this.getPlayerTile();
    const dist = Math.abs(tx - px) + Math.abs(ty - py);
    return dist <= this.INTERACT_RANGE;
  }

  private isWalkable(worldX: number, worldY: number): boolean {
    if (!this.groundLayer) return false;

    const tile = this.groundLayer.getTileAtWorldXY(worldX, worldY, true);
    if (!tile) return false;

    switch (tile.index) {
      case assets.blocks.sprites.Water:
      case assets.blocks.sprites.LightBlue:
        return false;
      default:
        return true;
    }
  }

  create() {
    // --- HUD ---
    // Placeable blocks: White through Black (inclusive)
    const blockSpriteKeys = [
      "White",
      "LightCyan",
      "LightMagenta",
      "Yellow",
      "LightRed",
      "LightGreen",
      "LightBlue",
      "Grey",
      "LightGrey",
      "Cyan",
      "Magenta",
      "Brown",
      "Red",
      "Green",
      "Blue",
      "Black",
    ];
    const blockKeys = blockSpriteKeys
      .map((k) => ({
        key: k,
        value: assets.blocks.sprites[k as keyof typeof assets.blocks.sprites],
        count: 99,
      }))
      .filter((b) => b.value !== undefined);

    // Expose Phaser game instance for HUD canvas rendering
    if (typeof window !== "undefined") {
      (window as any)["game"] = this.game;
    }
    // Create and append <hud> web component
    this.hudEl = document.createElement("amelcraft-hud");
    document.body.appendChild(this.hudEl);
    (this.hudEl as any).data = {
      blockKeys,
      selected: this.selectedTool,
      onSelect: (val: number | "dig") => {
        this.selectedTool = val;
      },
    };

    // Clean up HUD on scene shutdown/destroy
    const cleanupHud = () => {
      if (this.hudEl) {
        this.hudEl.remove();
        this.hudEl = null;
      }
    };
    this.events.on("shutdown", cleanupHud);
    this.events.on("destroy", cleanupHud);

    // Highlight overlay graphics
    this.highlightGraphics = this.add.graphics();
    this.highlightGraphics.setDepth(10);
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
        assets.blocks.sprites.Water,
        0,
        0,
        WORLD_COLS,
        WORLD_ROWS
      ); // start as water
      this.generateIsland();
      this.groundLayer.setDepth(0);
    }
    this.player.setDepth(1);

    // Center camera on player at start
    this.camera.centerOn(this.player.x, this.player.y);

    // (Keyboard cursors removed for now)

    // Unified pointer/touch controls
    this.setupUnifiedPointerControls();

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
    // Get player center before zoom
    const playerX = this.player.x;
    const playerY = this.player.y;
    // Set zoom
    this.camera.setZoom(clamped);
    // Center camera on player
    this.camera.centerOn(playerX, playerY);
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
    // Update block collection progress
    if (this.collectingBlock) {
      const elapsed = this.time.now - this.collectingBlock.startTime;
      this.collectionProgress = Phaser.Math.Clamp(
        elapsed / COLLECT_BLOCK_TIME_MS,
        0,
        1
      );
      // Progress bar will be rendered in updateHighlights()
    } else {
      this.collectionProgress = 0;
    }
    // HUD selection is always up-to-date
    // Keep selectedTool in sync with HUD selection
    if (this.hudEl && (this.hudEl as any).getSelected) {
      this.selectedTool = (this.hudEl as any).getSelected();
    }
    // Highlight logic: compute and draw highlights around player
    this.updateHighlights();

    // Always highlight interactable blocks when standing still
    if (!this.target) {
      this.alwaysHighlightTiles = this.getInteractableTiles();
    } else {
      this.alwaysHighlightTiles = [];
    }

    // Player movement logic
    if (this.target) {
      const dx = this.target.x - this.player.x;
      const dy = this.target.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 2) {
        // Move towards target at moveSpeed (pixels/sec)
        const move = (this.moveSpeed * delta) / 1000;
        const nx = this.player.x + (dx / dist) * Math.min(move, dist);
        const ny = this.player.y + (dy / dist) * Math.min(move, dist);
        // Only move if the next position is walkable
        if (this.isWalkable(nx, ny)) {
          // Determine direction for animation
          let dir: Direction = this.lastDirection;
          if (Math.abs(dx) > Math.abs(dy)) {
            dir = dx > 0 ? "right" : "left";
          } else if (Math.abs(dy) > 0) {
            dir = dy > 0 ? "down" : "up";
          }
          this.lastDirection = dir;
          // Play walk animation
          this.player.play(this.getAnim("walk", dir), true);
          this.player.x = nx;
          this.player.y = ny;
        } else {
          // If not walkable, stop movement and play idle
          this.player.play(this.getAnim("idle", this.lastDirection), true);
          this.target = null;
        }
      } else {
        // Arrived at target
        this.player.x = this.target.x;
        this.player.y = this.target.y;
        // Play idle animation facing last direction
        this.player.play(this.getAnim("idle", this.lastDirection), true);
        this.target = null;
      }
      // Camera always centers on player after movement
      this.camera.centerOn(this.player.x, this.player.y);
      this.clampCamera();
    }
  }

  private updateHighlights() {
    if (!this.groundLayer) return;
    this.highlightGraphics.clear();
    // Always highlight interactable blocks when standing still
    if (this.alwaysHighlightTiles && this.alwaysHighlightTiles.length > 0) {
      for (const { x, y } of this.alwaysHighlightTiles) {
        this.highlightGraphics.lineStyle(2, 0x00ff00, 0.5);
        this.highlightGraphics.strokeRect(
          x * TILE_SIZE,
          y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE
        );
      }
    }
    // Highlight the tile under the pointer (if any)
    if (this.highlightTile) {
      const { x, y } = this.highlightTile;
      const px = Math.floor(this.player.x / TILE_SIZE);
      const py = Math.floor(this.player.y / TILE_SIZE);
      const dist = Math.abs(x - px) + Math.abs(y - py);
      // Visual feedback: green if in range, red if out of range
      const inRange = dist <= this.INTERACT_RANGE;
      this.highlightGraphics.lineStyle(2, inRange ? 0x00ff00 : 0xff0000, 0.7);
      this.highlightGraphics.fillStyle(inRange ? 0x00ff00 : 0xff0000, 0.15);
      const sx = x * TILE_SIZE;
      const sy = y * TILE_SIZE;
      this.highlightGraphics.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
      this.highlightGraphics.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
      // Draw progress bar if collecting this block
      if (
        this.collectingBlock &&
        this.collectingBlock.x === x &&
        this.collectingBlock.y === y
      ) {
        const barWidth = TILE_SIZE * 0.8;
        const barHeight = 6;
        const barX = sx + TILE_SIZE * 0.1;
        const barY = sy - 10;
        // Background
        this.highlightGraphics.fillStyle(0x222222, 0.7);
        this.highlightGraphics.fillRect(barX, barY, barWidth, barHeight);
        // Progress
        this.highlightGraphics.fillStyle(0x00ff00, 0.9);
        this.highlightGraphics.fillRect(
          barX,
          barY,
          barWidth * this.collectionProgress,
          barHeight
        );
        // Border
        this.highlightGraphics.lineStyle(1, 0xffffff, 0.8);
        this.highlightGraphics.strokeRect(barX, barY, barWidth, barHeight);
      }
    }
  }

  // ===================
  // === BLOCK INTERACTION: Range, Placement, Collection ===
  // ===================
  private getInteractableTiles(): { x: number; y: number }[] {
    const { x: px, y: py } = this.getPlayerTile();
    const tiles: { x: number; y: number }[] = [];
    for (let dx = -this.INTERACT_RANGE; dx <= this.INTERACT_RANGE; dx++) {
      for (let dy = -this.INTERACT_RANGE; dy <= this.INTERACT_RANGE; dy++) {
        const x = px + dx;
        const y = py + dy;
        if (
          Math.abs(dx) + Math.abs(dy) <= this.INTERACT_RANGE &&
          this.getTileAt(x, y)
        ) {
          tiles.push({ x, y });
        }
      }
    }
    return tiles;
  }

  // --- Placement ---
  private handleBlockPlacement(tx: number, ty: number) {
    // PC turns to the highlighted tile
    const { x: px, y: py } = this.getPlayerTile();
    const dx = tx - px;
    const dy = ty - py;
    const dir = this.getDirection(dx, dy);
    this.lastDirection = dir;
    this.player.play(this.getAnim("idle", dir), true);
    if (!this.groundLayer) return;
    if (this.selectedTool === "dig") return;
    this.groundLayer.putTileAt(this.selectedTool, tx, ty);
  }

  // Animations are now created in TitleScene using createFromAseprite

  // Camera dead-zone logic removed: camera now always centers on player after movement.

  private screenToWorld(screenX: number, screenY: number) {
    const cam = this.camera;
    return {
      x: cam.scrollX + screenX / cam.zoom,
      y: cam.scrollY + screenY / cam.zoom,
    };
  }

  // ===================
  // === WORLD GENERATION ===
  // ===================
  private generateIsland() {
    if (!this.groundLayer) return;
    const GRASS = assets.blocks.sprites.Grass; // tileset index for grass
    const WATER = assets.blocks.sprites.Water; // tileset index for water
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

  private setupUnifiedPointerControls() {
    // Unified pointer/touch event handling
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointerup", this.handlePointerUp, this);
  }

  // ===================
  // === POINTER/TOUCH HANDLERS ===
  // ===================
  private handlePointerMove(p: Phaser.Input.Pointer) {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    this.highlightTile = { x: tx, y: ty };
    // If pointer is down and moves to a new tile, abort collection and start new if still holding
    if (
      this.pointerDownTile &&
      (this.pointerDownTile.x !== tx || this.pointerDownTile.y !== ty)
    ) {
      // Clear pointerDownTile before canceling collection to prevent race
      this.pointerDownTile = null;
      this.pointerDownTime = null;
      this.cancelBlockCollection();
      // If pointer is still down, start new collection on new tile (if dig tool and in range)
      if (
        this.input.activePointer.isDown &&
        this.selectedTool === "dig" &&
        this.isInInteractRange(tx, ty)
      ) {
        this.pointerDownTile = { x: tx, y: ty };
        this.pointerDownTime = this.time.now;
        this.startBlockCollection(tx, ty);
      }
    }
  }

  private handlePointerDown(p: Phaser.Input.Pointer) {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    this.pointerDownTime = this.time.now;
    this.pointerDownTile = { x: tx, y: ty };
    this.highlightTile = { x: tx, y: ty };
    // Start collection state immediately if dig tool is selected and in range
    if (this.selectedTool === "dig" && this.isInInteractRange(tx, ty)) {
      this.startBlockCollection(tx, ty);
    }
  }

  private handlePointerUp(p: Phaser.Input.Pointer) {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    // If pointer up is on same tile as down and short press, treat as tap/click (never collect block here)
    if (
      this.pointerDownTile &&
      this.pointerDownTile.x === tx &&
      this.pointerDownTile.y === ty
    ) {
      const pressDuration = this.time.now - (this.pointerDownTime ?? 0);
      if (pressDuration < 500) {
        // Tap/click: place block if in range
        const placed = this.tryInteractBlock(tx, ty, "place");
        // If not placed (out of range or not placeable), always move toward the tap/click location (regardless of walkability)
        if (!placed) {
          this.target = { x: p.worldX, y: p.worldY };
        }
      }
    }
    // Always cancel block collection on pointerup (never allow immediate collection here)
    this.pointerDownTime = null;
    this.pointerDownTile = null;
    this.cancelBlockCollection();
  }
  private cancelPendingCollection() {
    if (this.pendingCollectionTimeout) {
      clearTimeout(this.pendingCollectionTimeout);
      this.pendingCollectionTimeout = null;
    }
  }

  // Try to place or collect a block at (tx, ty) if in range. Returns true if interaction occurred.
  private tryInteractBlock(
    tx: number,
    ty: number,
    action: "place" | "start-collect"
  ): boolean {
    if (!this.groundLayer) return false;
    const px = Math.floor(this.player.x / TILE_SIZE);
    const py = Math.floor(this.player.y / TILE_SIZE);
    const dist = Math.abs(tx - px) + Math.abs(ty - py);
    if (dist > this.INTERACT_RANGE) {
      // Out of range: could add shake or red highlight
      return false;
    }
    if (action === "place") {
      this.handleBlockPlacement(tx, ty);
      return true;
    } else if (action === "start-collect") {
      this.startBlockCollection(tx, ty);
      return true;
    }
    return false;
  }

  // Start block collection (shows progress bar, only collects if pointer is still down on same block when timer finishes)
  private startBlockCollection(tx: number, ty: number) {
    // Cancel any existing collection
    if (this.collectingBlock) this.cancelBlockCollection();
    const grass = assets.blocks.sprites.Grass;
    const tile = this.groundLayer.getTileAt(tx, ty);
    if (!tile || tile.index === grass) return;
    // Make PC turn toward the block being collected
    const px = Math.floor(this.player.x / TILE_SIZE);
    const py = Math.floor(this.player.y / TILE_SIZE);
    const dx = tx - px;
    const dy = ty - py;
    let dir: Direction = this.lastDirection;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? "right" : "left";
    } else if (Math.abs(dy) > 0) {
      dir = dy > 0 ? "down" : "up";
    }
    this.lastDirection = dir;
    this.player.play(this.getAnim("idle", dir), true);
    // Start collection state (now 1 second)
    this.collectingBlock = {
      x: tx,
      y: ty,
      startTime: this.time.now,
      timer: this.time.delayedCall(COLLECT_BLOCK_TIME_MS, () => {
        // Only collect if pointer is still down on the same block
        if (
          this.pointerDownTile &&
          this.pointerDownTile.x === tx &&
          this.pointerDownTile.y === ty &&
          this.input.activePointer.isDown
        ) {
          this.handleBlockCollection(tx, ty);
        }
        this.collectingBlock = null;
        this.collectionProgress = 0;
      }),
    };
    this.collectionProgress = 0;
  }

  // Cancel block collection (removes progress bar, does not remove block)
  private cancelBlockCollection() {
    if (this.collectingBlock) {
      // Remove timer if still active
      if (
        this.collectingBlock.timer &&
        !this.collectingBlock.timer.hasDispatched
      ) {
        this.collectingBlock.timer.remove(false);
      }
      this.collectingBlock = null;
      this.collectionProgress = 0;
    }
  }

  // Collect block logic (called after 2s timer)
  private handleBlockCollection(tx: number, ty: number) {
    if (!this.groundLayer) return;
    const grass = assets.blocks.sprites.Grass;
    const tile = this.groundLayer.getTileAt(tx, ty);
    if (tile && tile.index !== grass) {
      this.groundLayer.putTileAt(grass, tx, ty);
      // TODO: Add to inventory, play sound, etc.
    }
    // Progress bar is cleared by timer/cancel logic
  }
  // Determine if a world position is walkable (currently grass tile index 10)
  // ...existing code...
}
