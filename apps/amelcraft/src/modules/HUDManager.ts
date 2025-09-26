import type { Option } from "../types";
import { InventorySlot } from "./Inventory";

export class HUDManager {
  private hudEl: HTMLElement | null = null;
  constructor() {}
  createHUD() {
    /* TODO */
  }
  update(inventory: InventorySlot[], selectedTool: Option) {
    /* TODO */
  }
  onSelect(cb: (val: Option) => void) {
    /* TODO */
  }
  destroy() {
    /* TODO */
  }
  getElement() {
    return this.hudEl;
  }
}
