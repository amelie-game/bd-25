import Phaser from "phaser";
import { GameScene } from "../scenes/GameScene";
import { TILE_SIZE } from "../main";

export class MoveMode {
  modeName = "move" as const;
  private scene: GameScene;
  private dragging = false;

  constructor(scene: GameScene) {
    this.scene = scene;
  }

  enter() {
    // Nothing special for now
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
      this.scene.setTarget({ x: p.worldX, y: p.worldY });
    }
  }

  onPointerDown(p: Phaser.Input.Pointer) {
    // start moving to pointer immediately
    this.scene.setTarget({ x: p.worldX, y: p.worldY });
  }

  onPointerUp(p: Phaser.Input.Pointer) {
    // stop dragging
    this.dragging = false;
  }
}
