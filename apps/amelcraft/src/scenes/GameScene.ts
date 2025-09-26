// ===================
// === DEPENDENCIES ===
// ===================
import Phaser from "phaser";
import type { Option } from "../types";
import "../hud/HUD.js";
import { TILE_SIZE } from "../main";
import { assets } from "../assets";
import { World } from "../modules/World";

type Direction = "right" | "left" | "up" | "down";
type Movement = "walk" | "idle";

// ===================
// === CONFIGURATION ===
// ===================
// Block collection time in milliseconds
const COLLECT_BLOCK_TIME_MS = 1000;
const INTERACT_RANGE = 2; // tiles
const MOVE_SPEED = 248; // pixels per second
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 1;
// ...other constants can be added here...

// ===================
// === GAME SCENE  ===
// ===================
// Inventory types and constants
type InventorySlot = { block: number; count: number };
const INVENTORY_SLOTS = 16;
const STACK_SIZE = 99;

export class GameScene extends Phaser.Scene {
  // Timer for delayed collection start (not Phaser timer)
  private pendingCollectionTimeout: any = null;
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
  private worldPixelWidth = World.COLUMNS * TILE_SIZE;
  private worldPixelHeight = World.ROWS * TILE_SIZE;
  private minZoom = MIN_ZOOM;
  private maxZoom = MAX_ZOOM;
  private lastPinchDist: number | null = null;
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private hudEl: HTMLElement | null = null;
  private selectedTool: Option = "collect";
  private inventory: InventorySlot[] = [];

