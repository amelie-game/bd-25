import Phaser from "phaser";

export class WorldMap {
  private groundLayer: Phaser.Tilemaps.TilemapLayer;
  constructor(groundLayer: Phaser.Tilemaps.TilemapLayer) {
    this.groundLayer = groundLayer;
  }
  isWalkable(x: number, y: number): boolean {
    /* TODO */ return true;
  }
  getTileAt(tx: number, ty: number) {
    return this.groundLayer.getTileAt(tx, ty);
  }
  putTileAt(tile: number, tx: number, ty: number) {
    this.groundLayer.putTileAt(tile, tx, ty);
  }
  generateIsland() {
    /* TODO */
  }
  getLayer() {
    return this.groundLayer;
  }
}
