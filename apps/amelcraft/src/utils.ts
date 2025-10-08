import { Direction } from "./types";

export function getDirection(dx: number, dy: number): Direction {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  } else if (Math.abs(dy) > 0) {
    return dy > 0 ? "down" : "up";
  }
  return "down";
}
