import { Block, isBlock, Option, toOption } from "../types";

// --- <hud-badge> ---
class HudBadge extends HTMLElement {
  static get observedAttributes() {
    return ["count"];
  }
  attributeChangedCallback() {
    this.render();
  }
  connectedCallback() {
    this.render();
  }
  render() {
    this.innerHTML = `<span class="hud-badge">${this.getAttribute(
      "count"
    )}</span>`;
  }
}
customElements.define("hud-badge", HudBadge);

// --- <hud-option> ---
class HudOption extends HTMLElement {
  private static applyIconStyle(icon: HTMLElement, size: number) {
    icon.style.width = size + "px";
    icon.style.height = size + "px";
    icon.style["lineHeight"] = size + "px";
    icon.style["fontSize"] = size * 0.9 + "px";
  }

  private static getContent(type: unknown, count?: string | null) {
    try {
      const option = toOption(type);
      const size = HudOption.getResponsiveSize();

      switch (option) {
        case "collect": {
          const icon = document.createElement("div");
          icon.className = "hud-icon";
          HudOption.applyIconStyle(icon, size);
          icon.innerHTML = "⛏️";
          return [icon];
        }
        case "move": {
          const icon = document.createElement("div");
          icon.className = "hud-icon";
          HudOption.applyIconStyle(icon, size);
          icon.innerHTML = "🚶";
          return [icon];
        }
        case "craft": {
          const icon = document.createElement("div");
          icon.className = "hud-icon";
          HudOption.applyIconStyle(icon, size);
          icon.innerHTML = "⚗️"; // beaker / alchemy icon
          return [icon];
        }
        default: {
          const canvas = document.createElement("canvas");
          // Internal resolution matches displayed size for simplicity
          canvas.width = size;
          canvas.height = size;
          canvas.style.width = size + "px";
          canvas.style.height = size + "px";
          canvas.style.borderRadius = "0.7em";
          canvas.style.background = "#222";
          canvas.style.display = "block";
          canvas.style.boxSizing = "border-box";
          const ctx = canvas.getContext("2d");
          if (ctx && window.game?.textures) {
            const tex = window.game.textures.get("blocks");
            if (tex && type !== null) {
              const frame = tex.get(option);
              if (frame && HudOption.isDrawable(frame.source.image)) {
                const source = frame.source.image;
                ctx.drawImage(
                  source,
                  frame.cutX,
                  frame.cutY,
                  frame.width,
                  frame.height,
                  0,
                  0,
                  size,
                  size
                );
              }
            }
          }
          if (count !== null && count !== undefined) {
            const badge = document.createElement("hud-badge");
            badge.setAttribute("count", count);
            return [canvas, badge];
          }
          return [canvas];
        }
      }
    } catch (e) {
      console.error("HudOption.getContent error", e);
    }
    return null;
  }

  // Determine responsive size based on window width matching CSS breakpoints
  static getResponsiveSize(): number {
    try {
      const w = window.innerWidth;
      if (w <= 400) return 36;
      if (w <= 600) return 48;
      return 64;
    } catch {
      return 64; // Fallback for non-browser/SSR contexts
    }
  }

  static isDrawable(img: unknown): img is HTMLImageElement | HTMLCanvasElement {
    return img instanceof HTMLImageElement || img instanceof HTMLCanvasElement;
  }

  static get observedAttributes() {
    return ["selected", "type", "count"];
  }

  attributeChangedCallback() {
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const type = this.getAttribute("type");
    const selected = this.hasAttribute("selected");
    const count = this.getAttribute("count");

    this.innerHTML = "";
    const btn = document.createElement("button");
    btn.className = selected ? " selected" : "";
    this.appendChild(btn);

    HudOption.getContent(type, count)?.forEach((child) =>
      btn.appendChild(child)
    );
  }
}
customElements.define("hud-option", HudOption);

// --- <hud-dropdown> ---
class HudDropdown extends HTMLElement {
  private options: { key: Block; value: Block; count: number }[] = [];
  private selected: Block | null = null;
  private open = false;
  private onSelect: ((value: Block) => void) | null = null;

