import Phaser from "phaser";
import { GameScene } from "../scenes/GameScene";
import { TILE_SIZE } from "../main";
import { assets } from "../assets";
// getDirection not needed here — facing is handled in startCollection
import { Direction, toBlock } from "../types";

export class CollectMode {
  modeName = "collect" as const;
  private scene: GameScene;
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private collecting: {
    x: number;
    y: number;
    startTime: number;
    timer: Phaser.Time.TimerEvent;
  } | null = null;
  private collectionProgress = 0;
  private collectTime = 1000; // ms

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  enter() {
    this.gfx = this.scene.add.graphics();
    this.gfx.setDepth(10);
  }

  exit() {
    this.cancelCollection();
    if (this.gfx) {
      this.gfx.destroy();
      this.gfx = null;
    }
  }

  update(time: number, delta: number) {
    if (this.collecting) {
      const elapsed = this.scene.time.now - this.collecting.startTime;
      this.collectionProgress = Phaser.Math.Clamp(
        elapsed / this.collectTime,
        0,
        1
      );
    } else {
      this.collectionProgress = 0;
    }
    // draw highlights/progress
    if (!this.gfx) return;
    this.gfx.clear();
    const tile = this.scene.getHighlightTile();
    if (tile) {
      const { x, y } = tile;
      // Use 8-connected adjacency to determine immediate collectability: tiles with Chebyshev distance <= 1
      const inRange = this.scene.isTileInteractable(x, y);
      const sx = x * TILE_SIZE;
      const sy = y * TILE_SIZE;
      this.gfx.lineStyle(2, inRange ? 0x00ff00 : 0xff0000, 0.7);
      this.gfx.fillStyle(inRange ? 0x00ff00 : 0xff0000, 0.12);
      this.gfx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
      this.gfx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

      // Draw progress bar if collecting this tile
      if (
        this.collecting &&
        this.collecting.x === x &&
        this.collecting.y === y
      ) {
        const barWidth = TILE_SIZE * 0.8;
        const barHeight = 6;
        const barX = sx + TILE_SIZE * 0.1;
        const barY = sy - 10;
        // Background
        this.gfx.fillStyle(0x222222, 0.7);
        this.gfx.fillRect(barX, barY, barWidth, barHeight);
        // Progress
        this.gfx.fillStyle(0x00ff00, 0.9);
        this.gfx.fillRect(
          barX,
          barY,
          barWidth * this.collectionProgress,
          barHeight
        );
        // Border
        this.gfx.lineStyle(1, 0xffffff, 0.8);
        this.gfx.strokeRect(barX, barY, barWidth, barHeight);
      }
    }
  }

  onPointerMove(p: Phaser.Input.Pointer) {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);

    // If dragging to new tile while collecting: cancel current and start new if pointer still down
    if (this.collecting) {
      if (this.collecting.x !== tx || this.collecting.y !== ty) {
        // cancel current
        this.cancelCollection();
        if (p.isDown) {
          // If pointer still down, start on new tile if in range or move next to it first
          this.tryStartCollection(tx, ty);
        }
      }
    }
  }

  onPointerDown(p: Phaser.Input.Pointer) {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);
    this.tryStartCollection(tx, ty);
  }

  onPointerUp(p: Phaser.Input.Pointer) {
    // abort collection if any
    this.cancelCollection();
  }

  private tryStartCollection(tx: number, ty: number) {
    const world = this.scene.getWorld();
    const tile = world.getTileAt(tx, ty);
    if (!tile) return;

    const pTile = this.scene.getPlayer().getTile();

    // If player stands on the same tile, require the player to move next to it first
    if (pTile.x === tx && pTile.y === ty) {
      const moved = this.scene.movePlayerAdjacentTo(tx, ty, () => {
        // start collection once arrived; facing will be set by startCollection
        this.startCollection(tx, ty);
      });
      // If no move was possible, just bail.
      return;
    }

    // Determine adjacency (use the shared helper). If target is adjacent/collectable, start immediately.
    if (this.scene.isTileInteractable(tx, ty)) {
      this.startCollection(tx, ty);
      return;
    }

    const moved = this.scene.movePlayerAdjacentTo(tx, ty, () => {
      this.startCollection(tx, ty);
    });
  }

  private startCollection(tx: number, ty: number) {
    // Cancel existing
    this.cancelCollection();

    // Ensure the player stops moving — clear any scene target so
    // GameScene.update won't continue to call moveTo and play walk
    // animations which would override the facing set below.
    this.scene.setTarget(null);

    // Make player face the block being collected
    const [playerX, playerY] = this.scene.getPlayer().getPosition();
    const px = Math.floor(playerX / TILE_SIZE);
    const py = Math.floor(playerY / TILE_SIZE);
    const dx = tx - px;
    const dy = ty - py;
    let dir: Direction = "down";
    if (dx !== 0) dir = dx > 0 ? "right" : "left";
    else if (dy !== 0) dir = dy > 0 ? "down" : "up";
    this.scene.getPlayer().playAnim("idle", dir, true);

    this.collecting = {
      x: tx,
      y: ty,
      startTime: this.scene.time.now,
      timer: this.scene.time.delayedCall(this.collectTime, () => {
        // verify pointer still down and at same tile
        const p = this.scene.input.activePointer;
        const pointerTile = {
          x: Math.floor(p.worldX / TILE_SIZE),
          y: Math.floor(p.worldY / TILE_SIZE),
        };
        if (p.isDown && pointerTile.x === tx && pointerTile.y === ty) {
          this.finishCollection(tx, ty);
        }
        this.collecting = null;
        this.collectionProgress = 0;
      }),
    };
    this.collectionProgress = 0;
  }

  private cancelCollection() {
    if (this.collecting) {
      if (!this.collecting.timer.hasDispatched)
        this.collecting.timer.remove(false);
      this.collecting = null;
      this.collectionProgress = 0;
    }
  }

  private finishCollection(tx: number, ty: number) {
    const GRASS = assets.blocks.sprites.Grass;
    const WATER = assets.blocks.sprites.Water;
    const GROUND = assets.blocks.sprites.Brown;
    const SNOW = assets.blocks.sprites.Snow;
    const SAND = assets.blocks.sprites.Yellow;
    const world = this.scene.getWorld();
    const tile = world.getTileAt(tx, ty);
    if (!tile) return;

    // Try to add to inventory
    if (this.scene.getInventory().add(toBlock(tile.index))) {
      this.scene
        .getHud()
        .update(
          this.scene.getInventory().getSlots(),
          this.scene.getSelectedTool()
        );
    }

    if (tile.index === GRASS) {
      world.putTileAt(GROUND, tx, ty);
    } else if (tile.index === GROUND) {
      world.putTileAt(WATER, tx, ty);
    } else if (tile.index === WATER) {
      // do nothing
    } else if (tile.index === SNOW) {
      world.putTileAt(WATER, tx, ty);
    } else if (tile.index === SAND) {
      world.putTileAt(WATER, tx, ty);
    } else {
      world.putTileAt(WATER, tx, ty);
    }
  }

  // public getters for UI/debug
  getCollectionProgress() {
    return this.collectionProgress;
  }
}
