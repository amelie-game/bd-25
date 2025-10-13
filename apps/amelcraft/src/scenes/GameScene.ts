// ===================
// === DEPENDENCIES ===
// ===================
import Phaser from "phaser";
import { type Option, isMode } from "../types";
import { TILE_SIZE } from "../constants";
import { World } from "../modules/World"; // legacy direct world reference (single chunk)
import { Inventory } from "../modules/Inventory";
import { HUDManager } from "../modules/HUDManager";
import { Camera } from "../modules/Camera";
import { Player } from "../modules/Player";
import { MoveMode } from "../modes/Move";
import { CollectMode } from "../modes/Collect";
import { PlaceMode } from "../modes/Place";
import { Pointer } from "../modules/Pointer";
import { WorldManager } from "../modules/WorldManager";

// ===================
// === GAME SCENE  ===
// ===================
export class GameScene extends Phaser.Scene {
  private selectedMode: Option = "move";
  // pointer down state is managed by the individual modes

  private collectMode: CollectMode;
  private moveMode: MoveMode;
  private placeMode: PlaceMode;
  private activeMode: CollectMode | MoveMode | PlaceMode;

  private pointer!: Pointer;
  private worldManager!: WorldManager;
  private inventory!: Inventory;
  private hud!: HUDManager;
  private camera!: Camera;
  private player!: Player;

  constructor() {
    super("GameScene");

    this.collectMode = new CollectMode(this);
    this.moveMode = new MoveMode(this);
    this.placeMode = new PlaceMode(this);
    this.activeMode = this.moveMode; // default mode
  }

  getCamera() {
    return this.camera;
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

  getPointer() {
    return this.pointer;
  }

  getWorld() {
    // Legacy: returns the player's current chunk (primary) for backward compatibility
    return this.worldManager.getPrimaryWorld();
  }

  getWorldManager() {
    return this.worldManager;
  }

  getMode() {
    return this.selectedMode;
  }

  // ===================
  // === HELPERS: Direction, Animation, Tile, Range ===
  // ===================

  create() {
    // Make Phaser game instance globally available for HUD block rendering
    window.game = this.game;

    this.pointer = new Pointer(this);
    this.worldManager = new WorldManager(this);
    this.inventory = new Inventory();
    this.hud = new HUDManager({
      inventory: this.inventory.getSlots(),
      selectedMode: this.selectedMode,
      shell: this,
      onSelect: (mode) => {
        // route selection through selectMode so modes are created/teardown correctly
        this.selectMode(mode);
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
    // Ensure initial view is centered on the player
    this.camera.recenter();
    // Ensure HUD selection switches modes via selectMode and initialize mode
    this.selectMode(this.selectedMode);

    // --- Pointer/Touch Controls ---
    this.setupUnifiedPointerControls();
  }

  update(time: number, delta: number) {
    // Delegate world update through manager (single world for now)
    this.worldManager.update(time, delta);

    // Delegate update to active mode (if any)
    this.activeMode.update(time, delta);

    // Player owns its movement target and handles movement; drive player update
    this.player.update(time, delta);
    // Camera auto-pan: let Camera decide when to pan based on player proximity to viewport edges
    this.camera.update(time, delta);
  }

  destroy() {
    this.worldManager.destroy();
    this.hud.destroy();
  }

  // ===================
  // === POINTER/TOUCH HANDLERS ===
  // ===================
  private setupUnifiedPointerControls() {
    // Unified pointer/touch event handling
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      // during pinch gestures, don't forward pointer events to modes
      if (this.pointer.isPinching()) return;

      // forward to active mode
      this.activeMode.onPointerMove(p);
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.pointer.isPinching()) return;

      this.activeMode.onPointerDown(p);
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.pointer.isPinching()) return;

      this.activeMode.onPointerUp(p);
    });
  }

  // Exposed helpers for modes ------------------------------------------------
  // target is now owned by Player; modes should call this.getPlayer().setTarget(...)

  // Mode orchestration ------------------------------------------------------
  selectMode(mode: Option) {
    this.selectedMode = mode;
    this.hud.update(this.inventory.getSlots(), this.selectedMode);
    this.ensureActiveMode();
  }

  private ensureActiveMode() {
    // Dispose previous mode if present
    this.activeMode.exit();

    // Pick mode
    if (isMode(this.selectedMode) && this.selectedMode === "move") {
      this.activeMode = this.moveMode;
    } else if (isMode(this.selectedMode) && this.selectedMode === "collect") {
      this.activeMode = this.collectMode;
    } else {
      // Block = place mode
      this.activeMode = this.placeMode;
    }

    this.activeMode.enter();
  }
}
