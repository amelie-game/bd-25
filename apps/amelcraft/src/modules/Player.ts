import Phaser from "phaser";
import { TILE_SIZE } from "../main";
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
      if (this.shell.getWorld().isWalkable(nx, ny)) {
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
      } else {
        // If not walkable, stop movement and play idle
        this.playAnim("idle", this.lastDirection, true);

        return false;
      }
    } else {
      // Arrived at target
      this.sprite.x = x;
      this.sprite.y = y;
      // Play idle animation facing last direction
      this.playAnim("idle", this.lastDirection, true);

      return false;
    }

    return true;
  }

  // Move the player to a neighbouring tile adjacent to (tx,ty) and call onArrive when reached.
  // Returns true if movement was initiated (or the player is already moving towards a chosen neighbor),
  // false if no suitable neighbor was found.
  movePlayerAdjacentTo(tx: number, ty: number, onArrive: () => void): boolean {
    const world = this.shell.getWorld();
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
      const nt = world.getTileAt(n.x, n.y);
      if (!nt) return false;
      return world.isWalkable((n.x + 0.5) * TILE_SIZE, (n.y + 0.5) * TILE_SIZE);
    });
    // fallback to any cardinal tile (even if not walkable center)
    if (!chosen)
      chosen = cardinalCandidates.find((n) => world.getTileAt(n.x, n.y));
    // fallback to diagonals
    if (!chosen) {
      const diagonals = [
        { x: tx - 1, y: ty - 1 },
        { x: tx + 1, y: ty - 1 },
        { x: tx - 1, y: ty + 1 },
        { x: tx + 1, y: ty + 1 },
      ];
      chosen = diagonals.find((n) => {
        const nt = world.getTileAt(n.x, n.y);
        if (!nt) return false;
        return world.isWalkable(
          (n.x + 0.5) * TILE_SIZE,
          (n.y + 0.5) * TILE_SIZE
        );
      });
      if (!chosen) chosen = diagonals.find((n) => world.getTileAt(n.x, n.y));
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
}