  set data({
    options,
    selected,
    open,
    onSelect,
  }: {
    options: HudDropdown["options"];
    selected: HudDropdown["selected"];
    open: HudDropdown["open"];
    onSelect: HudDropdown["onSelect"];
  }) {
    this.options = options;
    this.selected = selected;
    this.open = open;
    this.onSelect = onSelect;
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  private handleToggle = () => {
    this.open = !this.open;
    this.render();
  };

  private handleSelect = (value: Block) => {
    this.open = false;
    if (this.onSelect) this.onSelect(value);
    this.render();
  };

  render() {
    this.innerHTML = "";
    if (!this.options || this.options.length === 0 || !this.open) return;

    const list = document.createElement("div");
    list.className = "hud-dropdown-list with-frame with-shadow";
    this.appendChild(list);

    for (const opt of this.options) {
      const optEl = document.createElement("hud-option");
      optEl.setAttribute("type", String(opt.value));
      optEl.setAttribute("count", String(opt.count));
      if (this.selected === opt.value) {
        optEl.setAttribute("selected", "");
      }
      optEl.onclick = () => this.handleSelect(opt.value);
      list.appendChild(optEl);
    }
  }
}
customElements.define("hud-dropdown", HudDropdown);

// --- <amelcraft-hud> ---
export class HudRoot extends HTMLElement {
  private options: HudDropdown["options"] = [];
  private selected: Option = "move";
  private onSelect: (value: Option) => void = () => {};
  private dropdownOpen = false;
  private showPresent = false;
  private onPresentClick: (() => void) | null = null;

  set data({
    blockKeys,
    selected,
    onSelect,
    flowersCount,
    showPresent,
    onPresentClick,
  }: {
    blockKeys: HudDropdown["options"];
    selected?: Option;
    onSelect: (value: Option) => void;
    flowersCount?: number;
    showPresent?: boolean;
    onPresentClick?: () => void;
  }) {
    this.options = blockKeys;
    this.selected = selected ?? "collect";
    this.onSelect = onSelect;
    (this as any)._flowersCount = flowersCount ?? 0;
    this.showPresent = showPresent ?? false;
    this.onPresentClick = onPresentClick ?? null;
    this.render();
  }

  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.render();
  }

  private handleSelect = (value: Option) => {
    this.dropdownOpen = false;
    this.selected = value;
    this.onSelect(value);
    this.render();
  };

  render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = "";
    this.injectStyles();

    // Make the custom element the container by applying the hud class to the host
    // and append children directly into the shadow root.
    this.className = "hud";

    const dropdown = document.createElement("hud-dropdown") as HTMLElement &
      HudDropdown;
    dropdown.data = {
      options: this.options,
      selected: isBlock(this.selected) ? this.selected : null,
      onSelect: this.handleSelect,
      open: this.dropdownOpen,
    };
    this.shadowRoot.appendChild(dropdown);

    const controls = document.createElement("div");
    controls.className = "hud-controls";
    this.shadowRoot.appendChild(controls);

    const moveOption = document.createElement("hud-option");
    moveOption.className = "with-frame with-shadow";
    moveOption.setAttribute("type", "move");
    if (this.selected === "move") moveOption.setAttribute("selected", "");
    moveOption.onclick = () => this.handleSelect("move");
    controls.appendChild(moveOption);

    const selectedBlock =
      this.selected !== "move" &&
      this.selected !== "collect" &&
      this.selected !== "craft"
        ? this.selected
        : null;

    const blockOption = document.createElement("hud-option");
    blockOption.className = "with-frame with-shadow";

    if (selectedBlock !== null) {
      blockOption.setAttribute("type", String(selectedBlock));
      blockOption.setAttribute("selected", "");
      blockOption.setAttribute(
        "count",
        String(
          this.options.find((opt) => opt.value === selectedBlock)?.count || 0
        )
      );
    }
    blockOption.onclick = () => {
      this.dropdownOpen = !this.dropdownOpen;
      dropdown.data = {
        options: this.options,
        selected: isBlock(this.selected) ? this.selected : null,
        onSelect: this.handleSelect,
        open: this.dropdownOpen,
      };
    };
    controls.appendChild(blockOption);

    const collectOption = document.createElement("hud-option");
    collectOption.className = "with-frame with-shadow";
    collectOption.setAttribute("type", "collect");
    if (this.selected === "collect") collectOption.setAttribute("selected", "");
    collectOption.onclick = () => this.handleSelect("collect");
    controls.appendChild(collectOption);

    const craftOption = document.createElement("hud-option");
    craftOption.className = "with-frame with-shadow";
    craftOption.setAttribute("type", "craft");
    if (this.selected === "craft") craftOption.setAttribute("selected", "");
    craftOption.onclick = () => this.handleSelect("craft");
    controls.appendChild(craftOption);

    // Aggregate flower count badge (hidden resource) if >0
    const flowersCount = (this as any)._flowersCount as number | undefined;
    if (flowersCount && flowersCount > 0) {
      const badge = document.createElement("hud-badge");
      badge.setAttribute("count", String(flowersCount));
      (badge.style as any).transform = "scale(0.85)";
      // Show count only on craft option (hidden resource indicator)
      craftOption.querySelector("button")?.appendChild(badge);
    }

