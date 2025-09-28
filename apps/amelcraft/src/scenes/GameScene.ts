// ===================
// === DEPENDENCIES ===
// ===================
import Phaser from "phaser";
import { toBlock, type Option } from "../types";
import { TILE_SIZE } from "../main";
import { assets } from "../assets";
import { World } from "../modules/World";
import { Inventory } from "../modules/Inventory";
import { HUDManager } from "../modules/HUDManager";
import { Camera } from "../modules/Camera";
import { Player } from "../modules/Player";

type Direction = "right" | "left" | "up" | "down";
type Movement = "walk" | "idle";

// ===================
// === CONFIGURATION ===
// ===================
// Block collection time in milliseconds
const COLLECT_BLOCK_TIME_MS = 1000;
const INTERACT_RANGE = 2; // tiles
const MOVE_SPEED = 248; // pixels per second
// ...other constants can be added here...

// ===================
// === GAME SCENE  ===
// ===================
export class GameScene extends Phaser.Scene {
  // Timer for delayed collection start (not Phaser timer)
  private pendingCollectionTimeout: any = null;
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
  private highlightGraphics!: Phaser.GameObjects.Graphics;
  private selectedTool: Option = "move";

  private world!: World;
  private inventory!: Inventory;
  private hud!: HUDManager;
  private camera!: Camera;
  private player!: Player;

  constructor() {
    super("GameScene");
  }

  getWorldDimensions() {
    return this.world.getDimensions();
  }

  getInventory() {
    return this.inventory.getSlots();
  }

  getSelectedTool() {
    return this.selectedTool;
  }

  getPlayerPosition(): [x: number, y: number] {
    return this.player.getPosition();
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

  private getTileAt(tx: number, ty: number) {
    return this.world.getTileAt(tx, ty);
  }

  private isInInteractRange(tx: number, ty: number): boolean {
    const { x: px, y: py } = this.player.getTile();
    const dist = Math.abs(tx - px) + Math.abs(ty - py);
    return dist <= this.INTERACT_RANGE;
  }

  private isWalkable(worldX: number, worldY: number): boolean {
    return this.world.isWalkable(worldX, worldY);
  }

  create() {
    // Make Phaser game instance globally available for HUD block rendering
    (window as any)["game"] = this.game;

    this.world = new World(this);
    this.inventory = new Inventory();
    this.hud = new HUDManager({
      inventory: this.inventory.getSlots(),
      selectedTool: this.selectedTool,
      shell: this,
      onSelect: (tool) => {
        this.selectedTool = tool;
        this.hud.update(this.inventory.getSlots(), this.selectedTool);
      },
    });
    const playerStart: [number, number] = [
      (World.COLUMNS / 2) * TILE_SIZE + TILE_SIZE / 2,
      (World.ROWS / 2) * TILE_SIZE + TILE_SIZE / 2,
    ];
    this.player = new Player({
      shell: this,
      start: playerStart,
    });
    this.camera = new Camera({ shell: this });

    // --- Pointer/Touch Controls ---
    this.setupUnifiedPointerControls();

    // --- Highlight Graphics ---
    this.highlightGraphics = this.add.graphics();
    this.highlightGraphics.setDepth(10);
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
      const [playerX, playerY] = this.player.getPosition();
      const dx = this.target.x - playerX;
      const dy = this.target.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 2) {
        // Move towards target at moveSpeed (pixels/sec)
        const move = (this.moveSpeed * delta) / 1000;
        const nx = playerX + (dx / dist) * Math.min(move, dist);
        const ny = playerY + (dy / dist) * Math.min(move, dist);
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
          this.player.getSprite().play(this.getAnim("walk", dir), true);
          this.player.getSprite().x = nx;
          this.player.getSprite().y = ny;
        } else {
          // If not walkable, stop movement and play idle
          this.player
            .getSprite()
            .play(this.getAnim("idle", this.lastDirection), true);
          this.target = null;
        }
      } else {
        // Arrived at target
        this.player.getSprite().x = this.target.x;
        this.player.getSprite().y = this.target.y;
        // Play idle animation facing last direction
        this.player
          .getSprite()
          .play(this.getAnim("idle", this.lastDirection), true);
        this.target = null;
      }
      // Camera always centers on player after movement
      this.camera.recenter();
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
      const [playerX, playerY] = this.player.getPosition();
      const { x, y } = this.highlightTile;
      const px = Math.floor(playerX / TILE_SIZE);
      const py = Math.floor(playerY / TILE_SIZE);
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
    const { x: px, y: py } = this.player.getTile();
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
    const { x: px, y: py } = this.player.getTile();
    const dx = tx - px;
    const dy = ty - py;
    const dir = this.getDirection(dx, dy);
    this.lastDirection = dir;
    this.player.getSprite().play(this.getAnim("idle", dir), true);
    if (!this.world) return;
    if (this.selectedTool === "collect") return;
    // Only place if player has at least one of the selected block
    if (
      typeof this.selectedTool === "number" &&
      this.inventory.has(this.selectedTool)
    ) {
      this.world.putTileAt(this.selectedTool, tx, ty);
      const remaining = this.inventory.remove(this.selectedTool);

      if (remaining !== false) {
        if (remaining === 0) {
          this.selectedTool = "move";
        }

        this.hud.update(this.inventory.getSlots(), this.selectedTool);
      }
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
    const [playerX, playerY] = this.player.getPosition();
    const px = Math.floor(playerX / TILE_SIZE);
    const py = Math.floor(playerY / TILE_SIZE);
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
    const [playerX, playerY] = this.player.getPosition();
    const px = Math.floor(playerX / TILE_SIZE);
    const py = Math.floor(playerY / TILE_SIZE);
    const dx = tx - px;
    const dy = ty - py;
    let dir: Direction = this.lastDirection;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? "right" : "left";
    } else if (Math.abs(dy) > 0) {
      dir = dy > 0 ? "down" : "up";
    }
    this.lastDirection = dir;
    this.player.getSprite().play(this.getAnim("idle", dir), true);
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
      if (this.inventory.add(toBlock(tile.index))) {
        this.hud.update(this.inventory.getSlots(), this.selectedTool);
      }

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
