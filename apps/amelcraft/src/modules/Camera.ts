import Phaser from "phaser";
import { GameScene } from "../scenes/GameScene";
import { TILE_SIZE } from "../main";

type Shell = Pick<GameScene, "cameras" | "input" | "getPlayer" | "getWorld">;

type Params = {
  shell: Shell;
};

export class Camera {
  static DEFAULT_MIN_ZOOM = 0.2;
  static DEFAULT_MAX_ZOOM = 1.0;

  private minZoom = Camera.DEFAULT_MIN_ZOOM;
  private maxZoom = Camera.DEFAULT_MAX_ZOOM;
  private lastPinchDist: number | null = null;
  private shell: Shell;
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor({ shell }: Params) {
    this.shell = shell;
    this.camera = this.shell.cameras.main;

    // Wheel Zoom
    this.shell.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        gameObjects: Phaser.GameObjects.GameObject[],
        deltaX: number,
        deltaY: number,
        deltaZ: number
      ) => {
        const zoomChange = deltaY > 0 ? -0.1 : 0.1;
        this.setZoom(this.camera.zoom + zoomChange);
      }
    );

    // Pinch zoom for touch devices
    this.shell.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const event = pointer.event as TouchEvent | PointerEvent | undefined;
      if (event && "touches" in event && event.touches.length === 2) {
        const [p1, p2] = event.touches;
        const dist = Phaser.Math.Distance.Between(
          p1.clientX,
          p1.clientY,
          p2.clientX,
          p2.clientY
        );
        if (this.lastPinchDist !== null) {
          const diff = dist - this.lastPinchDist;
          if (Math.abs(diff) > 2) {
            this.setZoom(this.camera.zoom + diff * 0.002);
          }
        }
        this.lastPinchDist = dist;
      } else {
        this.lastPinchDist = null;
      }
    });

    this.camera.roundPixels = true;
    this.camera.setBounds(0, 0, ...this.shell.getWorld().getDimensions());
    this.computeZoomBounds();
    this.setZoom(Phaser.Math.Clamp(1, this.minZoom, this.maxZoom));
  }

  setZoom(z: number) {
    const clamped = Phaser.Math.Clamp(z, this.minZoom, this.maxZoom);
    // Set zoom
    this.camera.setZoom(clamped);
    // Center camera on player
    this.recenter();
  }

  recenter() {
    const [playerX, playerY] = this.shell.getPlayer().getPosition();
    this.centerOn(playerX, playerY);
    this.clamp();
  }

  private centerOn(x: number, y: number) {
    this.camera.centerOn(x, y);
  }

  private clamp() {
    // Ensure camera view stays within world bounds after zooming
    const cam = this.camera;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const maxScrollX = this.shell.getWorld().getDimensions()[0] - viewW;
    const maxScrollY = this.shell.getWorld().getDimensions()[1] - viewH;
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, Math.max(0, maxScrollX));
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, Math.max(0, maxScrollY));
  }

  private computeZoomBounds() {
    // Enforce: user must never zoom out beyond seeing all 100 horizontal tiles.
    // Visible horizontal tiles = camera.displayWidth / TILE_SIZE = (cam.width / zoom) / TILE_SIZE
    // To cap at 100 tiles: zoom >= cam.width / (100 * TILE_SIZE)
    const cam = this.camera;
    const fitWorldWidthZoom =
      cam.width / this.shell.getWorld().getDimensions()[0]; // zoom at which full 100 tiles exactly fit horizontally
    // Minimum allowed zoom is exactly the zoom that fits world width. (Not using height so we never show space beyond right edge.)
    this.minZoom = fitWorldWidthZoom;
    // Max zoom: only 8 tiles visible horizontally (or at least 1.0 if screen narrower than 8 tiles). This keeps tiles large.
    const eightTilesZoom = cam.width / (8 * TILE_SIZE);
    this.maxZoom = Math.max(1, eightTilesZoom);
    if (this.maxZoom < this.minZoom) this.maxZoom = this.minZoom + 0.0001; // ensure a tiny range if device is very small
  }
}
