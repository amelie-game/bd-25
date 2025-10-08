import { assets } from "../assets";
import { TILE_SIZE } from "../main";
import { GameScene } from "../scenes/GameScene";
import { Direction, toBlock } from "../types";
import { getDirection } from "../utils";

type Shell = Pick<
  GameScene,
  | "add"
  | "input"
  | "time"
  | "getHud"
  | "getInventory"
  | "getPlayer"
  | "getWorld"
  | "getHighlightTile"
  | "getPointerDownTile"
  | "getSelectedTool"
  | "setSelectedTool"
>;

type Params = {
  shell: Shell;
  collectBlockTimeMs?: number;
  interactionRange?: number;
};

export class BlockInteraction {
  static COLLECT_BLOCK_TIME_MS: 1000;
  static INTERACT_RANGE: 2; // tiles

  private shell: Shell;
  private collectBlockTimeMs: number;
  private interactionRange: number;

  private lastDirection: Direction = "down";
  private highlightGraphics: Phaser.GameObjects.Graphics;
  private collectionProgress: number = 0;
  private alwaysHighlightTiles: { x: number; y: number }[] = [];
  private collectingBlock: {
    x: number;
    y: number;
    startTime: number;
    timer: Phaser.Time.TimerEvent;
  } | null = null;

  constructor({
    shell,
    collectBlockTimeMs = BlockInteraction.COLLECT_BLOCK_TIME_MS,
    interactionRange = BlockInteraction.INTERACT_RANGE,
  }: Params) {
    this.shell = shell;
    this.collectBlockTimeMs = collectBlockTimeMs;
    this.interactionRange = interactionRange;

    this.highlightGraphics = this.shell.add.graphics();
    this.highlightGraphics.setDepth(10);
  }

