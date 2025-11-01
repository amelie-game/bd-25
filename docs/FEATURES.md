# Features

## Player Movement

- The player can select "Moving" mode via the HUD.
- While in Moving mode, pressing and holding the mouse button or touch pointer causes the PC to walk toward the pointer, following it as long as it is pressed.
- If the player moves the mouse/pointer while it's being pressed, the PC will change its course and walk towards the new destination
- The PC cannot walk onto invalid terrain:
  - Water Blocks
- No tile highlighting occurs in this mode.
- The camera follows the PC, maintaining visibility and recentering if the PC nears the edge.
- Zooming is available via scroll wheel (mouse) or pinch (touch), always centering on the PC.

## Inventory

- The player has an inventory with all collected Blocks and their count.
- A special, non-placeable, non-craftable flag `hasPresent` may be set (e.g. from an event or reward). It is persisted but does not appear in block/object lists and cannot be consumed.

## Block Collection

- The player can select "Collecting" mode via the HUD (Pickaxe icon).
- In Collecting mode, hovering or pressing down on a block highlights it.
- There is no distance limitation for starting collection; the PC will walk to the block if not adjacent.
- The PC always turns to face the selected block before collecting.
- The collecting process uses a 2-second progress bar; if interrupted, the process is canceled.
- Collection follows inventory rules: blocks are added if space is available, and replaced in the world according to block type rules:
  - Water:
    - Water can be collected, increasing its count in the inventory, but the Water block is never removed from the world when collected.
  - Ground:
    - When Ground is collected, a Water block appears in its place.
  - Grass:
    - Grass always sits on top of Ground.
    - When Grass is collected, a Ground block appears in its place.
  - Snow:
    - Snow always sits on top of Ground.
    - When Snow is collected, a Ground block appears in its place.
  - Sand:
    - When Sand is collected, a Water block appears in its place.
  - All Other Blocks:
    - All other blocks, when collected, are replaced by Water Blocks.

## Block Placement

- The player can select "Placing" mode via the HUD dropdown (block selection).
- In Placing mode, hovering a tile highlights it.
- There is no distance limitation for placing; the PC will walk to the tile if not adjacent.
- The PC always turns to face the selected tile before placing the block.
- Placement is only possible if the player has at least one of the selected block type in inventory.
- Placement decreases the inventory count for the placed block by 1.

## HUD

- The HUD is placed at the bottom center of the view
- It contains 3 toggleable Buttons: Moving, Block Placement, Block Collection
- Moving:
  - When toggled, the Moving mode is activated
  - Has a fitting monochrome Icon
- Block Placement:
  - Will show the Block Inventory, when toggled and set the Block Placement mode active
  - The Inventory shows every Block in the inventory with count > 0 and their current count in a Badge
  - The count will immdiately updated, when the inventory updates
  - The selected Block is used as the Graphic for the Block Placement toggle Button
- Block Collection:
  - When toggled, the Block Collecting mode is activated
  - Has a monchrome pickaxe Icon