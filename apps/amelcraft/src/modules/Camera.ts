import Phaser from "phaser";

export class CameraController {
  private camera: Phaser.Cameras.Scene2D.Camera;
  constructor(camera: Phaser.Cameras.Scene2D.Camera) {
    this.camera = camera;
  }
  setZoom(z: number) {/* TODO */}
  centerOn(x: number, y: number) { this.camera.centerOn(x, y); }
  clamp() {/* TODO */}
}