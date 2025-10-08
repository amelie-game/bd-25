import Phaser from "phaser";
import { assets } from "../assets";
import { TILE_SIZE } from "../main";

export class World {
  static COLUMNS = 100;
  static ROWS = 100;

  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private dimensions: [width: number, height: number] = [
    World.COLUMNS * TILE_SIZE,
    World.ROWS * TILE_SIZE,
  ];
  private highlightTile: { x: number; y: number } | null = null;

  constructor(scene: Phaser.Scene) {
    // --- Tilemap and Tileset ---
    const map = scene.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: World.COLUMNS,
      height: World.ROWS,
    });
    if (!map) {
      console.warn("Tilemap creation failed");
      return;
    }
    const tileset = map.addTilesetImage(assets.blocks.key);
    if (!tileset) {
      console.warn("Tileset creation failed for key:", assets.blocks.key);
      return;
    }
    const layer = map.createBlankLayer("ground", tileset);
    if (!layer) {
      console.warn("Tilemap layer creation failed");
      return;
    }
    this.groundLayer = layer as Phaser.Tilemaps.TilemapLayer;
    // Generate island terrain (grass & water)
    this.groundLayer.fill(
      assets.blocks.sprites.Water,
      0,
      0,
      World.COLUMNS,
      World.ROWS
    ); // start as water
    this.generateIsland();
    this.groundLayer.setDepth(0);
  }

  getHighlightTile() {
    return this.highlightTile;
  }

  setHighlightTile(tile: { x: number; y: number } | null) {
    this.highlightTile = tile;
  }

  isWalkable(x: number, y: number): boolean {
    if (!this.groundLayer) return false;

    const tile = this.groundLayer.getTileAtWorldXY(x, y, true);
    if (!tile) return false;

    switch (tile.index) {
      case assets.blocks.sprites.Water:
        return false;
      default:
        return true;
    }
  }

  getTileAt(tx: number, ty: number) {
    return this.groundLayer.getTileAt(tx, ty);
  }
  putTileAt(tile: number, tx: number, ty: number) {
    this.groundLayer.putTileAt(tile, tx, ty);
  }
  generateIsland() {
    {
      const GRASS = assets.blocks.sprites.Grass; // tileset index for grass
      const WATER = assets.blocks.sprites.Water; // tileset index for water
      const width = World.COLUMNS;
      const height = World.ROWS;
      const total = width * height;
      // Target grass ratio between 0.60 and 0.80
      const targetRatio = Phaser.Math.FloatBetween(0.63, 0.77);
      const cx = width / 2;
      const cy = height / 2;
      // Random elliptical radii (gives large-scale variety)
      const baseArea = targetRatio * total;
      const baseRadius = Math.sqrt(baseArea / Math.PI);
      const radX = baseRadius * Phaser.Math.FloatBetween(0.9, 1.35);
      const radY = baseRadius * Phaser.Math.FloatBetween(0.85, 1.25);

      // Layered value noise parameters
      const off1x = Math.random() * 1000;
      const off1y = Math.random() * 1000;
      const off2x = Math.random() * 2000;
      const off2y = Math.random() * 2000;
      const off3x = Math.random() * 3000;
      const off3y = Math.random() * 3000;
      const s1 = Phaser.Math.FloatBetween(0.025, 0.045); // large features
      const s2 = s1 * 2.3; // medium
      const s3 = s1 * 5.1; // small
      const noiseScale = Phaser.Math.FloatBetween(0.32, 0.4); // influence of noise on shoreline

      // Prepare mask
      const mask: boolean[][] = Array.from({ length: width }, () =>
        Array<boolean>(height).fill(false)
      );
      let grassCount = 0;

      const valueNoise = (x: number, y: number): number => {
        // 2D value noise with bilinear interpolation & smoothstep
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const xf = x - xi;
        const yf = y - yi;
        const smooth = (t: number) => t * t * (3 - 2 * t);
        const rnd = (ix: number, iy: number) => {
          let n = ix * 374761393 + iy * 668265263;
          n = (n ^ (n >> 13)) * 1274126177;
          n = n ^ (n >> 16);
          return (n & 0xffffffff) / 0xffffffff; // 0..1
        };
        const v00 = rnd(xi, yi);
        const v10 = rnd(xi + 1, yi);
        const v01 = rnd(xi, yi + 1);
        const v11 = rnd(xi + 1, yi + 1);
        const sx = smooth(xf);
        const sy = smooth(yf);
        const ix0 = Phaser.Math.Linear(v00, v10, sx);
        const ix1 = Phaser.Math.Linear(v01, v11, sx);
        const v = Phaser.Math.Linear(ix0, ix1, sy);
        return v * 2 - 1; // -1..1
      };

      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          const dx = x - cx + 0.5;
          const dy = y - cy + 0.5;
          const distNorm = Math.sqrt(
            (dx * dx) / (radX * radX) + (dy * dy) / (radY * radY)
          );
          // Layered coherent noise (multi-octave)
          const n1 = valueNoise(x * s1 + off1x, y * s1 + off1y);
          const n2 = valueNoise(x * s2 + off2x, y * s2 + off2y);
          const n3 = valueNoise(x * s3 + off3x, y * s3 + off3y);
          const layered = 0.55 * n1 + 0.3 * n2 + 0.15 * n3; // already in -1..1 range weighting
          // Adjust shoreline: subtract noise so negative noise pushes outward (larger island in some lobes)
          const shape = distNorm - layered * noiseScale;
          const inside = shape < 1;
          if (inside) {
            mask[x][y] = true;
            grassCount++;
          }
        }
      }

      // Edge smoothing (same approach as before)
      const dirs8 = [
        [-1, -1],
        [0, -1],
        [1, -1],
        [-1, 0],
        /*self*/ [1, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
      ];
      const smoothPass = () => {
        const copy = mask.map((c) => c.slice());
        for (let x = 1; x < width - 1; x++) {
          for (let y = 1; y < height - 1; y++) {
            let count = 0;
            for (const [dx, dy] of dirs8) if (copy[x + dx][y + dy]) count++;
            if (count >= 5) mask[x][y] = true;
            else if (count <= 2) mask[x][y] = false;
          }
        }
      };
      smoothPass();

      // Recount after smoothing
      grassCount = 0;
      for (let x = 0; x < width; x++)
        for (let y = 0; y < height; y++) if (mask[x][y]) grassCount++;
      let ratio = grassCount / total;

      // Ratio adjustment to stay within [0.6,0.8]
      if (ratio < 0.6 || ratio > 0.8) {
        const edgeGrass: Array<[number, number]> = [];
        const edgeWater: Array<[number, number]> = [];
        const dirs4 = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (let x = 1; x < width - 1; x++) {
          for (let y = 1; y < height - 1; y++) {
            const isGrass = mask[x][y];
            let boundary = false;
            for (const [dx, dy] of dirs4) {
              const nx = x + dx,
                ny = y + dy;
              if (mask[nx][ny] !== isGrass) {
                boundary = true;
                break;
              }
            }
            if (boundary) (isGrass ? edgeGrass : edgeWater).push([x, y]);
          }
        }
        if (ratio < 0.6) {
          Phaser.Utils.Array.Shuffle(edgeWater);
          for (const [x, y] of edgeWater) {
            if (ratio >= 0.6) break;
            if (!mask[x][y]) {
              mask[x][y] = true;
              grassCount++;
              ratio = grassCount / total;
            }
          }
        } else {
          Phaser.Utils.Array.Shuffle(edgeGrass);
          for (const [x, y] of edgeGrass) {
            if (ratio <= 0.8) break;
            if (mask[x][y]) {
              mask[x][y] = false;
              grassCount--;
              ratio = grassCount / total;
            }
          }
        }
      }

      // Apply tiles
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          this.putTileAt(mask[x][y] ? GRASS : WATER, x, y);
        }
      }
    }
  }

  getDimensions(): [width: number, height: number] {
    return this.dimensions;
  }
}
