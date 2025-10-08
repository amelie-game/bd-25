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

// ===================
// === GAME SCENE  ===
// ===================
export class GameScene extends Phaser.Scene {
  private target: { x: number; y: number } | null = null;
  private INTERACT_RANGE = 2; // tiles
  private selectedTool: Option = "move";
  private highlightTile: { x: number; y: number } | null = null;
  // pointer down state is managed by the individual modes

  private world!: World;
  private inventory!: Inventory;
  private hud!: HUDManager;
  private camera!: Camera;
  private player!: Player;

  private activeMode: any = null;

  constructor() {
    super("GameScene");
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

  getWorld() {
    return this.world;
  }

  getSelectedTool() {
    return this.selectedTool;
  }

  getHighlightTile() {
    return this.highlightTile;
  }

  setHighlightTile(tile: { x: number; y: number } | null) {
    this.highlightTile = tile;
  }

  // ===================
  // === HELPERS: Direction, Animation, Tile, Range ===
  // ===================

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
    // Ensure HUD selection switches modes via setSelectedTool and initialize mode
    this.setSelectedTool(this.selectedTool);

    // --- Pointer/Touch Controls ---
    this.setupUnifiedPointerControls();
  }

  update(time: number, delta: number) {
    const isMoving = this.target !== null;

    // Delegate update to active mode (if any)
    if (this.activeMode && typeof this.activeMode.update === "function") {
      this.activeMode.update(time, delta);
    }

    // Player movement logic
    if (this.target) {
      if (!this.player.moveTo(this.target.x, this.target.y, delta)) {
        this.target = null;
      }
      // Camera always centers on player after movement
      // Only recenter camera in Move mode. Other modes may opt out.
      if (this.activeMode && this.activeMode.modeName === "move") {
        this.camera.recenter();
      }
    }
  }

