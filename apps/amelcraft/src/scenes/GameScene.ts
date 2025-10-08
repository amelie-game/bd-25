// ===================
// === DEPENDENCIES ===
// ===================
import Phaser from "phaser";
import { type Option } from "../types";
import { TILE_SIZE } from "../main";
import { World } from "../modules/World";
import { Inventory } from "../modules/Inventory";
import { HUDManager } from "../modules/HUDManager";
import { Camera } from "../modules/Camera";
import { Player } from "../modules/Player";
import { BlockInteraction } from "../modules/BlockInteraction";

// ===================
// === GAME SCENE  ===
// ===================
export class GameScene extends Phaser.Scene {
  private target: { x: number; y: number } | null = null;
  private INTERACT_RANGE = 2; // tiles
  private selectedTool: Option = "move";
  private highlightTile: { x: number; y: number } | null = null;
  private pointerDownTime: number | null = null;
  private pointerDownTile: { x: number; y: number } | null = null;

  private world!: World;
  private inventory!: Inventory;
  private hud!: HUDManager;
  private camera!: Camera;
  private player!: Player;

  private blockInteraction!: BlockInteraction;

  constructor() {
    super("GameScene");
  }

  getHud() {
    return this.hud;
  }

  getInventory() {
    return this.inventory;
  }

  getPlayer() {
    return this.player;
  }

  getWorld() {
    return this.world;
  }

  getSelectedTool() {
    return this.selectedTool;
  }

  setSelectedTool(tool: Option) {
    this.selectedTool = tool;
    this.hud.update(this.inventory.getSlots(), this.selectedTool);
  }

  getHighlightTile() {
    return this.highlightTile;
  }

  setHighlightTile(tile: { x: number; y: number } | null) {
    this.highlightTile = tile;
  }

  getPointerDownTile() {
    return this.pointerDownTile;
  }

  // ===================
  // === HELPERS: Direction, Animation, Tile, Range ===
  // ===================

  private isInInteractRange(tx: number, ty: number): boolean {
    const { x: px, y: py } = this.player.getTile();
    const dist = Math.abs(tx - px) + Math.abs(ty - py);
    return dist <= this.INTERACT_RANGE;
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
    this.blockInteraction = new BlockInteraction({ shell: this });

    // --- Pointer/Touch Controls ---
    this.setupUnifiedPointerControls();
  }

  update(time: number, delta: number) {
    const isMoving = this.target !== null;

    this.blockInteraction.update(time, delta, isMoving);

    // Player movement logic
    if (this.target) {
      if (!this.player.moveTo(this.target.x, this.target.y, delta)) {
        this.target = null;
      }
      // Camera always centers on player after movement
      this.camera.recenter();
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
      this.blockInteraction.cancelBlockCollection();
      // If pointer is still down, start new collection on new tile (if dig tool and in range)
      if (
        this.input.activePointer.isDown &&
        this.selectedTool === "collect" &&
        this.isInInteractRange(tx, ty)
      ) {
        this.pointerDownTile = { x: tx, y: ty };
        this.pointerDownTime = this.time.now;
        this.blockInteraction.startBlockCollection(tx, ty);
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
      this.blockInteraction.startBlockCollection(tx, ty);
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
        const placed = this.blockInteraction.tryInteractBlock(tx, ty, "place");
        // If not placed (out of range or not placeable), always move toward the tap/click location (regardless of walkability)
        if (!placed) {
          this.target = { x: p.worldX, y: p.worldY };
        }
      }
    }
    // Always cancel block collection on pointerup (never allow immediate collection here)
    this.pointerDownTime = null;
    this.pointerDownTile = null;
    this.blockInteraction.cancelBlockCollection();
  }
}
