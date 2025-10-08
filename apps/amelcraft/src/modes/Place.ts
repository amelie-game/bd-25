import Phaser from "phaser";
import { GameScene } from "../scenes/GameScene";
import { TILE_SIZE } from "../main";
import { toOption, isMode, isBlock, Block, Direction } from "../types";

export class PlaceMode {
  modeName = "place" as const;
  private scene: GameScene;
  private gfx: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  enter() {
    this.gfx = this.scene.add.graphics();
    this.gfx.setDepth(10);
  }

  exit() {
    if (this.gfx) {
      this.gfx.destroy();
      this.gfx = null;
    }
  }

  update(_time: number, _delta: number) {
    if (!this.gfx) return;
    this.gfx.clear();
    const tile = this.scene.getWorld().getHighlightTile();
    if (!tile) return;
    const { x, y } = tile;
    const sx = x * TILE_SIZE;
    const sy = y * TILE_SIZE;
    this.gfx.lineStyle(2, 0x00ff00, 0.7);
    this.gfx.fillStyle(0x00ff00, 0.12);
    this.gfx.strokeRect(sx, sy, TILE_SIZE, TILE_SIZE);
    this.gfx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
  }

  onPointerMove(p: Phaser.Input.Pointer) {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);

    // always update highlightTile for convenience
    this.scene.getWorld().setHighlightTile({ x: tx, y: ty });
  }

  onPointerDown(p: Phaser.Input.Pointer) {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);

    const selected = this.scene.getSelectedTool();
    // ensure it's a block option
    try {
      const opt = toOption(selected as unknown);
      if (isMode(opt)) return;
    } catch (e) {
      return;
    }

    const world = this.scene.getWorld();
    const tile = world.getTileAt(tx, ty);
    if (!tile) return;

    const inventory = this.scene.getInventory();
    if (isBlock(selected) && !inventory.has(selected)) return;

    // If player stands on the same tile, require the player to move next to it first
    const pTile = this.scene.getPlayer().getTile();
    if (pTile.x === tx && pTile.y === ty) {
      this.scene.getPlayer().movePlayerAdjacentTo(tx, ty, () => {
        if (isBlock(selected)) {
          this.placeAt(tx, ty, selected);
        }
      });
      return;
    }

    // If already adjacent and not standing on the tile -> place immediately
    if (
      isBlock(selected) &&
      this.scene.getPlayer().isTileInteractable(tx, ty)
    ) {
      this.placeAt(tx, ty, selected);
      return;
    }

    // Not adjacent: move player adjacent to the tile, then place on arrival
    this.scene.getPlayer().movePlayerAdjacentTo(tx, ty, () => {
      if (isBlock(selected)) {
        this.placeAt(tx, ty, selected);
      }
    });
  }

  onPointerUp(_p: Phaser.Input.Pointer) {}

  private placeAt(tx: number, ty: number, selected: Block) {
    // Ensure the player stops moving — clear any scene target so
    // GameScene.update won't continue to call moveTo and play walk
    // animations which would override the facing set below.
    this.scene.getPlayer().setTarget(null);

    // Face the tile from player's current position
    const [playerX, playerY] = this.scene.getPlayer().getPosition();
    const px = Math.floor(playerX / TILE_SIZE);
    const py = Math.floor(playerY / TILE_SIZE);
    const dx = tx - px;
    const dy = ty - py;
    let dir: Direction = "down";
    if (dx !== 0) dir = dx > 0 ? "right" : "left";
    else if (dy !== 0) dir = dy > 0 ? "down" : "up";
    this.scene.getPlayer().playAnim("idle", dir, true);

    // perform place
    this.scene.getWorld().putTileAt(selected, tx, ty);
    const remaining = this.scene.getInventory().remove(selected);
    if (remaining !== false) {
      if (remaining === 0) this.scene.setSelectedTool("move");
      this.scene
        .getHud()
        .update(
          this.scene.getInventory().getSlots(),
          this.scene.getSelectedTool()
        );
    }
  }
}
