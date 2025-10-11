// ===================
// === DEPENDENCIES ===
// ===================
import Phaser from "phaser";
import { type Option, isMode } from "../types";
import { TILE_SIZE } from "../main";
import { World } from "../modules/World";
import { Inventory } from "../modules/Inventory";
import { HUDManager } from "../modules/HUDManager";
import { Camera } from "../modules/Camera";
import { Player } from "../modules/Player";
import { MoveMode } from "../modes/Move";
import { CollectMode } from "../modes/Collect";
import { PlaceMode } from "../modes/Place";
import { Pointer } from "../modules/Pointer";

// ===================
// === GAME SCENE  ===
// ===================
export class GameScene extends Phaser.Scene {
  private selectedTool: Option = "move";
  // pointer down state is managed by the individual modes

  private collectMode: CollectMode;
  private moveMode: MoveMode;
  private placeMode: PlaceMode;
  private activeMode: CollectMode | MoveMode | PlaceMode;

  private pointer!: Pointer;
  private world!: World;
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
    return this.world;
  }

  getSelectedTool() {
    return this.selectedTool;
  }

  // ===================
  // === HELPERS: Direction, Animation, Tile, Range ===
  // ===================

  create() {
    // Make Phaser game instance globally available for HUD block rendering
    window.game = this.game;

    this.pointer = new Pointer(this);
    this.world = new World(this);
    this.inventory = new Inventory();
    this.hud = new HUDManager({
      inventory: this.inventory.getSlots(),
      selectedTool: this.selectedTool,
      shell: this,
      onSelect: (tool) => {
        // route selection through setSelectedTool so modes are created/teardown correctly
        this.setSelectedTool(tool);
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
    // Ensure HUD selection switches modes via setSelectedTool and initialize mode
    this.setSelectedTool(this.selectedTool);

    // --- Pointer/Touch Controls ---
    this.setupUnifiedPointerControls();
  }

  update(time: number, delta: number) {
    this.world.update(time, delta);

    // Delegate update to active mode (if any)
    this.activeMode.update(time, delta);

    // Player owns its movement target and handles movement; drive player update
    this.player.update(time, delta);
    // Camera auto-pan: let Camera decide when to pan based on player proximity to viewport edges
    this.camera.update(time, delta);
  }

  destroy() {
    this.world.destroy();
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
  setSelectedTool(tool: Option) {
    this.selectedTool = tool;
    this.hud.update(this.inventory.getSlots(), this.selectedTool);
    this.ensureActiveMode();
  }

  private ensureActiveMode() {
    // Dispose previous mode if present
    this.activeMode.exit();

    // Pick mode
    if (isMode(this.selectedTool) && this.selectedTool === "move") {
      this.activeMode = this.moveMode;
    } else if (isMode(this.selectedTool) && this.selectedTool === "collect") {
      this.activeMode = this.collectMode;
    } else {
      // Block = place mode
      this.activeMode = this.placeMode;
    }

    this.activeMode.enter();
  }
}
