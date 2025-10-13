import { assets } from "../assets";
import type { Option } from "../types";
import { InventorySlot } from "./Inventory";
import { HudRoot } from "../hud/HUD.js";
import { GameScene } from "../scenes/GameScene";

import "../hud/HUD.js";

type Shell = GameScene;

type Params = {
  shell: Shell;
  inventory: InventorySlot[];
  selectedMode: Option;
  onSelect: (val: Option) => void;
};

export class HUDManager {
  private shell: Shell;
  private onSelect: (val: Option) => void;
  private hudEl: HudRoot;

  constructor({ inventory, selectedMode, shell, onSelect }: Params) {
    this.shell = shell;
    this.onSelect = onSelect;
    this.hudEl = document.createElement("amelcraft-hud") as HudRoot;

    this.shell.events.on("shutdown", this.destroy.bind(this));
    this.shell.events.on("destroy", this.destroy.bind(this));

    document.body.appendChild(this.hudEl);

    this.update(inventory, selectedMode);
  }

  update(inventory: InventorySlot[], selectedMode: Option) {
    const blockKeys = inventory.map((slot) => {
      // Try to find the sprite name for this block index
      const spriteName = Object.keys(assets.blocks.sprites).find(
        (k) =>
          assets.blocks.sprites[k as keyof typeof assets.blocks.sprites] ===
          slot.block
      );

      return {
        key: slot.block,
        value: slot.block,
        count: slot.count,
        sprite: spriteName ? spriteName : undefined,
      };
    });

    this.hudEl.data = {
      blockKeys,
      selected: selectedMode,
      onSelect: this.onSelect,
    };
  }

  destroy() {
    this.hudEl.remove();
  }
}
