import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { GameScene } from "../scenes/GameScene";
import { assets } from "../assets";
import { Direction, Movement, PlayerAnimation } from "../types";

type Shell = GameScene;

type Params = {
  shell: Shell;
  start: [x: number, y: number];
};

export class Player {
  private target: { x: number; y: number } | null = null;
  private static ANIMATIONS: Record<
    Movement,
    Record<Direction, PlayerAnimation>
  > = {
    walk: {
      right: assets.amelie.animations.AmelieWalkRight,
      left: assets.amelie.animations.AmelieWalkLeft,
      up: assets.amelie.animations.AmelieWalkUp,
      down: assets.amelie.animations.AmelieWalkDown,
    },
    idle: {
      right: assets.amelie.animations.AmelieIdleRight,
      left: assets.amelie.animations.AmelieIdleLeft,
      up: assets.amelie.animations.AmelieIdleUp,
      down: assets.amelie.animations.AmelieIdleDown,
    },
  };
  private static MOVE_SPEED = 248; // pixels per second (from PoC)

  private shell: Shell;
  private sprite: Phaser.GameObjects.Sprite & {
    setSmooth?: (smooth: boolean) => void;
  };
  private lastDirection: Direction = "down";
  private moveSpeed = Player.MOVE_SPEED; // pixels per second (from PoC)
  // Persistence ------------------------------------------------------------
  private storageKey: string | null = null;
  private dirty = false;
  private saveTimer: number | null = null;
  private saveDelayMs = 750;
  private autosaveEnabled = false;
  private static SERIALIZATION_VERSION = 1;

  // Footstep sound state ---------------------------------------------------
  private stepSounds: Phaser.Sound.BaseSound[] = [];
  private lastStepIndex: number = -1;
  private lastStepX: number = 0;
  private lastStepY: number = 0;
  private lastStepTime: number = 0;
  private stepDistancePx: number = 18; // computed stride length (px)
  private minStepIntervalMs: number = 90; // computed min interval (ms)
  private desiredStepsPerSecond: number = 4; // target cadence

  constructor({ shell, start }: Params) {
    this.shell = shell;

    const startX = start[0];
    const startY = start[1];

    this.sprite = this.shell.add.sprite(startX, startY, assets.amelie.key, 0);

    this.sprite.setOrigin(0.5, 0.75);
    this.sprite.setSmooth?.(false);
    this.sprite.setDepth(1);

    if (!this.shell.anims.exists("AmelieIdleDown")) {
      const idleDownFrames =
        assets.amelie.animations &&
        Array.isArray(assets.amelie.animations.AmelieIdleDown)
          ? assets.amelie.animations.AmelieIdleDown
          : [0];

      this.shell.anims.create({
        key: "AmelieIdleDown",
        frames: idleDownFrames.map((frame: number) => ({
          key: assets.amelie.key,
          frame,
        })),
        frameRate: 2,
        repeat: -1,
      });
    }
    this.playAnim("idle", "down", true);

    // Initialize step position baseline
    this.lastStepX = this.sprite.x;
    this.lastStepY = this.sprite.y;

    // Build step sound pool from generated asset group
    const grassGroupIds = assets.audio.groups.StepGrass;
    this.stepSounds = grassGroupIds.map((id) =>
      this.shell.sound.add(assets.audio[id], { volume: 0.6 })
    );

    // Compute initial cadence based on current moveSpeed
    this.recomputeFootstepCadence();
  }

  // =============================
  // Persistence API
  // =============================
  enablePersistence(seed: string | number, saveDelayMs: number = 750) {
    this.storageKey = `amelcraft:player:${seed}`;
    this.saveDelayMs = saveDelayMs;
    this.autosaveEnabled = true;
    // Attempt load and apply before first camera recenter
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (raw) {
        const data = JSON.parse(raw);
        this.applySerialized(data);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Player persistence load failed", e);
    }
    // Mark clean post-load
    this.dirty = false;
  }

  private serialize() {
    return {
      version: Player.SERIALIZATION_VERSION,
      x: this.sprite.x,
      y: this.sprite.y,
      ts: Date.now(),
    };
  }

  private applySerialized(data: any) {
    if (!data || typeof data !== "object") return;
    if (typeof data.version !== "number") return; // basic gate
    if (typeof data.x === "number" && typeof data.y === "number") {
      this.sprite.x = data.x;
      this.sprite.y = data.y;
      // ensure facing direction remains plausible; keep lastDirection
      this.playAnim("idle", this.lastDirection, true);
    }
  }

  private markDirty() {
    this.dirty = true;
    if (this.autosaveEnabled) this.scheduleSave();
  }

