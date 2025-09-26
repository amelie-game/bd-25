import Phaser from "phaser";

export class InputHandler {
  private scene: Phaser.Scene;
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  onPointerMove(cb: (pointer: Phaser.Input.Pointer) => void) {/* TODO */}
  onPointerDown(cb: (pointer: Phaser.Input.Pointer) => void) {/* TODO */}
  onPointerUp(cb: (pointer: Phaser.Input.Pointer) => void) {/* TODO */}
}