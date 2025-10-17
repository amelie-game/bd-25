import {
  FlowerId,
  simulateCraft,
  validateCraft,
  executeCraft,
} from "../modules/Crafting";
import { InventoryObjectSlot, Inventory } from "../modules/Inventory";
import { assets } from "../assets";

// <craft-modal> custom element
// Responsibilities:
//  - display flower selection (radio buttons)
//  - sand amount selector (1..10 capped by inventory Yellow count)
//  - live preview of output distribution
//  - craft button emits 'craft:result' event with outcome

interface CraftModalData {
  flowers: InventoryObjectSlot[]; // object slots with flower_* ids
  inventory: Inventory; // reference for validation
}

export class CraftModal extends HTMLElement {
  private data: CraftModalData | null = null;
  private selectedFlower: FlowerId | null = null;
  private sandCount: number = 1;
  private maxSand: number = 10;

  static get observedAttributes() {
    return ["open"];
  }

  set modalData(d: CraftModalData) {
    this.data = d;
    // derive max sand from inventory yellow amount
    const yellow = assets.blocks.sprites.Yellow;
    this.maxSand = Math.min(10, d.inventory.countBlock(yellow));
    if (this.sandCount > this.maxSand) this.sandCount = this.maxSand || 1;
    this.render();
  }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.render();
    document.addEventListener("keydown", this.handleKey);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.handleKey);
  }

  attributeChangedCallback() {
    this.render();
  }

  private handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.close();
  };

  private close() {
    this.removeAttribute("open");
    this.dispatchEvent(new CustomEvent("craft:close"));
  }

  private selectFlower(id: FlowerId) {
    this.selectedFlower = id;
    this.render();
  }

  private setSand(n: number) {
    this.sandCount = Math.max(1, Math.min(this.maxSand, n));
    this.render();
  }

  private performCraft() {
    if (!this.data || !this.selectedFlower) return;
    const { inventory } = this.data;
    const validation = validateCraft(
      this.selectedFlower,
      this.sandCount,
      inventory as any
    );
    if (!validation.ok) {
      this.render();
      return;
    }
    const result = executeCraft(
      this.selectedFlower,
      this.sandCount,
      inventory as any
    );
    this.dispatchEvent(new CustomEvent("craft:result", { detail: result }));
    if (result.ok) {
      // auto close on success
      this.close();
    } else {
      this.render(); // re-render to show potential error
    }
  }

  private buildStyles() {
    return `
      :host { position: fixed; inset: 0; display: none; }
      :host([open]) { display: block; }
      .backdrop { position: absolute; inset:0; background:#0008; backdrop-filter: blur(2px); }
      .panel { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width: min(480px, 90vw); background:#1e1f24; color:#fff; padding:1em 1.25em; border-radius:0.9em; box-shadow:0 4px 28px #000a; display:flex; flex-direction:column; gap:1em; font-family: system-ui, sans-serif; }
      h2 { margin:0; font-size:1.2em; }
      .flowers { display:flex; flex-wrap:wrap; gap:0.5em; }
      .flower { background:transparent; padding:0.25em 0.4em; border-radius:0.6em; cursor:pointer; display:flex; align-items:center; gap:0.4em; font-size:0.85em; position:relative; }
      .flower[selected] { outline:2px solid #4af; background:#2a2f40; }
      .count { background:#0006; padding:0 0.5em; border-radius:0.6em; font-weight:600; }
      .sand { display:flex; align-items:center; gap:0.5em; }
      input[type=range] { flex:1; }
      .preview { background:#262830; padding:0.6em; border-radius:0.6em; font-size:0.8em; min-height:2.2em; display:flex; flex-wrap:wrap; gap:0.4em; }
      .preview-item { background:#333; padding:0.3em 0.5em; border-radius:0.5em; }
      .actions { display:flex; justify-content:space-between; gap:0.75em; }
      button { cursor:pointer; border:none; border-radius:0.6em; padding:0.6em 1.1em; font-weight:600; background:#394b60; color:#fff; font-size:0.9em; }
      button[disabled] { opacity:0.45; cursor:not-allowed; }
      .error { color:#ff8484; font-size:0.75em; min-height:1em; }
    `;
  }

  private render() {
    if (!this.shadowRoot) return;
    const open = this.hasAttribute("open");
    this.shadowRoot.innerHTML = "";
    const style = document.createElement("style");
    style.textContent = this.buildStyles();
    this.shadowRoot.appendChild(style);
    if (!open) return;
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    backdrop.onclick = () => this.close();
    this.shadowRoot.appendChild(backdrop);
    const panel = document.createElement("div");
    panel.className = "panel";
    this.shadowRoot.appendChild(panel);
    const title = document.createElement("h2");
    title.textContent = "Craft Colored Sand";
    panel.appendChild(title);

    if (!this.data) {
      const msg = document.createElement("div");
      msg.textContent = "No inventory bound.";
      panel.appendChild(msg);
      return;
    }

    // Flower selection
    const flowersWrap = document.createElement("div");
    flowersWrap.className = "flowers";
    panel.appendChild(flowersWrap);
    const flowerSlots = this.data.flowers.filter((f) => f.count > 0);
    if (flowerSlots.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No flowers collected.";
      panel.appendChild(empty);
    } else {
      for (const f of flowerSlots) {
        const el = document.createElement("div");
        el.className = "flower";
        const id = f.object as FlowerId;
        if (this.selectedFlower === id) el.setAttribute("selected", "");
        el.onclick = () => this.selectFlower(id);
        // Create a canvas to draw the flower sprite from the 'objects' atlas
        const canvas = document.createElement("canvas");
        // Original frames are 16x32; upscale for clarity
        const targetW = 32;
        const targetH = 64;
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        const game = (window as any).game as Phaser.Game | undefined;
        const tex = game?.textures?.get?.("objects");
        const frame = tex?.get?.(id);
        if (ctx && frame && frame.source?.image) {
          const img = frame.source.image;
          // Narrow to supported CanvasImageSource types
          const source: CanvasImageSource = img as
            | HTMLImageElement
            | HTMLCanvasElement;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            source,
            frame.cutX,
            frame.cutY,
            frame.width,
            frame.height,
            0,
            0,
            targetW,
            targetH
          );
        } else {
          // Fallback text label if texture not ready
          const fallback = document.createElement("span");
          fallback.textContent = id.replace("flower_", "");
          el.appendChild(fallback);
        }
        // Add count badge
        const count = document.createElement("span");
        count.className = "count";
        count.textContent = String(f.count);
        canvas.style.display = "block";
        canvas.style.borderRadius = "0.4em";
        // No background so the sprite appears directly on panel
        el.appendChild(canvas);
        el.appendChild(count);
        el.title = id.replace("flower_", "");
        flowersWrap.appendChild(el);
      }
    }

    // Sand selector
    const sandWrap = document.createElement("div");
    sandWrap.className = "sand";
    const sandLabel = document.createElement("span");
    sandLabel.textContent = `Sand: ${this.sandCount}/${this.maxSand}`;
    const sandRange = document.createElement("input");
    sandRange.type = "range";
    sandRange.min = "1";
    sandRange.max = String(Math.max(1, this.maxSand));
    sandRange.value = String(this.sandCount);
    sandRange.oninput = () => this.setSand(Number(sandRange.value));
    sandWrap.appendChild(sandLabel);
    sandWrap.appendChild(sandRange);
    panel.appendChild(sandWrap);

    // Preview
    const preview = document.createElement("div");
    preview.className = "preview";
    let validationError: string | undefined;
    let outputs: ReturnType<typeof simulateCraft> = [];
    if (this.selectedFlower) {
      outputs = simulateCraft(this.selectedFlower, this.sandCount);
      const v = validateCraft(
        this.selectedFlower,
        this.sandCount,
        this.data.inventory as any
      );
      if (!v.ok) validationError = v.error;
    }
    if (outputs.length) {
      for (const out of outputs) {
        const item = document.createElement("div");
        item.className = "preview-item";
        // Show block name via reverse lookup
        const name = Object.keys(assets.blocks.sprites).find(
          (k) =>
            assets.blocks.sprites[k as keyof typeof assets.blocks.sprites] ===
            out.block
        );
        item.textContent = `${out.count}x ${name ?? out.block}`;
        preview.appendChild(item);
      }
    } else {
      preview.textContent = this.selectedFlower
        ? "No output"
        : "Select a flower";
    }
    panel.appendChild(preview);

    // Error / status
    const errorEl = document.createElement("div");
    errorEl.className = "error";
    if (validationError) errorEl.textContent = validationError;
    panel.appendChild(errorEl);

    // Actions
    const actions = document.createElement("div");
    actions.className = "actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = () => this.close();
    const craftBtn = document.createElement("button");
    craftBtn.textContent = "Craft";
    const canCraft =
      !validationError && this.selectedFlower !== null && outputs.length > 0;
    if (!canCraft) craftBtn.setAttribute("disabled", "");
    craftBtn.onclick = () => this.performCraft();
    actions.appendChild(cancelBtn);
    actions.appendChild(craftBtn);
    panel.appendChild(actions);
  }
}

customElements.define("craft-modal", CraftModal);
