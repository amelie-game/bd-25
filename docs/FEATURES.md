## Movement and Interaction Concept

### Requirements

- **R1:** The movement and interaction concept should work on mouse/trackpad controlled devices (e.g. laptops and desktop PCs) and on touch controlled devices (e.g. tablets and phones).
- **R2:** Ideally the controls are exactly the same on touch and mouse controlled devices. However, if the UX is better, if they are not exactly the same, it would be acceptable.
- **R3:** A player should be able to move the PC around in the world.
- **R4:** The PC should always be visible, even if it gets to the camera view bounds.
- **R5:** The player should be able to zoom in and out, while zooming in should always center on the PC.
- **R6:** The player should be able to place blocks by tapping/clicking.
- **R7:** The player should be able to collect blocks by pressing down on a block for 2 seconds.
- **R8:** The player should be able to precisely see and control which block they will interact with (placing and collecting).

### Design Concepts

#### 1. Movement & Camera

- **Direct Tap/Click to Move:** Tap/click anywhere on the ground to set a destination. PC walks there automatically.
- **Drag to Pan:** Drag with two fingers (touch) or right mouse button (mouse) to pan the camera (optional).
- **Pinch/Scroll to Zoom:** Pinch (touch) or scroll wheel (mouse) to zoom, always centering on the PC when zooming in.
- **Camera Dead Zone:** Camera follows the PC, but allows a small dead zone so the PC can move a bit before the camera recenters. If the PC approaches the edge, the camera recenters to keep the PC visible (R4).

#### 2. Block Placement & Collection

- **Block Highlight:** When hovering (mouse) or tapping (touch), highlight the block under the cursor/finger. This gives precise feedback (R8).
- **Place Block:** Tap/click on a highlighted block to place the selected block (R6).
- **Collect Block:** Tap and hold (touch) or click and hold (mouse) for 2 seconds on a block to collect it (R7).
- **Interaction Range:** Allow the PC to interact with blocks within a certain radius (e.g., 1-2 tiles away), so the player doesn't have to stand exactly on the block.

#### 3. UI/UX Consistency

- **Unified Controls:** Use the same tap/click and hold logic for both mouse and touch. Only gestures like pinch-to-zoom or two-finger pan differ, which is standard and expected.
- **Visual Feedback:** Always show which block is targeted for interaction (highlight, outline, or tooltip).

### Example Interaction Flow

- **Move:** Tap/click on the ground. PC walks there. Camera follows, keeping PC visible.
- **Zoom:** Pinch (touch) or scroll (mouse). Zoom centers on PC.
- **Place Block:** Tap/click on a block within range. Block is placed.
- **Collect Block:** Tap and hold (touch) or click and hold (mouse) for 2 seconds on a block within range. Block is collected.
- **Highlight:** As the cursor/finger moves, the block under it is highlighted, showing exactly which block will be affected.

### Edge Cases & Details

- **Interaction Range:** If the player tries to interact with a block out of range, show a visual indicator (e.g., red highlight or shake).
- **Touch vs Mouse:** On touch, use a short tap for placement and a long press for collection. On mouse, use left click for placement and left click+hold for collection.
- **Camera Bounds:** If the PC moves near the edge, the camera recenters to keep the PC visible (R4).
- **Zoom:** When zooming in, always center on the PC (R5).
- **Block Collection Progress:** When collecting a block (tap/hold or click/hold), show a small progress bar above the block. The block is removed as soon as the timer completes (2 seconds), even if the player keeps holding. If the pointer/finger moves away or is released early, the progress is canceled and the bar disappears.

### Summary Table

| Action                | Mouse/Trackpad         | Touch                | Visual Feedback         |
|-----------------------|------------------------|----------------------|------------------------|
| Move                  | Left click on ground   | Tap on ground        | PC walks, camera follows|
| Place block           | Left click on block    | Tap on block         | Block highlight        |
| Collect block         | Left click+hold 2s     | Tap+hold 2s on block | Block highlight, timer |
| Zoom                  | Scroll wheel           | Pinch                | Zoom animates, centers |
| Pan camera (optional) | Right click+drag       | Two-finger drag      | Camera moves           |

## Inventory, Block Placement & Collection Logic

### Requirements

- **I1:** The player has an inventory with a limited number of slots (e.g., 16).
- **I2:** Each slot can hold a stack of blocks of the same type, up to a maximum stack size of 99.
- **I3:** When collecting a block, if the inventory is full or the stack for that block type is full, the block will only be removed, but won't increase the count in the inventory any further.
- **I4:** When placing a block, the player must have at least one of that block type in their inventory.
- **I5:** If a block is placed, one is removed from the inventory. If a block is collected, one is added to the inventory (if possible).
- **I6:** The HUD should always show the current inventory and the selected block type for placement.
- **I7:** Blocks with count 0 will not be visible in the inventory.
- **I8:** If the last block gets placed, it will disappear from the inventory and deselected as the current tool.
- **I9:** Block Rules:
  - Water:
    - Water can be collected, increasing its count in the inventory, but the Water block is never removed from the world when collected.
  - Ground:
    - Ground can be placed directly on Water.
    - When Ground is collected, a Water block appears in its place.
    - When Ground is placed, it replaces a Water block.
  - Grass:
    - Grass always sits on top of Ground.
    - When Grass is collected, a Ground block appears in its place.
    - When Grass is placed, it replaces a Ground block.
  - Snow:
    - Snow always sits on top of Ground.
    - When Snow is collected, a Ground block appears in its place.
    - When Snow is placed, it replaces a Ground block.
  - Sand:
    - Sand can be placed directly on Water.
    - When Sand is collected, a Water block appears in its place.
    - When Sand is placed, it replaces a Water block.
  - All Other Blocks:
    - All other blocks, when collected, are replaced by Water.

### Design Concepts

- **Inventory UI:** The HUD displays all inventory slots, stack counts, and highlights the selected block type.
- **Block Selection:** The player can select which block type to place using the HUD (e.g., by tapping/clicking a slot).
- **Placement/Collection Logic:**
	- Collecting a block checks for available inventory space/stack.
	- Placing a block checks for at least one of the selected block type.
	- Both actions update the inventory and HUD immediately.
- **Edge Cases:**
	- If the inventory is full, block collection won't increase the count.
	- If the player has no blocks of the selected type, placement is prevented.

### Example Interaction Flow

- **Collect Block:**
	1. Player tap+holds/click+holds a block for 2s.
	2. If inventory, block is collected and added to the correct stack.
	3. If inventory is full, count won't increase.
- **Place Block:**
	1. Player taps/clicks a block within range.
	2. If player has at least one of the selected block type, block is placed and removed from inventory.
	3. If not, placement is canceled.

### Summary Table

| Action           | Condition                                 | Result/Feedback                  |
|------------------|-------------------------------------------|----------------------------------|
| Collect block    | Inventory space available                 | Block added to inventory         |
| Collect block    | Inventory full/stack full                 | Inventory count is not increased |
| Place block      | Has block of selected type                | Block placed, inventory -1       |
| Place block      | No block of selected type                 | Placement canceled               |
| Select block     | Tap/click inventory slot                  | Block type selected              |
| Inventory update | Block placed/collected                    | HUD updates immediately          |
