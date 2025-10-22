import Phaser from "phaser";
import { GameScene } from "../scenes/GameScene";
import { TILE_SIZE } from "../constants";
import { assets } from "../assets";
// getDirection not needed here — facing is handled in startCollection
import { Direction, toBlock } from "../types";

export class CollectMode {
  modeName = "collect" as const;
  private shell: GameScene;
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private collecting: {
    x: number;
    y: number;
    startTime: number;
    timer: Phaser.Time.TimerEvent;
  } | null = null;
  private collectionProgress = 0;
  private collectTime = 1000; // ms

  constructor(shell: GameScene) {
    this.shell = shell;
  }

  enter() {
    this.gfx = this.shell.add.graphics();
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
      const elapsed = this.shell.time.now - this.collecting.startTime;
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
    const tile = this.shell.getWorldManager().getHighlightTile();
    if (tile) {
      const { x, y } = tile;
      // Draw progress bar if collecting this tile
      if (
        this.collecting &&
        this.collecting.x === x &&
        this.collecting.y === y
      ) {
        const sx = x * TILE_SIZE;
        const sy = y * TILE_SIZE;
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

    // Update highlight tile using a shared World helper (avoids duplicated math).
    this.shell.getWorldManager().setHighlightTile(p.worldX, p.worldY);

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
    // abort collection
    this.cancelCollection();
  }

  private tryStartCollection(tx: number, ty: number) {
    const tile = this.shell.getWorldManager().getTileAtGlobal(tx, ty);
    if (!tile) return;

    const pTile = this.shell.getPlayer().getTile();

    // If player stands on the same tile, require the player to move next to it first
    if (pTile.x === tx && pTile.y === ty) {
      const moved = this.shell.getPlayer().movePlayerAdjacentTo(tx, ty, () => {
        // start collection once arrived; facing will be set by startCollection
        this.startCollection(tx, ty);
      });
      // If no move was possible, just bail.
      return;
    }

    // Determine adjacency (use the shared helper). If target is adjacent/collectable, start immediately.
    if (this.shell.getPlayer().isTileInteractable(tx, ty)) {
      this.startCollection(tx, ty);
      return;
    }

    const moved = this.shell.getPlayer().movePlayerAdjacentTo(tx, ty, () => {
      this.startCollection(tx, ty);
    });
  }

  private startCollection(tx: number, ty: number) {
    // Cancel existing
    this.cancelCollection();

    // Ensure the player stops moving — clear any shell target so
    // GameScene.update won't continue to call moveTo and play walk
    // animations which would override the facing set below.
    this.shell.getPlayer().setTarget(null);

    // Make player face the block being collected
    const [playerX, playerY] = this.shell.getPlayer().getPosition();
    const px = Math.floor(playerX / TILE_SIZE);
    const py = Math.floor(playerY / TILE_SIZE);
    const dx = tx - px;
    const dy = ty - py;
    let dir: Direction = "down";
    if (dx !== 0) dir = dx > 0 ? "right" : "left";
    else if (dy !== 0) dir = dy > 0 ? "down" : "up";
    this.shell.getPlayer().playAnim("idle", dir, true);

    this.collecting = {
      x: tx,
      y: ty,
      startTime: this.shell.time.now,
      timer: this.shell.time.delayedCall(this.collectTime, () => {
        // verify pointer still down and at same tile
        const p = this.shell.input.activePointer;
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
    // Step 7: Object-first collection priority
    const wm = this.shell.getWorldManager();
    const objectAt = wm.getObjectAtGlobal(tx, ty);

    if (objectAt) {
      const id = objectAt.id;
      // Rock collection logic: rocks shrink until removed; award blocks at each successful collection
      if (id.startsWith("rock_")) {
        // Award 5 each of LightGrey, Grey, Black (atomic add; if cannot add all, attempt partial?)
        const batches = [
          { block: assets.blocks.sprites.LightGrey, count: 5 },
          { block: assets.blocks.sprites.Grey, count: 5 },
          { block: assets.blocks.sprites.Black, count: 5 },
        ];
        // Attempt atomic add; if fails due to capacity, try individual adds best-effort
        const inv = this.shell.getInventory();
        if (inv.canAddAllBlocks(batches)) {
          batches.forEach((b) => inv.addMany(b.block, b.count));
        } else {
          batches.forEach((b) => {
            // degrade to single additions until stack full
            for (let i = 0; i < b.count; i++) {
              if (!inv.add(b.block)) break;
            }
          });
        }
        // Transition rock size
        let nextId: string | null = null;
        if (id === "rock_large") nextId = "rock_medium";
        else if (id === "rock_medium") nextId = "rock_small";
        else if (id === "rock_small") nextId = "rock_extrasmall";
        else if (id === "rock_extrasmall") nextId = null; // final removal
        // Remove current object
        wm.removeObjectAtGlobal(tx, ty);
        // Spawn smaller variant if any remains
        if (nextId) {
          // Re-add object with next size
          const { chunkX, chunkY, localX, localY } = wm.getObjectAtGlobal(
            tx,
            ty
          ) || {
            chunkX: Math.floor(tx / (assets as any).CHUNK_TILES || 0),
            chunkY: Math.floor(ty / (assets as any).CHUNK_TILES || 0),
            localX: tx,
            localY: ty,
          };
          // Direct chunk manipulation (safer): convert global tile coords
          const {
            chunkX: cX,
            chunkY: cY,
            localX: lx,
            localY: ly,
          } = (wm as any).globalTileToChunk?.(tx, ty) || {
            chunkX: 0,
            chunkY: 0,
            localX: tx,
            localY: ty,
          };
          const chunk = (wm as any).activeChunks?.get?.(`${cX}:${cY}`);
          chunk?.addObject?.(nextId, lx, ly);
        }
        this.shell
          .getHud()
          .update(
            this.shell.getInventory().getBlocks(),
            this.shell.getMode(),
            this.shell.getInventory().getObjects()
          );
        return; // do not mutate tile for rock collection
      }
      // Flower or other collectible: attempt to add
      const added = this.shell.getInventory().addObject(id);
      if (added) {
        wm.removeObjectAtGlobal(tx, ty);
        this.shell
          .getHud()
          .update(
            this.shell.getInventory().getBlocks(),
            this.shell.getMode(),
            this.shell.getInventory().getObjects()
          );
        return; // do not mutate tile when object collected
      }
      // If inventory full for this object, fall through to tile logic (optional policy)
    }
    const tile = this.shell.getWorldManager().getTileAtGlobal(tx, ty);
    if (!tile) return;

    // Try to add to inventory
    if (this.shell.getInventory().add(toBlock(tile.index))) {
      this.shell
        .getHud()
        .update(
          this.shell.getInventory().getBlocks(),
          this.shell.getMode(),
          this.shell.getInventory().getObjects()
        );
    }

    if (tile.index === GRASS) {
      this.shell.getWorldManager().putTileAtGlobal(GROUND, tx, ty);
    } else if (tile.index === GROUND) {
      this.shell.getWorldManager().putTileAtGlobal(WATER, tx, ty);
    } else if (tile.index === WATER) {
      // do nothing
    } else if (tile.index === SNOW) {
      this.shell.getWorldManager().putTileAtGlobal(GRASS, tx, ty);
    } else if (tile.index === SAND) {
      this.shell.getWorldManager().putTileAtGlobal(WATER, tx, ty);
    } else {
      this.shell.getWorldManager().putTileAtGlobal(WATER, tx, ty);
    }
  }

  // public getters for UI/debug
  getCollectionProgress() {
    return this.collectionProgress;
  }
}
