## Colored Sand Crafting System

### Status
Design Phase – Implementation pending (inventory removal helpers, crafting module, HUD modal, tests). This document defines the initial crafting feature focused on converting base sand (Yellow) plus a single flower into colored sand blocks. Keeps HUD minimal by using a modal opened from a dedicated HudOption.

---

## 1. Goals

1. Enable players to transform Yellow sand blocks into colored sand variants using flowers.
2. Maintain a minimal HUD: crafting interaction lives inside a modal invoked by a single HudOption icon.
3. Guarantee atomic crafting transactions (all inputs consumed only if outputs can be fully added to inventory).
4. Provide deterministic distribution for mixed output recipes (red flower 50/50 split) for predictable player experience.
5. Avoid clutter: flowers remain a hidden resource except aggregate count badge and crafting modal.

Non-goals (first iteration): batch multi-flower recipes, partial output on inventory overflow, asynchronous crafting timers, animation/sound polish, recipe discovery mechanics.

---

## 2. Terminology

| Term | Meaning |
|------|---------|
| Flower | A collected object (ObjectId) with id starting `flower_`. Consumed as catalyst. |
| Sand (Base) | The Yellow block (`assets.blocks.sprites.Yellow`) used as input. |
| Colored Sand | Output blocks (Red, LightRed, LightCyan, Cyan (Turquoise fallback), Blue, Magenta, LightMagenta). |
| Crafting Transaction | Single action consuming 1 flower + N base sand (1..10) producing N colored sand blocks. |
| Recipe | Mapping flower id -> output distribution rule. |

---

## 3. Input / Output Contract

Contract (single craft operation):
- Inputs: exactly 1 flower object + `n` Yellow sand blocks where `1 <= n <= 10` and inventory holds at least `n` Yellow.
- Output count: exactly `n` blocks (one-for-one conversion, no multiplier).
- Output kind distribution per flower:
  - `flower_red` -> 50% Red, 50% LightRed (odd counts: extra goes to Red first)  
  - `flower_cyan` -> 100% LightCyan  
  - `flower_turquoise` -> 100% Cyan  
  - `flower_blue` -> 100% Blue  
  - `flower_purple` -> 100% Magenta  
  - `flower_pink` -> 100% LightMagenta  

Failure Modes:
- No eligible flower selected → UI disables craft button.
- Sand amount zero → UI disables craft button.
- Insufficient Yellow sand → UI disables craft button.
- Inventory does not have space for all output stacks → transaction aborted, show error.

Atomicity: On success remove 1 flower + `n` Yellow, then add output blocks. If any addition fails mid-way, rollback (re-add removed inputs) and present failure message.

---

## 4. Recipes Data Structure

```ts
interface CraftRecipe {
  id: ObjectId;                 // flower id
  distribute(n: number): { block: Block; count: number }[]; // deterministic
  description: string;          // shown in modal
}
```

Implementation details:
- Use a recipe map keyed by flower id.
- For mixed distribution (red) implement integer split: `Math.floor(n/2)` LightRed, remainder Red.

---

## 5. Inventory API Additions

New methods required:
```ts
removeBlock(block: Block, count: number): boolean;      // all-or-nothing
removeObject(id: ObjectId, count?: number): boolean;     // default count=1
addMany(block: Block, count: number): boolean;          // treat stacks; returns false if cannot add all
```
Rollback helper could snapshot affected slots or perform inverse operations immediately if failure occurs during output addition.

---

## 6. Crafting Module (`Crafting.ts`)

Responsibilities:
- Validation (`validateCraft(flowerId, sandCount, inventory)`)
- Simulation (`simulate(flowerId, sandCount)` returns distribution for preview)
- Execution (`executeCraft(flowerId, sandCount, inventory)` returns result object `{ ok, outputs, error? }`)

