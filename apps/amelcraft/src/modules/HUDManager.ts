import { assets } from "../assets";
import type { Option } from "../types";
import { InventoryBlockSlot, InventoryObjectSlot } from "./Inventory";
import { HudRoot } from "../hud/HUD.js";
import "../hud/CraftModal";
import { GameScene } from "../scenes/GameScene";

import "../hud/HUD.js";

type Shell = GameScene;

type Params = {
  shell: Shell;
  inventory: InventoryBlockSlot[];
  objects?: InventoryObjectSlot[]; // optional hidden resources
  selectedMode: Option;
  onSelect: (val: Option) => void;
};

export class HUDManager {
  private shell: Shell;
  private onSelect: (val: Option) => void;
  private hudEl: HudRoot;
  private craftModal: HTMLElement | null = null;
  private lastObjects: InventoryObjectSlot[] = [];

  constructor({
    inventory,
    objects = [],
    selectedMode,
    shell,
    onSelect,
  }: Params) {
    this.shell = shell;
    this.onSelect = onSelect;
    this.hudEl = document.createElement("amelcraft-hud") as HudRoot;

    this.shell.events.on("shutdown", this.destroy.bind(this));
    this.shell.events.on("destroy", this.destroy.bind(this));

    document.body.appendChild(this.hudEl);

    this.update(inventory, selectedMode, objects);
  }

  update(
    inventory: InventoryBlockSlot[],
    selectedMode: Option,
    objects: InventoryObjectSlot[] = []
  ) {
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

    this.lastObjects = objects;
    // Only count actual flowers (prefix 'flower_') for badge purposes
    const flowersCount = objects.reduce(
      (sum, o) => (o.object.startsWith("flower_") ? sum + o.count : sum),
      0
    );
    this.hudEl.data = {
      blockKeys,
      selected: selectedMode,
      onSelect: this.onSelect,
      flowersCount,
    } as any;

    // Handle craft modal visibility based on selected mode
    if (selectedMode === "craft") {
      this.ensureCraftModal();
      this.openCraftModal();
    } else {
      this.closeCraftModal();
    }
  }

  destroy() {
    this.hudEl.remove();
    this.craftModal?.remove();
  }

  private ensureCraftModal() {
    if (this.craftModal) return;
    const el = document.createElement("craft-modal");
    el.addEventListener("craft:close", () => {
      // When modal closes, revert to previous mode (collect) for convenience
      if (this.shell.getMode() === "craft") {
        this.onSelect("collect");
      }
    });
    el.addEventListener("craft:result", (e: any) => {
      // Refresh HUD after a successful craft
      const detail = e.detail;
      if (detail?.ok) {
        this.update(
          this.shell.getInventory().getBlocks(),
          this.shell.getMode(),
          this.shell.getInventory().getObjects()
        );
      }
    });
    document.body.appendChild(el);
    this.craftModal = el;
  }

  private openCraftModal() {
    if (!this.craftModal) return;
    const inv = this.shell.getInventory();
    // Filter flower object slots (prefix flower_)
    const flowers = this.lastObjects.filter((o) =>
      o.object.startsWith("flower_")
    );
    (this.craftModal as any).modalData = {
      flowers,
      inventory: inv,
    };
    this.craftModal.setAttribute("open", "");
  }

  private closeCraftModal() {
    if (this.craftModal) this.craftModal.removeAttribute("open");
  }
}
