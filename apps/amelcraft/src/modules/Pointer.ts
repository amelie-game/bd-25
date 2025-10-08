import Phaser from "phaser";
import { GameScene } from "../scenes/GameScene";

type Shell = GameScene;

export class Pointer {
  private shell: Shell;
  private lastPinchDist: number | null = null;
  private pinching = false;

  constructor(shell: Shell) {
    this.shell = shell;
    this.shell.input.on("pointermove", this.onPointerMove, this);
    this.shell.input.on("pointerup", this.onPointerUp, this);
    this.shell.input.on("pointerdown", this.onPointerDown, this);
  }

  // Public getter
  isPinching() {
    return this.pinching;
  }

  destroy() {
    this.shell.input.off("pointermove", this.onPointerMove, this);
    this.shell.input.off("pointerup", this.onPointerUp, this);
    this.shell.input.off("pointerdown", this.onPointerDown, this);
  }

  private onPointerDown(_p: Phaser.Input.Pointer) {
    // no-op for now; keep for symmetry / future use
  }

  private onPointerUp(_p: Phaser.Input.Pointer) {
    // End pinch on pointer up
    this.pinching = false;
    this.lastPinchDist = null;
  }

  private onPointerMove(p: Phaser.Input.Pointer) {
    const event = p.event as TouchEvent | PointerEvent | undefined;
    if (event && "touches" in event && event.touches.length === 2) {
      const [t1, t2] = event.touches;
      const dist = Phaser.Math.Distance.Between(
        t1.clientX,
        t1.clientY,
        t2.clientX,
        t2.clientY
      );
      if (this.lastPinchDist !== null) {
        const diff = dist - this.lastPinchDist;
        if (Math.abs(diff) > 2) {
          this.pinching = true;
        }
      }
      this.lastPinchDist = dist;
    } else {
      this.lastPinchDist = null;
      this.pinching = false;
    }
  }
}