  update(time: number, delta: number, isMovving: boolean) {
    // Update block collection progress
    if (this.collectingBlock) {
      const elapsed = this.shell.time.now - this.collectingBlock.startTime;
      this.collectionProgress = Phaser.Math.Clamp(
        elapsed / this.collectBlockTimeMs,
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
    if (!isMovving) {
      this.alwaysHighlightTiles = this.getInteractableTiles();
    } else {
      this.alwaysHighlightTiles = [];
    }
  }

  // Try to place or collect a block at (tx, ty) if in range. Returns true if interaction occurred.
  tryInteractBlock(
    tx: number,
    ty: number,
    action: "place" | "start-collect"
  ): boolean {
    const [playerX, playerY] = this.shell.getPlayer().getPosition();
    const px = Math.floor(playerX / TILE_SIZE);
    const py = Math.floor(playerY / TILE_SIZE);
    const dist = Math.abs(tx - px) + Math.abs(ty - py);
    if (dist > this.interactionRange) {
      // Out of range: could add shake or red highlight
      return false;
    }
    if (action === "place") {
      this.tryPlaceBlock(tx, ty);
      return true;
    } else if (action === "start-collect") {
      this.startBlockCollection(tx, ty);
      return true;
    }
    return false;
  }

  tryPlaceBlock(tileX: number, tileY: number) {
    const selectedTool = this.shell.getSelectedTool();
    if (selectedTool === "move" || selectedTool === "collect") return;
    if (!this.shell.getInventory().has(selectedTool)) return;

    // PC turns to the highlighted tile
    const { x: px, y: py } = this.shell.getPlayer().getTile();
    const dx = tileX - px;
    const dy = tileY - py;
    const dir = getDirection(dx, dy);

    this.lastDirection = dir;
    this.shell.getPlayer().playAnim("idle", dir, true);

    // Only place if player has at least one of the selected block
    this.shell.getWorld().putTileAt(selectedTool, tileX, tileY);
    const remaining = this.shell.getInventory().remove(selectedTool);

    if (remaining !== false) {
      if (remaining === 0) {
        this.shell.setSelectedTool("move");
      }

      this.shell
        .getHud()
        .update(
          this.shell.getInventory().getSlots(),
          this.shell.getSelectedTool()
        );
    }
  }

  // Start block collection (shows progress bar, only collects if pointer is still down on same block when timer finishes)
  startBlockCollection(tx: number, ty: number) {
    // Cancel any existing collection
    if (this.collectingBlock) this.cancelBlockCollection();

    const tile = this.shell.getWorld().getTileAt(tx, ty);
    if (!tile) return;

    // Make PC turn toward the block being collected
    const [playerX, playerY] = this.shell.getPlayer().getPosition();
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
    this.shell.getPlayer().playAnim("idle", dir, true);
    // Start collection state (now 1 second)
    this.collectingBlock = {
      x: tx,
      y: ty,
      startTime: this.shell.time.now,
      timer: this.shell.time.delayedCall(this.collectBlockTimeMs, () => {
        // Only collect if pointer is still down on the same block
        const pointerDownTile = this.shell.getPointerDownTile();
        if (
          pointerDownTile &&
          pointerDownTile.x === tx &&
          pointerDownTile.y === ty &&
          this.shell.input.activePointer.isDown
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
  cancelBlockCollection() {
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
    const tile = this.shell.getWorld().getTileAt(tx, ty);
    if (tile) {
      // Try to add to inventory; if full, just remove block
      if (this.shell.getInventory().add(toBlock(tile.index))) {
        this.shell
          .getHud()
          .update(
            this.shell.getInventory().getSlots(),
            this.shell.getSelectedTool()
          );
      }

      if (tile.index === GRASS) {
        // Grass: replace with ground
        this.shell.getWorld().putTileAt(GROUND, tx, ty);
      } else if (tile.index === GROUND) {
        // Ground: replace with water
        this.shell.getWorld().putTileAt(WATER, tx, ty);
      } else if (tile.index === WATER) {
        // Water: do not replace
      } else if (tile.index === SNOW) {
        // Snow: replace with water
        this.shell.getWorld().putTileAt(WATER, tx, ty);
      } else if (tile.index === SAND) {
        // Sand: replace with water
        this.shell.getWorld().putTileAt(WATER, tx, ty);
      } else {
        // All other blocks: replace with water
        this.shell.getWorld().putTileAt(WATER, tx, ty);
      }
      // Optionally: show feedback if not added (inventory full)
    }
    // Progress bar is cleared by timer/cancel logic
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
    const highlightedTile = this.shell.getHighlightTile();
    if (highlightedTile) {
      const [playerX, playerY] = this.shell.getPlayer().getPosition();
      const { x, y } = highlightedTile;
      const px = Math.floor(playerX / TILE_SIZE);
      const py = Math.floor(playerY / TILE_SIZE);
      const dist = Math.abs(x - px) + Math.abs(y - py);
      // Visual feedback: green if in range, red if out of range
      const inRange = dist <= this.interactionRange;
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
  private getTileAt(tx: number, ty: number) {
    return this.shell.getWorld().getTileAt(tx, ty);
  }

  private getInteractableTiles(): { x: number; y: number }[] {
    const { x: px, y: py } = this.shell.getPlayer().getTile();
    const tiles: { x: number; y: number }[] = [];
    for (let dx = -this.interactionRange; dx <= this.interactionRange; dx++) {
      for (let dy = -this.interactionRange; dy <= this.interactionRange; dy++) {
        const x = px + dx;
        const y = py + dy;
        if (
          Math.abs(dx) + Math.abs(dy) <= this.interactionRange &&
          this.getTileAt(x, y)
        ) {
          tiles.push({ x, y });
        }
      }
    }
    return tiles;
  }

  private isInInteractRange(tx: number, ty: number): boolean {
    const { x: px, y: py } = this.shell.getPlayer().getTile();
    const dist = Math.abs(tx - px) + Math.abs(ty - py);
    return dist <= this.interactionRange;
  }
}