  private world!: World;

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
    if (!this.player) {
      return { x: 0, y: 0 };
    }
    return {
      x: Math.floor(this.player.x / TILE_SIZE),
      y: Math.floor(this.player.y / TILE_SIZE),
    };
  }

  private getTileAt(tx: number, ty: number) {
    return this.world.getTileAt(tx, ty);
  }

  private isInInteractRange(tx: number, ty: number): boolean {
    const { x: px, y: py } = this.getPlayerTile();
    const dist = Math.abs(tx - px) + Math.abs(ty - py);
    return dist <= this.INTERACT_RANGE;
  }

  private isWalkable(worldX: number, worldY: number): boolean {
    return this.world.isWalkable(worldX, worldY);
  }

  create() {
    // Make Phaser game instance globally available for HUD block rendering
    (window as any)["game"] = this.game;
    // --- Camera Zoom Controls ---
    // Mouse wheel zoom
    this.input.on(
      "wheel",
      (
        pointer: any,
        gameObjects: any,
        deltaX: number,
        deltaY: number,
        deltaZ: number
      ) => {
        const zoomChange = deltaY > 0 ? -0.1 : 0.1;
        this.setZoom(this.camera.zoom + zoomChange);
      }
    );

    // Pinch zoom for touch devices
    this.input.on("pointermove", (pointer: any) => {
      if (pointer.pointers && pointer.pointers.length === 2) {
        const [p1, p2] = pointer.pointers;
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.lastPinchDist !== null) {
          const diff = dist - this.lastPinchDist;
          if (Math.abs(diff) > 2) {
            this.setZoom(this.camera.zoom + diff * 0.002);
          }
        }
        this.lastPinchDist = dist;
      } else {
        this.lastPinchDist = null;
      }
    });
    // --- Inventory Initialization ---
    this.inventory = [];
    // Give player a few blocks to start (for demo)
    const blockSpriteKeys = Object.keys(assets.blocks.sprites);
    for (let i = 0; i < Math.min(3, blockSpriteKeys.length); i++) {
      this.inventory.push({
        block:
          assets.blocks.sprites[
            blockSpriteKeys[i] as keyof typeof assets.blocks.sprites
          ],
        count: 10,
      });
    }

    this.world = new World(this);

    // --- Player Sprite ---
    const startX = (World.COLUMNS / 2) * TILE_SIZE + TILE_SIZE / 2;
    const startY = (World.ROWS / 2) * TILE_SIZE + TILE_SIZE / 2;

    // Use a valid numeric frame index or fallback to 0
    const defaultFrame = 0;
    this.player = this.add.sprite(
      startX,
      startY,
      assets.amelie.key,
      defaultFrame
    );
    if (!this.player) {
      console.warn("Player sprite creation failed");
      return;
    }

    this.player.setOrigin(0.5, 0.75); // feet alignment
    (this.player as any).setSmooth && (this.player as any).setSmooth(false);
    this.player.setDepth(1);

    // --- Animations ---
    // Ensure idle down animation exists and loops
    if (!this.anims.exists("AmelieIdleDown")) {
      // Use all available idle down frames if present, else fallback to frame 0
      const idleDownFrames =
        assets.amelie.animations &&
        Array.isArray(assets.amelie.animations.AmelieIdleDown)
          ? assets.amelie.animations.AmelieIdleDown
          : [0];
      this.anims.create({
        key: "AmelieIdleDown",
        frames: idleDownFrames.map((frame: number) => ({
          key: assets.amelie.key,
          frame,
        })),
        frameRate: 2,
        repeat: -1,
      });
    }
    this.player.play("AmelieIdleDown", false); // force restart, always loop
    // --- Pointer/Touch Controls ---
    this.setupUnifiedPointerControls();

    // --- Highlight Graphics ---
    this.highlightGraphics = this.add.graphics();
    this.highlightGraphics.setDepth(10);

    // --- Camera ---
    this.camera = this.cameras.main;
    this.camera.roundPixels = true;
    this.camera.setBounds(0, 0, this.worldPixelWidth, this.worldPixelHeight);
    this.computeZoomBounds();
    this.camera.setZoom(Phaser.Math.Clamp(1, this.minZoom, this.maxZoom));
    this.camera.centerOn(this.player.x, this.player.y);

    // --- HUD ---
    this.hudEl = document.createElement("amelcraft-hud");
    document.body.appendChild(this.hudEl);
    this.updateHUD();
    (this.hudEl as any).onSelect = (val: Option) => {
      this.selectedTool = val;
      this.updateHUD();
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
  }

  // === INVENTORY HELPERS ===
  private findInventorySlot(block: number): number {
    return this.inventory.findIndex((slot) => slot.block === block);
  }

  private addToInventory(block: number): boolean {
    // Try to add to existing stack
    let idx = this.findInventorySlot(block);
    if (idx !== -1) {
      let slot = this.inventory[idx];
      if (slot.count < STACK_SIZE) {
        slot.count++;
        this.updateHUD();
        return true;
      } else {
        // Stack full
        return false;
      }
    }
    // Add new slot if space
    if (this.inventory.length < INVENTORY_SLOTS) {
      this.inventory.push({ block, count: 1 });
      this.updateHUD();
      return true;
    }
    // Inventory full
    return false;
  }

  private removeFromInventory(block: number): boolean {
    let idx = this.findInventorySlot(block);
    if (idx !== -1) {
      let slot = this.inventory[idx];
      slot.count--;
      if (slot.count <= 0) {
        this.inventory.splice(idx, 1);
        // Deselect if this was the selected tool
        if (this.selectedTool === block) {
          this.selectedTool = "collect";
        }
      }
      this.updateHUD();
      return true;
    }
    return false;
  }

  private hasBlockInInventory(block: number): boolean {
    let idx = this.findInventorySlot(block);
    return idx !== -1 && this.inventory[idx].count > 0;
  }

  private updateHUD() {
    if (!this.hudEl) return;
    // Only show blocks with count > 0
    const blockKeys = this.inventory
      .filter((slot) => slot.count > 0)
      .map((slot) => {
        // Try to find the sprite name for this block index
        const spriteName = Object.keys(assets.blocks.sprites).find(
          (k) =>
            assets.blocks.sprites[k as keyof typeof assets.blocks.sprites] ===
            slot.block
        );
        return {
          key: slot.block,
          value: slot.block,
          count: slot.count,
          sprite: spriteName ? spriteName : undefined,
        };
      });

    if ((this.hudEl as any).data) {
      (this.hudEl as any).data.blockKeys = blockKeys;
      (this.hudEl as any).data.selectedTool = this.selectedTool;
    } else {
      (this.hudEl as any).data = {
        blockKeys,
        selected: this.selectedTool,
        onSelect: (val: Option) => {
          this.selectedTool = val;
          this.updateHUD();
        },
      };
    }
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
    if (!this.world) return;
    if (this.selectedTool === "collect") return;
    // Only place if player has at least one of the selected block
    if (
      typeof this.selectedTool === "number" &&
      this.hasBlockInInventory(this.selectedTool)
    ) {
      this.world.putTileAt(this.selectedTool, tx, ty);
      this.removeFromInventory(this.selectedTool);
    } else {
      // Placement canceled: no block in inventory
      // Optionally: show feedback (shake HUD, etc)
    }
  }

  // ===================
  // === POINTER/TOUCH HANDLERS ===
  // ===================
  private setupUnifiedPointerControls() {
    // Unified pointer/touch event handling
    this.input.on("pointermove", this.handlePointerMove, this);
    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointerup", this.handlePointerUp, this);
  }

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
        this.selectedTool === "collect" &&
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
    if (this.selectedTool === "collect" && this.isInInteractRange(tx, ty)) {
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

    const tile = this.world.getTileAt(tx, ty);
    if (!tile) return;

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
    const GRASS = assets.blocks.sprites.Grass;
    const WATER = assets.blocks.sprites.Water;
    const GROUND = assets.blocks.sprites.Brown;
    const SNOW = assets.blocks.sprites.Snow;
    const SAND = assets.blocks.sprites.Yellow;
    const tile = this.world.getTileAt(tx, ty);
    if (tile) {
      // Try to add to inventory; if full, just remove block
      const added = this.addToInventory(tile.index);
      if (tile.index === GRASS) {
        // Grass: replace with ground
        this.world.putTileAt(GROUND, tx, ty);
      } else if (tile.index === GROUND) {
        // Ground: replace with water
        this.world.putTileAt(WATER, tx, ty);
      } else if (tile.index === WATER) {
        // Water: do not replace
      } else if (tile.index === SNOW) {
        // Snow: replace with water
        this.world.putTileAt(WATER, tx, ty);
      } else if (tile.index === SAND) {
        // Sand: replace with water
        this.world.putTileAt(WATER, tx, ty);
      } else {
        // All other blocks: replace with water
        this.world.putTileAt(WATER, tx, ty);
      }
      // Optionally: show feedback if not added (inventory full)
    }
    // Progress bar is cleared by timer/cancel logic
  }
  // Determine if a world position is walkable (currently grass tile index 10)
  // ...existing code...
}
