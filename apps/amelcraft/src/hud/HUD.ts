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
  static get observedAttributes() {
    return ["selected", "type", "block", "count"];
  }
  attributeChangedCallback() {
    this.render();
  }
  connectedCallback() {
    this.render();
  }
  render() {
    const selected = this.hasAttribute("selected");
    const type = this.getAttribute("type");
    const block = this.getAttribute("block");
    const count = this.getAttribute("count");
    this.innerHTML = "";
    const btn = document.createElement("button");
    btn.className = "hud-btn" + (selected ? " selected" : "");
    if (type === "dig") {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "64");
      svg.setAttribute("height", "64");
      svg.setAttribute("viewBox", "0 0 32 32");
      svg.innerHTML = `<path d="M4 8 Q16 0 28 8" stroke="#bbb" stroke-width="3" fill="none"/><rect x="14" y="8" width="4" height="16" rx="2" fill="#a86" stroke="#654" stroke-width="1.5"/><rect x="15.5" y="22" width="1" height="6" rx="0.5" fill="#ccc"/>`;
      svg.style.borderRadius = "0.7em";
      svg.style.background = "#222";
      svg.style.display = "block";
      svg.style.boxSizing = "border-box";
      btn.appendChild(svg);
    } else if (type === "block" && block) {
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
          const frame = tex.get(Number(block));
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
  private options: { key: string; value: number | "dig"; count: number }[] = [];
  private selected: number | "dig" = "dig";
  private open = false;
  private onSelect: ((value: number | "dig") => void) | null = null;

  set data({
    options,
    selected,
    onSelect,
  }: {
    options: { key: string; value: number | "dig"; count: number }[];
    selected: number | "dig";
    onSelect: (value: number | "dig") => void;
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

  private handleSelect = (value: number | "dig") => {
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
    if (!selectedOpt) return;

    if (this.open) {
      const list = document.createElement("div");
      list.className = "hud-dropdown-list with-frame with-shadow";
      for (const opt of this.options) {
        if (opt.value === this.selected) continue;
        const optEl = document.createElement("hud-option");
        optEl.setAttribute("type", opt.key === "dig" ? "dig" : "block");
        if (opt.key !== "dig") optEl.setAttribute("block", String(opt.value));
        if (opt.key !== "dig") optEl.setAttribute("count", String(opt.count));
        optEl.onclick = () => this.handleSelect(opt.value);
        list.appendChild(optEl);
      }
      root.appendChild(list);
    }

    const dropdownCtrl = document.createElement("div");
    dropdownCtrl.className = "with-frame with-shadow";

    const selectedEl = document.createElement("hud-option");
    selectedEl.setAttribute(
      "type",
      selectedOpt.key === "dig" ? "dig" : "block"
    );
    if (selectedOpt.key !== "dig")
      selectedEl.setAttribute("block", String(selectedOpt.value));
    if (selectedOpt.key !== "dig")
      selectedEl.setAttribute("count", String(selectedOpt.count));
    if (this.open) selectedEl.setAttribute("selected", "");
    selectedEl.onclick = this.handleToggle;

    dropdownCtrl.appendChild(selectedEl);
    root.appendChild(dropdownCtrl);

    // Dropdown list
    this.appendChild(root);
  }
}
customElements.define("hud-dropdown", HudDropdown);

// --- <game-hud> ---
class HudRoot extends HTMLElement {
  private options: { key: string; value: number | "dig"; count: number }[] = [];
  private selected: number | "dig" = "dig";
  private onSelect: (value: number | "dig") => void = () => {};

  set data({
    blockKeys,
    selected,
    onSelect,
  }: {
    blockKeys: { key: string; value: number; count: number }[];
    selected?: number | "dig";
    onSelect: (value: number | "dig") => void;
  }) {
    this.options = [{ key: "dig", value: "dig", count: 0 }, ...blockKeys];
    this.selected = selected ?? "dig";
    this.onSelect = onSelect;
    this.render();
  }

  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.render();
  }

  private handleSelect = (value: number | "dig") => {
    this.selected = value;
    this.onSelect(value);
    this.render();
  };

  render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = "";
    this.injectStyles();
    this.style.display = "block";
    this.style.position = "fixed";
    this.style.bottom = "0";
    this.style.left = "0";
    this.style.right = "0";
    this.style.zIndex = "9999";
    this.style.padding = "1em";

    const dropdown = document.createElement("hud-dropdown") as any;
    (dropdown as any).data = {
      options: this.options,
      selected: this.selected,
      onSelect: this.handleSelect,
    };
    this.shadowRoot.appendChild(dropdown);
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
  .hud-btn {
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
  .hud-btn.selected {
    background: linear-gradient(90deg, #fff2, #fff4);
    opacity: 1;
    box-shadow: 0 0 0 2px #fff6;
    border-radius: 0.7em;
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
    .hud-btn { min-width: 48px; min-height: 48px; }
    .hud-badge { font-size: 0.95em; }
  }
  @media (max-width: 400px) {
    .hud-btn { min-width: 36px; min-height: 36px; }
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
