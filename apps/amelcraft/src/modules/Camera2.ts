import Phaser from "phaser";
import { GameScene } from "../scenes/GameScene";
import { TILE_SIZE } from "../main";

type Shell = GameScene;

type Params = {
  shell: Shell;
  marginTiles?: number;
};

export class Camera {
  static DEFAULT_MIN_ZOOM = 0.2;
  static DEFAULT_MAX_ZOOM = 1.0;
  static DEFAULT_MIN_VISIBLE_TILES = 8; // at most 8 tiles visible horizontally at max zoom
  static DEFAULT_MARGIN_TILES = 2;

  private minZoom = Camera.DEFAULT_MIN_ZOOM;
  private maxZoom = Camera.DEFAULT_MAX_ZOOM;
  private minVisibleTiles = Camera.DEFAULT_MIN_VISIBLE_TILES;
  private marginTiles = Camera.DEFAULT_MARGIN_TILES;
  private lastPinchDist: number | null = null;
  private shell: Shell;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private hudGfx: Phaser.GameObjects.Graphics | null = null;
  private panLerp = 0.14; // how quickly camera follows when player hits margin
  private marginTilesLocal: number;

  constructor({ shell, marginTiles }: Params) {
    this.shell = shell;
    this.camera = this.shell.cameras.main;
    this.marginTilesLocal =
      typeof marginTiles === "number"
        ? marginTiles
        : Camera.DEFAULT_MARGIN_TILES;

    this.camera.roundPixels = true;
    const worldDimensions = this.shell.getWorld().getDimensions();
    this.camera.setBounds(0, 0, worldDimensions[0], worldDimensions[1]);
    this.computeZoomBounds();
    this.camera.setZoom(Phaser.Math.Clamp(1, this.minZoom, this.maxZoom));
    const player = this.shell.getPlayer().getPosition();
    this.camera.centerOn(player[0], player[1]);

    // Debug overlay: draw HUD bounding rect in screen space
    this.hudGfx = this.shell.add.graphics();
    this.hudGfx.setDepth(1000);
    // Keep HUD debug overlay fixed to the camera (screen space)
    // Note: don't call `camera.ignore` here — that prevents the main camera
    // from rendering the graphics at all. Use scrollFactor=0 so the graphics
    // remain fixed to the viewport; we'll convert world margin -> screen px
    // when drawing so the rectangle matches the auto-pan logic.
    this.hudGfx.setScrollFactor(0);
    this.drawBoundary();

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
    // keep player centered when zoom changes
    // If the viewport after zooming is larger than the world, allow centering on the player
    // (this may show empty space outside the world) so zoom still feels focused on the player.
    const cam = this.camera;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const worldW = this.shell.getWorld().getDimensions()[0];
    const worldH = this.shell.getWorld().getDimensions()[1];

    const [playerX, playerY] = this.shell.getPlayer().getPosition();
    if (viewW >= worldW || viewH >= worldH) {
      // center camera on player even if it places scroll outside world bounds
      cam.centerOn(playerX, playerY);
      // do not clamp to world bounds in this case so player remains centered
    } else {
      // normal behaviour: center and clamp to world bounds
      this.recenter();
    }
    // redraw debug overlays to reflect the new zoom
    this.drawBoundary(true);
  }

  // public API: recenter on player
  recenter() {
    const [playerX, playerY] = this.shell.getPlayer().getPosition();
    this.camera.centerOn(playerX, playerY);
    this.clamp();
  }

  // public API: called each frame; draw HUD rect debug overlay
  update(_time: number, _delta: number) {}

  drawBoundary(debug: boolean = false) {
    if (!this.hudGfx) return;
    this.hudGfx.clear();

    // Compute inner margin rectangle in world coordinates (same logic as auto-pan)
    const cam = this.camera;
    const viewW = cam.width / cam.zoom; // world pixels visible horizontally
    const viewH = cam.height / cam.zoom; // world pixels visible vertically
    const marginWorldPx = this.marginTilesLocal * TILE_SIZE; // margin in world pixels

    const innerLeft = cam.scrollX + marginWorldPx;
    const innerTop = cam.scrollY + marginWorldPx;
    const innerRight = cam.scrollX + viewW - marginWorldPx;
    const innerBottom = cam.scrollY + viewH - marginWorldPx;

    // Convert world-space inner rect -> screen-space (pixels). Because we call
    // `this.camera.ignore(this.hudGfx)` the graphics are drawn in raw canvas
    // coordinates (0..cam.width, 0..cam.height), so we convert using scroll & zoom.
    const sx = (innerLeft - cam.scrollX) * cam.zoom; // should equal marginWorldPx * cam.zoom
    const sy = (innerTop - cam.scrollY) * cam.zoom;
    const sw = Math.max(0, (innerRight - innerLeft) * cam.zoom);
    const sh = Math.max(0, (innerBottom - innerTop) * cam.zoom);

    if (debug) {
      console.log({
        sx,
        sy,
        sw,
        sh,
        viewW,
        viewH,
        marginWorldPx,
        innerLeft,
        innerTop,
      });
    }

    this.hudGfx.lineStyle(10, 0xff0000, 1);
    this.hudGfx.strokeRect(sx, sy, sw, sh);
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
