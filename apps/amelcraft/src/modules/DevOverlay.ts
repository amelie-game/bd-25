import Phaser from "phaser";
import { WorldManager } from "./WorldManager";

export class DevOverlay {
  private shell: Phaser.Scene;
  private wm: WorldManager;
  private text: Phaser.GameObjects.Text | null = null;
  private visible = false;
  private lastUpdate = 0;
  private intervalMs = 250; // refresh 4x per second

  constructor(shell: Phaser.Scene, wm: WorldManager) {
    this.shell = shell;
    this.wm = wm;
    this.text = this.shell.add
      .text(8, 8, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#00ff88",
        stroke: "#002200",
        strokeThickness: 2,
      })
      .setDepth(1000)
      // Scroll factor 1 => follows camera & respects zoom (instead of screen-space HUD)
      .setScrollFactor(1)
      .setVisible(this.visible);
    this.registerToggleKey();
  }

  private registerToggleKey() {
    const key = this.shell.input.keyboard?.addKey("F3");
    key?.on("down", () => {
      this.visible = !this.visible;
      this.text?.setVisible(this.visible);
      if (this.visible) this.forceUpdate();
    });
  }

  private forceUpdate() {
    const m = this.wm.getMetrics();
    const lines = [
      "=== Perf ===",
      `frame: ${m.frame}`,
      `chunks act/load/unload: ${m.activeChunks}/${m.chunksLoaded}/${m.chunksUnloaded}`,
      `gen ms: ${m.generationTimeMs.toFixed(2)}`,
      `dirty flushed: ${m.dirtyTilesFlushed}`,
      `flush ms: ${m.totalDirtyFlushTimeMs.toFixed(2)}`,
      `saves: ${m.savesPerformed}`,
      `budget: batch=${m.avgFlushBatchSize}`,
    ];
    this.text?.setText(lines.join("\n"));
  }

  update(time: number) {
    if (!this.visible) return;
    // Anchor to camera top-left each frame so it's always in view even with scrollFactor 1
    const cam = this.shell.cameras.main;
    if (this.text) {
      this.text.setPosition(
        cam.worldView.x + 8 / cam.zoom,
        cam.worldView.y + 8 / cam.zoom
      );
      // Scale with zoom so overlay "respects" zoom (grows/shrinks with world)
      this.text.setScale(1 / cam.zoom);
    }
    if (time - this.lastUpdate > this.intervalMs) {
      this.forceUpdate();
      this.lastUpdate = time;
    }
  }
}
