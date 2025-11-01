import Phaser from "phaser";
import { GameScene } from "../scenes/GameScene";
import { TILE_SIZE } from "../constants";
import { toOption, isMode, isBlock, Block, Direction } from "../types";
import { assets } from "../assets";

export class PlaceMode {
  modeName = "place" as const;
  private shell: GameScene;
  // Placement sounds pool (e.g. soft thud/grass). Reuse asset group definitions.
  private placeSounds: Phaser.Sound.BaseSound[] = [];
  private lastPlaceSoundIndex: number = -1;
  private placeSoundIds = assets.audio.groups.PlaceGrass;

  constructor(shell: GameScene) {
    this.shell = shell;
    // Pre-build sounds so first placement is instant.
    this.placeSounds = this.placeSoundIds.map((id: string) =>
      shell.sound.add((assets.audio as any)[id], { volume: 0.55 })
    );
  }

  enter() {
    // Recreate sounds if they were cleared.
    if (!this.placeSounds.length) {
      const placeIds = assets.audio.groups.PlaceGrass;
      this.placeSounds = placeIds.map((id: string) =>
        (this.shell as any).sound.add((assets.audio as any)[id], {
          volume: 0.55,
        })
      );
    }
  }

  exit() {
    // Stop (not destroy) to allow reuse.
    this.placeSounds.forEach((s) => s.stop());
  }

  update(_time: number, _delta: number) {}

  onPointerMove(p: Phaser.Input.Pointer) {
    this.shell.getWorldManager().setHighlightTile(p.worldX, p.worldY);
  }

  onPointerDown(p: Phaser.Input.Pointer) {
    const tx = Math.floor(p.worldX / TILE_SIZE);
    const ty = Math.floor(p.worldY / TILE_SIZE);

    const selected = this.shell.getMode();
    // ensure it's a block option
    try {
      const opt = toOption(selected as unknown);
      if (isMode(opt)) return;
    } catch (e) {
      return;
    }

    const tile = this.shell.getWorldManager().getTileAtGlobal(tx, ty);
    if (!tile) return;

    const inventory = this.shell.getInventory();
    if (isBlock(selected) && !inventory.has(selected)) return;

    // If player stands on the same tile, require the player to move next to it first
    const pTile = this.shell.getPlayer().getTile();
    if (pTile.x === tx && pTile.y === ty) {
      this.shell.getPlayer().movePlayerAdjacentTo(tx, ty, () => {
        if (isBlock(selected)) {
          this.placeAt(tx, ty, selected);
        }
      });
      return;
    }

    // If already adjacent and not standing on the tile -> place immediately
    if (
      isBlock(selected) &&
      this.shell.getPlayer().isTileInteractable(tx, ty)
    ) {
      this.placeAt(tx, ty, selected);
      return;
    }

    // Not adjacent: move player adjacent to the tile, then place on arrival
    this.shell.getPlayer().movePlayerAdjacentTo(tx, ty, () => {
      if (isBlock(selected)) {
        this.placeAt(tx, ty, selected);
      }
    });
  }

  onPointerUp(_p: Phaser.Input.Pointer) {}

  private placeAt(tx: number, ty: number, selected: Block) {
    // Ensure the player stops moving — clear any shell target so
    // GameScene.update won't continue to call moveTo and play walk
    // animations which would override the facing set below.
    this.shell.getPlayer().setTarget(null);

    // Face the tile from player's current position
    const [playerX, playerY] = this.shell.getPlayer().getPosition();
    const px = Math.floor(playerX / TILE_SIZE);
    const py = Math.floor(playerY / TILE_SIZE);
    const dx = tx - px;
    const dy = ty - py;
    let dir: Direction = "down";
    if (dx !== 0) dir = dx > 0 ? "right" : "left";
    else if (dy !== 0) dir = dy > 0 ? "down" : "up";
    this.shell.getPlayer().playAnim("idle", dir, true);

    // perform place
    this.shell.getWorldManager().putTileAtGlobal(selected, tx, ty);
    // Play placement sound (after tile update for immediate feedback)
    this.playRandomPlaceSound();
    const remaining = this.shell.getInventory().remove(selected);
    if (remaining !== false) {
      if (remaining === 0) this.shell.selectMode("move");
      this.shell
        .getHud()
        .update(
          this.shell.getInventory().getBlocks(),
          this.shell.getMode(),
          this.shell.getInventory().getObjects()
        );
    }
  }

  private playRandomPlaceSound() {
    if (!this.placeSounds.length) return;
    let idx: number;
    do {
      idx = Phaser.Math.Between(0, this.placeSounds.length - 1);
    } while (this.placeSounds.length > 1 && idx === this.lastPlaceSoundIndex);
    const snd = this.placeSounds[idx];
    (snd as any).setDetune?.(Phaser.Math.Between(-35, 35));
    (snd as any).setRate?.(Phaser.Math.FloatBetween(0.96, 1.04));
    snd.play();
    this.lastPlaceSoundIndex = idx;
  }
}