Pseudo-code:
```ts
function executeCraft(flowerId: ObjectId, n: number, inv: Inventory): CraftResult {
  const recipe = RECIPES[flowerId];
  if (!recipe) return { ok: false, error: 'Unknown recipe' };
  if (n < 1 || n > 10) return { ok: false, error: 'Invalid sand amount' };
  if (!inv.has(Yellow) || inv.count(Yellow) < n) return { ok: false, error: 'Not enough sand' };
  if (!inv.hasObject(flowerId)) return { ok: false, error: 'Flower missing' };
  const outputs = recipe.distribute(n);
  // Check capacity
  if (!canAddAll(inv, outputs)) return { ok: false, error: 'Inventory full' };
  // Apply (atomic)
  inv.removeObject(flowerId);
  inv.removeBlock(Yellow, n);
  if (!addAll(inv, outputs)) {
    // rollback
    inv.addObject(flowerId);
    inv.addMany(Yellow, n);
    return { ok: false, error: 'Inventory overflow during add' };
  }
  return { ok: true, outputs };
}
```

---

## 7. HUD & Modal Integration

HUD Changes:
- Add new HudOption ("craft") with beaker icon ⚗️.
- Clicking it toggles `<craft-modal>` (overlay panel centered).

Modal `<craft-modal>`:
- Flower selection (list of flower types with counts).
- Sand amount selector (range 1..10 clamped by available Yellow count).
- Live preview of output distribution (colored block icons + counts).
- Craft button (HudOption styling) disabled until valid; shows reason in `title` attribute.
- Close controls: ESC key, backdrop click, or success.

Minimalism: Modal only appears when actively crafting; HUD itself adds exactly one icon. No persistent extra panels.

---

## 8. UI States & Feedback

States:
1. Empty (no flowers) → message "No flowers collected"; craft disabled.
2. Insufficient sand → display current vs required.
3. Overflow risk → message advising freeing inventory space.
4. Success → transient confirmation (e.g. fade-out toast) then modal auto-closes.

Accessibility Considerations: Use semantic buttons, focus first interactive element, ESC to close, ARIA role `dialog` with `aria-modal="true"`.

---

## 9. Testing Strategy

Unit Tests (Vitest):
- Red recipe splitting even/odd counts.
- Each 100% recipe outputs correct block id and count.
- Blocked yellow flower returns error; inventory unaffected.
- Insufficient sand count error.
- Inventory space failure triggers rollback (flower + sand unchanged).
- Maximum sand (10) success path.

Integration-esque:
- Simulate inventory with multiple flowers & sand; execute craft; ensure HUD update call expected.

Edge Cases:
- Sand count exactly matches remaining stack capacity for output blocks.
- Inventory nearly full (adding outputs require new slot vs merge).

---

## 10. Performance & Limits

- Max sand per craft: 10 (tiny scope → negligible performance impact).
- Distribution function O(1) per output kind (worst-case 2 entries for red split).
- Modal instantiation on demand; no persistent interval updates.

---

## 11. Future Enhancements

| Idea | Description |
|------|-------------|
| DarkCyan Asset | Add new block sprite enabling distinct turquoise output. |
| Multi-Flower Boost | More flowers => multiplier (e.g., 1 flower + 10 sand → 12 colored). |
| Discovery System | Unlock recipes on first flower collection. |
| Craft Queue | Batch multiple crafts before closing modal. |
| Particle Effects | Sand tinting animation during craft. |
| Sound Feedback | Success / failure audio cues. |

---

## 12. Open Questions

1. Should sand amount 0 be allowed for preview only? (Currently disallow.)
2. Rollback strategy acceptable or should we pre-check slot capacity more deeply to avoid partial add attempts?

---

## 13. Implementation Checklist

```
1. [x] Extend Inventory (removeBlock, removeObject, addMany, hasObject, count helpers)
2. [ ] Add 'craft' to Option union & HUD icon
3. [ ] Create Crafting.ts (recipes, simulate, execute)
4. [ ] Implement <craft-modal> custom element
5. [ ] Integrate HUD option toggling modal
6. [ ] Wire CraftResult HUD refresh workflow
7. [ ] Add unit tests for crafting logic
8. [ ] Update COLLECTIBLES.md (link to crafting doc) or cross-reference
9. [ ] Optional: toast feedback on success/failure
```

---

## 14. Quick Reference

| Concern | Location |
|---------|----------|
| Recipes Map | `Crafting.ts` RECIPES constant |
| Yellow block id | `assets.blocks.sprites.Yellow` |
| Flower ids | `assets.objects.sprites.*` with `flower_` prefix |
| Modal element | `<craft-modal>` (shadow DOM recommended) |
| Execution entry | `executeCraft()` |

---

End of design.
