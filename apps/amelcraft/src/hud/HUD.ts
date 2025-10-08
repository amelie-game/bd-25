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
  private static getContent(type: unknown, count?: string | null) {
    try {
      const option = toOption(type);

      switch (option) {
        case "collect": {
          const icon = document.createElement("div");
          icon.className = "hud-icon";
          icon.innerHTML = "⛏️";
          return [icon];
        }
        case "move": {
          const icon = document.createElement("div");
          icon.className = "hud-icon";
          icon.innerHTML = "🚶";
          return [icon];
        }
        default: {
          const canvas = document.createElement("canvas");
          canvas.width = 64;
          canvas.height = 64;
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
                  64,
                  64
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

  set data({
    blockKeys,
    selected,
    onSelect,
  }: {
    blockKeys: HudDropdown["options"];
    selected?: Option;
    onSelect: (value: Option) => void;
  }) {
    this.options = blockKeys;
    this.selected = selected ?? "collect";
    this.onSelect = onSelect;
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
      this.selected !== "move" && this.selected !== "collect"
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
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    padding: 1em;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1em;
    user-select: none;
    max-width: calc(100% - 2em);
    box-sizing: border-box;
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
    gap: 1em;
    justify-content: center;
    align-items: end;
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
    min-width: 64px;
    min-height: 64px;
    overflow: hidden;
  }
  button.selected {
    background: linear-gradient(90deg, #fff2, #fff4);
    opacity: 1;
    box-shadow: 0 0 0 2px #fff6;
    border-radius: 0.7em;
  }
  .hud-icon {
    width: 64px;
    height: 64px;
    font-size: 48px;
    line-height: 64px;
    text-align: center;
    user-select: none;
    box-sizing: border-box;
  }
  .hud-badge {
    position: absolute;
    right: 2px;
    bottom: 2px;
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
    button { min-width: 48px; min-height: 48px; }
    .hud-badge { font-size: 0.95em; }
  }
  @media (max-width: 400px) {
    button { min-width: 36px; min-height: 36px; }
    .hud-badge { font-size: 0.85em; }
  }
  .with-frame {
    background: rgba(30,30,40,0.92);
    border-radius: 0.7em;
    padding: 0.7em;
  }
  .with-shadow {
    box-shadow: 0 2px 12px #0008;
  }
`;
