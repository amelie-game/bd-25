import { assets } from "../assets";

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

const Block = Object.values(assets.blocks.sprites) as ReadonlyArray<
  (typeof assets.blocks.sprites)[keyof typeof assets.blocks.sprites]
>;
type Block = (typeof Block)[number];

const Mode = ["collect", "move"] as const;
type Mode = (typeof Mode)[number];

const Option = [...Mode, ...Block] as const;
export type Option = (typeof Option)[number];

function toOptionType(value: unknown): Option {
  if (isFinite(Number(value)) && Block.includes(Number(value) as Block)) {
    return Number(value) as Block;
  }
  if (Mode.includes(value as Mode)) {
    return value as Mode;
  }

  throw new Error(`Invalid option type: ${value}`);
}

// --- <hud-option> ---
class HudOption extends HTMLElement {
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
    toOptionType(type);

    const selected = this.hasAttribute("selected");
    const count = this.getAttribute("count");

    this.innerHTML = "";
    const btn = document.createElement("button");
    btn.className = selected ? " selected" : "";

    if (type === "collect") {
      const icon = document.createElement("div");
      icon.className = "hud-icon";
      icon.innerHTML = "⛏️";
      btn.appendChild(icon);
    } else if (type === "move") {
      const icon = document.createElement("div");
      icon.className = "hud-icon";
      icon.innerHTML = "🚶";
      btn.appendChild(icon);
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      canvas.style.borderRadius = "0.7em";
      canvas.style.background = "#222";
      canvas.style.display = "block";
      canvas.style.boxSizing = "border-box";
      const ctx = canvas.getContext("2d");
      const w: any = window;
      if (ctx && w["game"] && w["game"].textures) {
        const tex = w["game"].textures.get("blocks");
        if (tex) {
          const frame = tex.get(type);
          if (frame) {
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
      btn.appendChild(canvas);
      if (count !== null && count !== undefined) {
        const badge = document.createElement("hud-badge");
        badge.setAttribute("count", count);
        btn.appendChild(badge);
      }
    }
    this.appendChild(btn);
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
    onSelect,
  }: {
    options: HudDropdown["options"];
    selected: HudDropdown["selected"];
    onSelect: HudDropdown["onSelect"];
  }) {
    this.options = options;
    this.selected = selected;
    this.onSelect = onSelect;
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
    if (!this.options || this.options.length === 0) return;
    const root = document.createElement("div");
    root.className = "hud-dropdown-root";

    // Selected option (always visible)
    const selectedOpt =
      this.options.find((o) => o.value === this.selected) || this.options[0];

    if (this.open) {
      const list = document.createElement("div");
      list.className = "hud-dropdown-list with-frame with-shadow";
      root.appendChild(list);

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

    const dropdownCtrl = document.createElement("div");
    dropdownCtrl.className = "with-frame with-shadow";

    const selectedEl = document.createElement("hud-option");
    selectedEl.setAttribute("type", String(selectedOpt.value));
    selectedEl.setAttribute("count", String(selectedOpt.count));
    if (this.selected === selectedOpt.value) {
      selectedEl.setAttribute("selected", "");
    }
    selectedEl.onclick = this.handleToggle;

    dropdownCtrl.appendChild(selectedEl);
    root.appendChild(dropdownCtrl);

    // Dropdown list
    this.appendChild(root);
  }
}
customElements.define("hud-dropdown", HudDropdown);

// --- <amelcraft-hud> ---
class HudRoot extends HTMLElement {
  private options: HudDropdown["options"] = [];
  private selected: Option = "move";
  private onSelect: (value: Option) => void = () => {};

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
    this.selected = value;
    this.onSelect(value);
    this.render();
  };

  render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = "";
    this.injectStyles();

    const hud = document.createElement("div");
    hud.className = "hud";
    this.shadowRoot.appendChild(hud);

    const moveOption = document.createElement("hud-option");
    moveOption.className = "with-frame with-shadow";
    moveOption.setAttribute("type", "move");
    if (this.selected === "move") moveOption.setAttribute("selected", "");
    moveOption.onclick = () => this.handleSelect("move");
    hud.appendChild(moveOption);

    const dropdown = document.createElement("hud-dropdown") as any;
    (dropdown as any).data = {
      options: this.options,
      selected: this.selected,
      onSelect: this.handleSelect,
    };
    hud.appendChild(dropdown);

    const collectOption = document.createElement("hud-option");
    collectOption.className = "with-frame with-shadow";
    collectOption.setAttribute("type", "collect");
    if (this.selected === "collect") collectOption.setAttribute("selected", "");
    collectOption.onclick = () => this.handleSelect("collect");
    hud.appendChild(collectOption);
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
  .hud {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    padding: 1em;
    display: flex;
    gap: 1em;
    justify-content: center;
    align-items: end;
  }
  .hud-dropdown-root {
    /* pointer-events: none; */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1em;
    user-select: none;
  }
  .hud-dropdown-list {
    width: auto;
    max-width: 100%;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: repeat(auto-fit, 64px);
    grid-auto-rows: 64px;
    justify-content: center;
    align-content: end;
    pointer-events: auto;
    gap: 0.5em;
  }
  button {
    background: none;
    border: none;
    border-radius: 0.7em;
    padding: 0.1em 0.1em;
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
  .whith-shadow {
    box-shadow: 0 2px 12px #0008;
  }
`;
