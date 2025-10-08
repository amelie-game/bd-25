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
  static DEFAULT_MARGIN_TILES = 2;

  private minZoom = Camera.DEFAULT_MIN_ZOOM;
  private maxZoom = Camera.DEFAULT_MAX_ZOOM;
  private lastPinchDist: number | null = null;
  private marginTiles: number;
  private shell: Shell;
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor({ shell, marginTiles }: Params) {
    this.shell = shell;
    this.camera = this.shell.cameras.main;
    this.marginTiles = typeof marginTiles === "number" ? marginTiles : Camera.DEFAULT_MARGIN_TILES;

    // Wheel Zoom
    this.shell.input.on("wheel", (pointer: Phaser.Input.Pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      const zoomChange = deltaY > 0 ? -0.1 : 0.1;
      this.setZoom(this.camera.zoom + zoomChange);
    });

    // Pinch zoom for touch devices
    this.shell.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const event = pointer.event as TouchEvent | PointerEvent | undefined;
      if (event && "touches" in event && event.touches.length === 2) {
        const [p1, p2] = event.touches;
        const dist = Phaser.Math.Distance.Between(p1.clientX, p1.clientY, p2.clientX, p2.clientY);
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
    // Keep same initial viewport: bounds based on world dimensions
    this.camera.setBounds(0, 0, ...this.shell.getWorld().getDimensions());
    this.computeZoomBounds();
    // default zoom to 1 (clamped)
    this.setZoom(Phaser.Math.Clamp(1, this.minZoom, this.maxZoom));
  }

  setZoom(z: number) {
    const clamped = Phaser.Math.Clamp(z, this.minZoom, this.maxZoom);
    this.camera.setZoom(clamped);
    // center on player when zooming
    this.recenter();
  }

  recenter() {
    const [playerX, playerY] = this.shell.getPlayer().getPosition();
    this.centerOn(playerX, playerY);
    this.clamp();
  }

  // No auto-pan for now; stub exists to preserve public API
  update(timeMs: number, delta: number) {
    // intentionally empty
  }

  private centerOn(x: number, y: number) {
    this.camera.centerOn(x, y);
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
    const cam = this.camera;
    const fitWorldWidthZoom = cam.width / this.shell.getWorld().getDimensions()[0];
    this.minZoom = fitWorldWidthZoom;
    const eightTilesZoom = cam.width / (8 * TILE_SIZE);
    this.maxZoom = Math.max(1, eightTilesZoom);
    if (this.maxZoom < this.minZoom) this.maxZoom = this.minZoom + 0.0001;
  }
}
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
  static DEFAULT_MARGIN_TILES = 2;

  private minZoom = Camera.DEFAULT_MIN_ZOOM;
  private maxZoom = Camera.DEFAULT_MAX_ZOOM;
  private lastPinchDist: number | null = null;
  // auto-pan configuration
  private marginTiles: number;
  private lastUserInteraction = 0; // ms
  private userInteractionCooldown = 300; // ms
  private minPanDistance = 2; // px
  private panDuration = 80; // ms
  private desiredScrollX: number | null = null;
  private desiredScrollY: number | null = null;
  private desiredCenterX: number | null = null;
  private desiredCenterY: number | null = null;
  private shell: Shell;
  private camera: Phaser.Cameras.Scene2D.Camera;

  constructor({ shell, marginTiles }: Params) {
    this.shell = shell;
    this.camera = this.shell.cameras.main;
    this.marginTiles =
      typeof marginTiles === "number"
        ? marginTiles
        : Camera.DEFAULT_MARGIN_TILES;

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
        // user is interacting with camera via wheel -> note interaction so auto-pan is suspended briefly
        this.noteUserInteraction(this.shell.time.now);
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
            // note user interaction (pinch)
            this.noteUserInteraction(this.shell.time.now);
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
    // Keep the player centered when zooming — users expect zoom to focus on the player.
    this.recenter();
  }

  recenter() {
    const [playerX, playerY] = this.shell.getPlayer().getPosition();
    this.centerOn(playerX, playerY);
    this.clamp();
  }

  private noteUserInteraction(now: number) {
    this.lastUserInteraction = now;
  }

  private autoPanAllowed(now: number) {
    return now - this.lastUserInteraction > this.userInteractionCooldown;
  }

  // Called from GameScene.update(time, delta) to perform edge-margin auto-panning
  update(timeMs: number, delta: number) {
    if (!this.autoPanAllowed(timeMs)) return;

    const cam = this.camera;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const left = cam.scrollX;
    const top = cam.scrollY;
    const right = left + viewW;
    const bottom = top + viewH;

    const [playerX, playerY] = this.shell.getPlayer().getPosition();

    const marginPixels = this.marginTiles * TILE_SIZE;

    let targetScrollX = left;
    let targetScrollY = top;
    let needPan = false;

    const worldW = this.shell.getWorld().getDimensions()[0];
    const worldH = this.shell.getWorld().getDimensions()[1];

    if (playerX < left + marginPixels) {
      targetScrollX = Phaser.Math.Clamp(
        playerX - marginPixels,
        0,
        Math.max(0, worldW - viewW)
      );
      needPan = true;
    } else if (playerX > right - marginPixels) {
      targetScrollX = Phaser.Math.Clamp(
        playerX + marginPixels - viewW,
        0,
        Math.max(0, worldW - viewW)
      );
      needPan = true;
    }

    if (playerY < top + marginPixels) {
      targetScrollY = Phaser.Math.Clamp(
        playerY - marginPixels,
        0,
        Math.max(0, worldH - viewH)
      );
      needPan = true;
    } else if (playerY > bottom - marginPixels) {
      targetScrollY = Phaser.Math.Clamp(
        playerY + marginPixels - viewH,
        0,
        Math.max(0, worldH - viewH)
      );
      needPan = true;
    }

    if (needPan) {
      // compute target center from target scroll + half view
      const targetCenterX = targetScrollX + viewW / 2;
      const targetCenterY = targetScrollY + viewH / 2;
      const currentCenterX = cam.scrollX + viewW / 2;
      const currentCenterY = cam.scrollY + viewH / 2;
      const dx = Math.abs(targetCenterX - currentCenterX);
      const dy = Math.abs(targetCenterY - currentCenterY);
      if (dx > this.minPanDistance || dy > this.minPanDistance) {
        this.desiredCenterX = targetCenterX;
        this.desiredCenterY = targetCenterY;
      }
    } else {
      this.desiredCenterX = null;
      this.desiredCenterY = null;
    }

    // Smoothly interpolate camera center toward desired center if set
    if (this.desiredCenterX !== null || this.desiredCenterY !== null) {
      const currentCenterX = cam.scrollX + viewW / 2;
      const currentCenterY = cam.scrollY + viewH / 2;
      const factor = Math.min(1, delta / Math.max(16, this.panDuration));
      const newCenterX =
        this.desiredCenterX !== null
          ? Phaser.Math.Linear(currentCenterX, this.desiredCenterX, factor)
          : currentCenterX;
      const newCenterY =
        this.desiredCenterY !== null
          ? Phaser.Math.Linear(currentCenterY, this.desiredCenterY, factor)
          : currentCenterY;
      this.centerOn(newCenterX, newCenterY);
      this.clamp();
    }
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
