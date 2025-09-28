import Phaser from "phaser";
import { TILE_SIZE } from "../main";
import { GameScene } from "../scenes/GameScene";
import { assets } from "../assets";

type Direction = "right" | "left" | "up" | "down";
type Movement = "walk" | "idle";

type Shell = Pick<GameScene, "add" | "anims">;

type Params = {
  shell: Shell;
  start: [x: number, y: number];
};

export class Player {
  private shell: Shell;
  private sprite: Phaser.GameObjects.Sprite;
  private lastDirection: Direction = "down";

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

  moveTo(x: number, y: number) {
    /* TODO */
  }

  playAnim(type: Movement, dir: Direction) {
    /* TODO */
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