    if (this.showPresent) {
      // --- Present test button ---
      // Custom button (not using hud-option logic) to render the Present sprite from objects atlas.
      const presentWrapper = document.createElement("div");
      // Add a specific class so we can target it later if needed.
      presentWrapper.className = "present-wrapper with-frame with-shadow";
      // Position independently of the HUD bottom controls in the top-right corner of the viewport.
      presentWrapper.style.position = "fixed";
      presentWrapper.style.top = "0.75em";
      presentWrapper.style.right = "0.75em";
      presentWrapper.style.display = "inline-block";
      presentWrapper.style.zIndex = "10000"; // ensure it stays above other elements
      const presentBtn = document.createElement("button");
      presentWrapper.appendChild(presentBtn);
      const presentCanvas = document.createElement("canvas");
      const pSize = HudOption.getResponsiveSize();
      presentCanvas.width = pSize;
      presentCanvas.height = pSize;
      presentCanvas.style.width = pSize + "px";
      presentCanvas.style.height = pSize + "px";
      presentCanvas.style.borderRadius = "0.7em";
      presentCanvas.style.background = "#222";
      presentCanvas.style.display = "block";
      presentCanvas.style.boxSizing = "border-box";
      const pctx = presentCanvas.getContext("2d");
      try {
        if (pctx && (window as any).game?.textures) {
          const tex = (window as any).game.textures.get("objects");
          if (tex) {
            const frame = tex.get("present");
            if (
              frame &&
              (frame.source.image instanceof HTMLImageElement ||
                frame.source.image instanceof HTMLCanvasElement)
            ) {
              const source = frame.source.image;
              pctx.drawImage(
                source,
                frame.cutX,
                frame.cutY,
                frame.width,
                frame.height,
                0,
                0,
                pSize,
                pSize
              );
            }
          }
        }
      } catch (e) {
        console.error("Present button draw error", e);
      }
      presentBtn.appendChild(presentCanvas);
      presentBtn.onclick = () => {
        if (this.onPresentClick) {
          try {
            this.onPresentClick();
          } catch (e) {
            console.error("onPresentClick error", e);
          }
        } else {
          // Fallback test alert if no callback provided
          window.alert("test alert");
        }
      };
      this.shadowRoot.appendChild(presentWrapper);
    }
  }

  injectStyles() {
    if (!this.shadowRoot) return;
    const style = document.createElement("style");
    style.textContent = rootStyle;
    this.shadowRoot.appendChild(style);
  }

  getSelected() {
    return this.selected;
  }
}
customElements.define("amelcraft-hud", HudRoot);
export { HudRoot as HUD };

const rootStyle = `
  :host(.hud) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    padding: 1em;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1em;
    user-select: none;
    box-sizing: border-box;
    /* Allow touches/clicks in empty HUD areas to pass through to the game canvas */
    pointer-events: none;
  }
  .hud-dropdown-list {
    width: auto;
    max-width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-content: end;
    pointer-events: auto;
    gap: 0.75em;
  }
  .hud-controls {
    display: flex;
    flex-direction: row;
    /* Use wrap-reverse so new rows appear above existing bottom row (bottom-up stacking) */
    flex-wrap: wrap-reverse;
    gap: 1em;
    justify-content: center;
    align-items: end;
    /* Ensure the collection of lines stays anchored to the bottom, letting extra rows grow upward */
    align-content: flex-end;
    /* Pass through events for gaps between buttons */
    pointer-events: none;
  }
  button {
    background: none;
    border: none;
    border-radius: 0.7em;
    padding: 0;
    cursor: pointer;
    outline: none;
    transition: background 0.15s, color 0.15s;
    opacity: 0.85;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
    /* Keep buttons interactive despite ancestor pointer-events:none */
    pointer-events: auto;
  }
  button.selected {
    background: linear-gradient(90deg, #fff2, #fff4);
    opacity: 1;
    box-shadow: 0 0 0 2px #fff6;
    border-radius: 0.7em;
  }
  .hud-icon {
    text-align: center;
    user-select: none;
    box-sizing: border-box;
  }
  .hud-badge {
    position: absolute;
    right: 0;
    bottom: 0;
    background: #222c;
    color: #fff;
    font-size: 1em;
    border-radius: 0.7em;
    padding: 0.1em 0.7em;
    font-weight: bold;
    box-shadow: 0 1px 4px #0006;
    pointer-events: none;
  }
  @media (max-width: 600px) {
    .hud-badge { font-size: 0.95em; }
  }
  @media (max-width: 400px) {
    .hud-badge { font-size: 0.85em; }
  }
  .with-frame {
    background: rgba(30,30,40,0.92);
    border-radius: 0.7em;
    padding: 0.7em;
    /* Frames wrap buttons; ensure they remain interactive */
    pointer-events: auto;
  }
  .with-shadow {
    box-shadow: 0 2px 12px #0008;
  }
`;
