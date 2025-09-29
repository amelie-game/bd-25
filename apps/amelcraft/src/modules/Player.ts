import Phaser from "phaser";
import { TILE_SIZE } from "../main";
import { GameScene } from "../scenes/GameScene";
import { assets } from "../assets";
import { PlayerAnimation } from "../types";

type Direction = "right" | "left" | "up" | "down";
type Movement = "walk" | "idle";

type Shell = Pick<GameScene, "add" | "anims" | "isWalkable">;

type Params = {
  shell: Shell;
  start: [x: number, y: number];
};

export class Player {
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
  private sprite: Phaser.GameObjects.Sprite;
  private lastDirection: Direction = "down";
  private moveSpeed = Player.MOVE_SPEED; // pixels per second (from PoC)

  constructor({ shell, start }: Params) {
    this.shell = shell;

    const startX = start[0];
    const startY = start[1];

    this.sprite = this.shell.add.sprite(startX, startY, assets.amelie.key, 0);

    this.sprite.setOrigin(0.5, 0.75);
    (this.sprite as any).setSmooth && (this.sprite as any).setSmooth(false);
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
    this.sprite.play("AmelieIdleDown", false);
  }

  getPosition(): [x: number, y: number] {
    return [this.sprite.x, this.sprite.y];
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
      if (this.shell.isWalkable(nx, ny)) {
        // Determine direction for animation
        let dir: Direction = this.lastDirection;
        if (Math.abs(dx) > Math.abs(dy)) {
          dir = dx > 0 ? "right" : "left";
        } else if (Math.abs(dy) > 0) {
          dir = dy > 0 ? "down" : "up";
        }
        this.lastDirection = dir;
        // Play walk animation
        this.sprite.play(Player.ANIMATIONS.walk[dir], true);
        this.sprite.x = nx;
        this.sprite.y = ny;
      } else {
        // If not walkable, stop movement and play idle
        this.sprite.play(Player.ANIMATIONS.idle[this.lastDirection], true);

        return false;
      }
    } else {
      // Arrived at target
      this.sprite.x = x;
      this.sprite.y = y;
      // Play idle animation facing last direction
      this.sprite.play(Player.ANIMATIONS.idle[this.lastDirection], true);

      return false;
    }

    return true;
  }

  playAnim(type: Movement, dir: Direction, ignoreIfPlaying?: boolean) {
    this.sprite.play(Player.ANIMATIONS[type][dir], ignoreIfPlaying);
  }

  setDirection(dir: Direction) {
    /* TODO */
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
