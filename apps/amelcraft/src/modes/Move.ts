import Phaser from "phaser";
import { GameScene } from "../scenes/GameScene";

export class MoveMode {
  modeName = "move" as const;
  private shell: GameScene;
  private dragging = false;

  constructor(shell: GameScene) {
    this.shell = shell;
  }

  enter() {
    // Clear highlight via manager to avoid referencing a specific chunk instance
    this.shell.getWorldManager().setHighlightTile(-1, -1); // outside any chunk
  }

  exit() {
    this.dragging = false;
  }

  update(time: number, delta: number) {
    // nothing to update for pure move mode
  }

  onPointerMove(p: Phaser.Input.Pointer) {
    if (p.isDown) {
      // while dragging, move player toward pointer
      this.dragging = true;
      this.shell.getPlayer().setTarget({ x: p.worldX, y: p.worldY });
    }
  }

  onPointerDown(p: Phaser.Input.Pointer) {
    // start moving to pointer immediately
    this.shell.getPlayer().setTarget({ x: p.worldX, y: p.worldY });
  }

  onPointerUp(p: Phaser.Input.Pointer) {
    // stop dragging
    this.dragging = false;
  }
}