  private scheduleSave() {
    if (!this.storageKey) return;
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveNow(), this.saveDelayMs);
  }

  saveNow() {
    if (!this.storageKey) return;
    if (!this.dirty) return;
    try {
      window.localStorage.setItem(
        this.storageKey,
        JSON.stringify(this.serialize())
      );
      this.dirty = false;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("Player persistence save failed", e);
    }
  }

  destroy() {
    if (this.saveTimer) window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.saveNow(); // final flush
  }

  getPosition(): [x: number, y: number] {
    return [this.sprite.x, this.sprite.y];
  }

  // Owned movement target (pixel coordinates). Use setTarget to start/stop
  // shell-driven movement. Call update(time, delta) each frame to progress.
  setTarget(point: { x: number; y: number } | null) {
    this.target = point;
  }

  isMoving(): boolean {
    return this.target !== null;
  }

  // Called each frame by the shell. Drives moveTo when a target is present.
  update(_time: number, delta: number) {
    if (this.target) {
      if (!this.moveTo(this.target.x, this.target.y, delta)) {
        this.target = null;
      }
    }
    // Try playing a step sound if moving
    this.maybePlayFootstep(_time);
  }

  stop() {
    this.setTarget(null);
    this.playAnim("idle", this.lastDirection, true);
  }

  moveTo(x: number, y: number, timeSinceLastMove: number): boolean {
    const dx = x - this.sprite.x;
    const dy = y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      // Move towards target at moveSpeed (pixels/sec)
      const move = (this.moveSpeed * timeSinceLastMove) / 1000;
      const nx = this.sprite.x + (dx / dist) * Math.min(move, dist);
      const ny = this.sprite.y + (dy / dist) * Math.min(move, dist);

      // Only move if the next position is walkable
      if (this.shell.getWorldManager().isWalkable(nx, ny)) {
        // Determine direction for animation
        let dir: Direction = this.lastDirection;
        if (Math.abs(dx) > Math.abs(dy)) {
          dir = dx > 0 ? "right" : "left";
        } else if (Math.abs(dy) > 0) {
          dir = dy > 0 ? "down" : "up";
        }
        this.lastDirection = dir;
        // Play walk animation
        this.playAnim("walk", dir, true);
        this.sprite.x = nx;
        this.sprite.y = ny;
        // We'll trigger footstep outside here via maybePlayFootstep
      } else {
        // If not walkable, stop movement and play idle
        this.playAnim("idle", this.lastDirection, true);
        this.markDirty();

        return false;
      }
    } else {
      // Arrived at target
      this.sprite.x = x;
      this.sprite.y = y;
      // Play idle animation facing last direction
      this.playAnim("idle", this.lastDirection, true);
      this.markDirty();

      return false;
    }

    return true;
  }

  /** Direct position setter (used by tests & potential teleport). */
  setPosition(x: number, y: number) {
    this.sprite.x = x;
    this.sprite.y = y;
    this.markDirty();
  }

  // Move the player to a neighbouring tile adjacent to (tx,ty) and call onArrive when reached.
  // Returns true if movement was initiated (or the player is already moving towards a chosen neighbor),
  // false if no suitable neighbor was found.
  movePlayerAdjacentTo(tx: number, ty: number, onArrive: () => void): boolean {
    const manager = this.shell.getWorldManager();
    const player = this;
    const pTile = player.getTile();

    // If player stands on the same tile, prefer cardinal candidates based on pixel offset
    let cardinalCandidates: { x: number; y: number }[] = [];
    if (pTile.x === tx && pTile.y === ty) {
      const [playerX, playerY] = player.getPosition();
      const centerX = (tx + 0.5) * TILE_SIZE;
      const centerY = (ty + 0.5) * TILE_SIZE;
      const offX = playerX - centerX;
      const offY = playerY - centerY;
      cardinalCandidates =
        Math.abs(offX) > Math.abs(offY)
          ? offX > 0
            ? [
                { x: tx + 1, y: ty },
                { x: tx - 1, y: ty },
                { x: tx, y: ty + 1 },
                { x: tx, y: ty - 1 },
              ]
            : [
                { x: tx - 1, y: ty },
                { x: tx + 1, y: ty },
                { x: tx, y: ty + 1 },
                { x: tx, y: ty - 1 },
              ]
          : offY > 0
          ? [
              { x: tx, y: ty + 1 },
              { x: tx, y: ty - 1 },
              { x: tx + 1, y: ty },
              { x: tx - 1, y: ty },
            ]
          : [
              { x: tx, y: ty - 1 },
              { x: tx, y: ty + 1 },
              { x: tx + 1, y: ty },
              { x: tx - 1, y: ty },
            ];
    } else {
      // Not standing on the target: pick cardinal neighbors sorted by distance to player
      cardinalCandidates = [
        { x: tx - 1, y: ty },
        { x: tx + 1, y: ty },
        { x: tx, y: ty - 1 },
        { x: tx, y: ty + 1 },
      ];
      const playerPos = player.getPosition();
      const center = (n: { x: number; y: number }) => ({
        x: (n.x + 0.5) * TILE_SIZE,
        y: (n.y + 0.5) * TILE_SIZE,
      });
      cardinalCandidates.sort((a, b) => {
        const ac = center(a);
        const bc = center(b);
        const da = (ac.x - playerPos[0]) ** 2 + (ac.y - playerPos[1]) ** 2;
        const db = (bc.x - playerPos[0]) ** 2 + (bc.y - playerPos[1]) ** 2;
        return da - db;
      });
    }

    // Prefer walkable center candidates first
    let chosen = cardinalCandidates.find((n) => {
      const nt = manager.getTileAtGlobal(n.x, n.y);
      if (!nt) return false;
      return manager.isWalkable(
        (n.x + 0.5) * TILE_SIZE,
        (n.y + 0.5) * TILE_SIZE
      );
    });
    // fallback to any cardinal tile (even if not walkable center)
    if (!chosen)
      chosen = cardinalCandidates.find((n) =>
        manager.getTileAtGlobal(n.x, n.y)
      );
    // fallback to diagonals
    if (!chosen) {
      const diagonals = [
        { x: tx - 1, y: ty - 1 },
        { x: tx + 1, y: ty - 1 },
        { x: tx - 1, y: ty + 1 },
        { x: tx + 1, y: ty + 1 },
      ];
      chosen = diagonals.find((n) => {
        const nt = manager.getTileAtGlobal(n.x, n.y);
        if (!nt) return false;
        return manager.isWalkable(
          (n.x + 0.5) * TILE_SIZE,
          (n.y + 0.5) * TILE_SIZE
        );
      });
      if (!chosen)
        chosen = diagonals.find((n) => manager.getTileAtGlobal(n.x, n.y));
    }

    if (!chosen) return false;

    this.setTarget({
      x: (chosen.x + 0.5) * TILE_SIZE,
      y: (chosen.y + 0.5) * TILE_SIZE,
    });
    const checkArrival = this.shell.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        const pTile = player.getTile();
        if (pTile.x === chosen!.x && pTile.y === chosen!.y) {
          checkArrival.remove(false);
          onArrive();
        }
      },
    });

    return true;
  }

  // 8-connected adjacency used by place/collect: Chebyshev distance <= 1.
  // Excludes the tile the player is standing on (you must step off first).
  isTileInteractable(tx: number, ty: number): boolean {
    const { x: px, y: py } = this.getTile();
    const dx = Math.abs(tx - px);
    const dy = Math.abs(ty - py);
    let inRange = Math.max(dx, dy) <= 1;
    if (px === tx && py === ty) inRange = false;
    return inRange;
  }

  playAnim(type: Movement, dir: Direction, ignoreIfPlaying?: boolean) {
    this.sprite.play(Player.ANIMATIONS[type][dir], ignoreIfPlaying);
  }

  setDirection(dir: Direction) {
    this.lastDirection = dir;
    this.playAnim("idle", dir, true);
  }

  getTile(): { x: number; y: number } {
    return {
      x: Math.floor(this.sprite.x / TILE_SIZE),
      y: Math.floor(this.sprite.y / TILE_SIZE),
    };
  }

  getSprite() {
    return this.sprite;
  }

  /** Override player speed and recompute footstep cadence (e.g. sprint). */
  setMoveSpeed(pixelsPerSecond: number) {
    this.moveSpeed = pixelsPerSecond;
    this.recomputeFootstepCadence();
  }

  // ===================
  // === FOOTSTEPS    ===
  // ===================
  private maybePlayFootstep(now: number) {
    if (!this.isMoving()) return;
    if (!this.stepSounds.length) return;

    const dx = this.sprite.x - this.lastStepX;
    const dy = this.sprite.y - this.lastStepY;
    const dist = Math.hypot(dx, dy);
    if (dist < this.stepDistancePx) return;
    if (now - this.lastStepTime < this.minStepIntervalMs) return;

    this.playRandomFootstep();
    this.lastStepX = this.sprite.x;
    this.lastStepY = this.sprite.y;
    this.lastStepTime = now;
  }

  private playRandomFootstep() {
    let idx: number;
    do {
      idx = Phaser.Math.Between(0, this.stepSounds.length - 1);
    } while (this.stepSounds.length > 1 && idx === this.lastStepIndex);
    const snd = this.stepSounds[idx];
    (snd as any).setDetune?.(Phaser.Math.Between(-40, 40));
    (snd as any).setRate?.(Phaser.Math.FloatBetween(0.95, 1.05));
    snd.play();
    this.lastStepIndex = idx;
  }

  // ===================
  // === CADENCE CALC ===
  // ===================
  private recomputeFootstepCadence() {
    // Derive stride length so that: steps/sec ~= desiredStepsPerSecond at current speed.
    // stride = moveSpeed / desiredStepsPerSecond
    this.stepDistancePx = this.moveSpeed / this.desiredStepsPerSecond;
    // Minimum interval: fraction of ideal period (period = 1000 / stepsPerSecond).
    // Using 0.65 to allow distance gate to dominate while preventing burst artifacts.
    const periodMs = 1000 / this.desiredStepsPerSecond;
    this.minStepIntervalMs = periodMs * 0.65;
  }
}
