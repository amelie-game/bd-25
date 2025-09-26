import Phaser from "phaser";
import { TILE_SIZE } from "../main";
type Direction = "right" | "left" | "up" | "down";
type Movement = "walk" | "idle";

export class PlayerController {
  private sprite: Phaser.GameObjects.Sprite;
  private lastDirection: Direction = "down";
  constructor(sprite: Phaser.GameObjects.Sprite) {
    this.sprite = sprite;
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