  // ===================
  // === POINTER/TOUCH HANDLERS ===
  // ===================
  private setupUnifiedPointerControls() {
    // Unified pointer/touch event handling
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      // forward to active mode
      if (
        this.activeMode &&
        typeof this.activeMode.onPointerMove === "function"
      ) {
        this.activeMode.onPointerMove(p);
      }
      // always update highlightTile for convenience
      const tx = Math.floor(p.worldX / TILE_SIZE);
      const ty = Math.floor(p.worldY / TILE_SIZE);
      this.setHighlightTile({ x: tx, y: ty });
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (
        this.activeMode &&
        typeof this.activeMode.onPointerDown === "function"
      ) {
        this.activeMode.onPointerDown(p);
      }
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (
        this.activeMode &&
        typeof this.activeMode.onPointerUp === "function"
      ) {
        this.activeMode.onPointerUp(p);
      }
    });
  }

  // Exposed helpers for modes ------------------------------------------------
  setTarget(point: { x: number; y: number } | null) {
    this.target = point;
  }

  // Make interact range available to modes
  isInInteractRange(tx: number, ty: number): boolean {
    const { x: px, y: py } = this.player.getTile();
    const dist = Math.abs(tx - px) + Math.abs(ty - py);
    return dist <= this.INTERACT_RANGE;
  }

  // 8-connected adjacency used by place/collect: Chebyshev distance <= 1.
  // Excludes the tile the player is standing on (you must step off first).
  isTileInteractable(tx: number, ty: number): boolean {
    const { x: px, y: py } = this.player.getTile();
    const dx = Math.abs(tx - px);
    const dy = Math.abs(ty - py);
    let inRange = Math.max(dx, dy) <= 1;
    if (px === tx && py === ty) inRange = false;
    return inRange;
  }

  // Move the player to a neighbouring tile adjacent to (tx,ty) and call onArrive when reached.
  // Returns true if movement was initiated (or the player is already moving towards a chosen neighbor),
  // false if no suitable neighbor was found.
  movePlayerAdjacentTo(tx: number, ty: number, onArrive: () => void): boolean {
    const world = this.getWorld();
    const player = this.getPlayer();
    const pTile = player.getTile();

    // If player stands on the same tile, prefer cardinal candidates based on pixel offset
    let cardinalCandidates: { x: number; y: number }[] = [];
    if (pTile.x === tx && pTile.y === ty) {
      const [playerX, playerY] = player.getPosition();
      const centerX = (tx + 0.5) * TILE_SIZE;
      const centerY = (ty + 0.5) * TILE_SIZE;
      const offX = playerX - centerX;
      const offY = playerY - centerY;
      cardinalCandidates =
        Math.abs(offX) > Math.abs(offY)
          ? offX > 0
            ? [
                { x: tx + 1, y: ty },
                { x: tx - 1, y: ty },
                { x: tx, y: ty + 1 },
                { x: tx, y: ty - 1 },
              ]
            : [
                { x: tx - 1, y: ty },
                { x: tx + 1, y: ty },
                { x: tx, y: ty + 1 },
                { x: tx, y: ty - 1 },
              ]
          : offY > 0
          ? [
              { x: tx, y: ty + 1 },
              { x: tx, y: ty - 1 },
              { x: tx + 1, y: ty },
              { x: tx - 1, y: ty },
            ]
          : [
              { x: tx, y: ty - 1 },
              { x: tx, y: ty + 1 },
              { x: tx + 1, y: ty },
              { x: tx - 1, y: ty },
            ];
    } else {
      // Not standing on the target: pick cardinal neighbors sorted by distance to player
      cardinalCandidates = [
        { x: tx - 1, y: ty },
        { x: tx + 1, y: ty },
        { x: tx, y: ty - 1 },
        { x: tx, y: ty + 1 },
      ];
      const playerPos = player.getPosition();
      const center = (n: { x: number; y: number }) => ({
        x: (n.x + 0.5) * TILE_SIZE,
        y: (n.y + 0.5) * TILE_SIZE,
      });
      cardinalCandidates.sort((a, b) => {
        const ac = center(a);
        const bc = center(b);
        const da = (ac.x - playerPos[0]) ** 2 + (ac.y - playerPos[1]) ** 2;
        const db = (bc.x - playerPos[0]) ** 2 + (bc.y - playerPos[1]) ** 2;
        return da - db;
      });
    }

    // Prefer walkable center candidates first
    let chosen = cardinalCandidates.find((n) => {
      const nt = world.getTileAt(n.x, n.y);
      if (!nt) return false;
      return world.isWalkable((n.x + 0.5) * TILE_SIZE, (n.y + 0.5) * TILE_SIZE);
    });
    // fallback to any cardinal tile (even if not walkable center)
    if (!chosen)
      chosen = cardinalCandidates.find((n) => world.getTileAt(n.x, n.y));
    // fallback to diagonals
    if (!chosen) {
      const diagonals = [
        { x: tx - 1, y: ty - 1 },
        { x: tx + 1, y: ty - 1 },
        { x: tx - 1, y: ty + 1 },
        { x: tx + 1, y: ty + 1 },
      ];
      chosen = diagonals.find((n) => {
        const nt = world.getTileAt(n.x, n.y);
        if (!nt) return false;
        return world.isWalkable(
          (n.x + 0.5) * TILE_SIZE,
          (n.y + 0.5) * TILE_SIZE
        );
      });
      if (!chosen) chosen = diagonals.find((n) => world.getTileAt(n.x, n.y));
    }

    if (!chosen) return false;

    this.setTarget({
      x: (chosen.x + 0.5) * TILE_SIZE,
      y: (chosen.y + 0.5) * TILE_SIZE,
    });
    const checkArrival = this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (
          this.getPlayer().getTile().x === chosen!.x &&
          this.getPlayer().getTile().y === chosen!.y
        ) {
          checkArrival.remove(false);
          onArrive();
        }
      },
    });

    return true;
  }

  // Mode orchestration ------------------------------------------------------
  setSelectedTool(tool: Option) {
    this.selectedTool = tool;
    this.hud.update(this.inventory.getSlots(), this.selectedTool);
    this.ensureActiveMode();
  }

  private ensureActiveMode() {
    // Dispose previous mode if present
    if (this.activeMode && typeof this.activeMode.exit === "function") {
      this.activeMode.exit();
    }

    // Pick mode
    if (isMode(this.selectedTool) && this.selectedTool === "move") {
      this.activeMode = new MoveMode(this);
    } else if (isMode(this.selectedTool) && this.selectedTool === "collect") {
      this.activeMode = new CollectMode(this);
    } else {
      // Block = place mode
      this.activeMode = new PlaceMode(this);
    }

    if (this.activeMode && typeof this.activeMode.enter === "function") {
      this.activeMode.enter();
    }
  }
}
