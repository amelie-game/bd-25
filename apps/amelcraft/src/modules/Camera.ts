import Phaser from "phaser";
import { GameScene } from "../scenes/GameScene";
import { TILE_SIZE } from "../constants";

type Shell = GameScene;

type Params = {
  shell: Shell;
};

export class Camera {
  static DEFAULT_MIN_ZOOM = 0.2;
  static DEFAULT_MAX_ZOOM = 1.0;
  static DEFAULT_MIN_VISIBLE_TILES = 8; // at most 8 tiles visible horizontally at max zoom
  static DEFAULT_MARGIN_TILES = 3;
  static DEFAULT_PANNING_SPEED = 0.01; // px/s when using keyboard to pan

  private minZoom = Camera.DEFAULT_MIN_ZOOM;
  private maxZoom = Camera.DEFAULT_MAX_ZOOM;
  private minVisibleTiles = Camera.DEFAULT_MIN_VISIBLE_TILES;
  private marginTiles = Camera.DEFAULT_MARGIN_TILES;
  private panningSpeed = Camera.DEFAULT_PANNING_SPEED;
  private lastPinchDist: number | null = null;
  private shell: Shell;
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor({ shell }: Params) {
    this.shell = shell;
    this.camera = this.shell.cameras.main;

    this.camera.roundPixels = true;
    const worldDimensions = this.shell.getWorld().getDimensions();
    this.camera.setBounds(0, 0, worldDimensions[0], worldDimensions[1]);
    this.computeZoomBounds();
    this.camera.setZoom(Phaser.Math.Clamp(1, this.minZoom, this.maxZoom));
    const player = this.shell.getPlayer().getPosition();
    this.camera.centerOn(player[0], player[1]);

    // Basic input wiring: zoom via wheel/pinch will call setZoom and recenter on player
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

    this.shell.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const event = pointer.event as TouchEvent | PointerEvent | undefined;
      // Detect pinch directly from the underlying touch event (works on mobile)
      if (event && "touches" in event && this.shell.getPointer().isPinching()) {
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
            // map distance delta to zoom delta (small factor)
            this.setZoom(this.camera.zoom + diff * 0.002);
          }
        }
        this.lastPinchDist = dist;
        this.shell.getPlayer().stop(); // stop player movement when pinching
      } else {
        setTimeout(() => {
          // slight delay to avoid flicker when pinch ends
          this.lastPinchDist = null;
        }, 50);
      }
    });

    // Also listen for pointerup to clear pinching state (in case touches end)
    this.shell.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      this.lastPinchDist = null;
    });
  }

  // public API: allow external callers to set zoom
  setZoom(z: number) {
    const clamped = Phaser.Math.Clamp(z, this.minZoom, this.maxZoom);
    this.camera.setZoom(clamped);
  }

  // public API: recenter on player
  recenter() {
    const [playerX, playerY] = this.shell.getPlayer().getPosition();
    this.camera.centerOn(playerX, playerY);
    this.clamp();
  }

  // public API: called each frame; draw HUD rect debug overlay
  update(time: number, delta: number) {
    const playerSprite = this.shell.getPlayer().getSprite();
    const camera = this.camera;

    const margin = (this.marginTiles * TILE_SIZE) / camera.zoom;
    const panBy = margin;
    const smoothSpeed = this.panningSpeed; // smaller = slower/smoother

    const worldView = camera.worldView;

    // Player edges (world-space)
    const playerLeft = playerSprite.x - playerSprite.displayWidth / 2;
    const playerRight = playerSprite.x + playerSprite.displayWidth / 2;
    const playerTop = playerSprite.y - playerSprite.displayHeight / 2;
    const playerBottom = playerSprite.y + playerSprite.displayHeight / 2;

    // Camera edges (world-space)
    const leftEdge = worldView.x + margin;
    const rightEdge = worldView.right - margin;
    const topEdge = worldView.y + margin;
    const bottomEdge = worldView.bottom - margin;

    let targetScrollX = camera.scrollX;
    let targetScrollY = camera.scrollY;

    // ---- Horizontal movement ----
    if (playerLeft < leftEdge) {
      const panAmount = leftEdge - playerLeft + panBy;
      targetScrollX = camera.scrollX - panAmount;
    } else if (playerRight > rightEdge) {
      const panAmount = playerRight - rightEdge + panBy;
      targetScrollX = camera.scrollX + panAmount;
    }

    // ---- Vertical movement ----
    if (playerTop < topEdge) {
      const panAmount = topEdge - playerTop + panBy;
      targetScrollY = camera.scrollY - panAmount;
    } else if (playerBottom > bottomEdge) {
      const panAmount = playerBottom - bottomEdge + panBy;
      targetScrollY = camera.scrollY + panAmount;
    }

    if (targetScrollX !== camera.scrollX) {
      camera.scrollX = Phaser.Math.Linear(
        camera.scrollX,
        targetScrollX,
        smoothSpeed
      );
    }

    if (targetScrollY !== camera.scrollY) {
      camera.scrollY = Phaser.Math.Linear(
        camera.scrollY,
        targetScrollY,
        smoothSpeed
      );
    }
  }

  private clamp() {
    const cam = this.camera;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const maxScrollX = this.shell.getWorld().getDimensions()[0] - viewW;
    const maxScrollY = this.shell.getWorld().getDimensions()[1] - viewH;
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, Math.max(0, maxScrollX));
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, Math.max(0, maxScrollY));
  }

  private computeZoomBounds() {
    const worldDimensions = this.shell.getWorld().getDimensions();
    // Use the dominant viewport axis to compute zoom bounds:
    // - landscape (width >= height): compute zoom based on width vs world width
    // - portrait (height > width): compute zoom based on height vs world height
    const useHeight = this.camera.height > this.camera.width; // portrait
    // Fit zoom: zoom at which the full world dimension fits the viewport along dominant axis
    const fitZoom = useHeight
      ? this.camera.height / worldDimensions[1]
      : this.camera.width / worldDimensions[0];
    // Minimum allowed zoom is exactly the zoom that fits the world along the dominant axis.
    this.minZoom = fitZoom;
    // Max zoom: ensure at most `minVisibleTiles` visible along the dominant axis (or at least 1.0)
    const maxAxisPixels = useHeight ? this.camera.height : this.camera.width;
    const axisTilesZoom = maxAxisPixels / (this.minVisibleTiles * TILE_SIZE);
    this.maxZoom = Math.max(1, axisTilesZoom);
    if (this.maxZoom < this.minZoom) this.maxZoom = this.minZoom + 0.0001; // ensure a tiny range if device is very small
  }
}
