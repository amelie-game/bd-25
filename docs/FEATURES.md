# Features

## Player Movement

- The player can select "Moving" mode via the HUD.
- While in Moving mode, pressing and holding the mouse button or touch pointer causes the PC to walk toward the pointer, following it as long as it is pressed.
- The PC cannot walk onto invalid terrain (e.g., Water blocks).
- No tile highlighting occurs in this mode.
- The camera follows the PC, maintaining visibility and recentering if the PC nears the edge.
- Zooming is available via scroll wheel (mouse) or pinch (touch), always centering on the PC.

## Block Collection

- The player can select "Collecting" mode via the HUD (Pickaxe icon).
- In Collecting mode, hovering or pressing down on a block highlights it.
- There is no distance limitation for starting collection; the PC will walk to the block if not adjacent.
- The PC always turns to face the selected block before collecting.
- The collecting process uses a 2-second progress bar; if interrupted, the process is canceled.
- Collection follows inventory rules: blocks are added if space is available, and replaced in the world according to block type rules.

## Block Placement

- The player can select "Placing" mode via the HUD dropdown (block selection).
- In Placing mode, hovering a tile highlights it.
- There is no distance limitation for placing; the PC will walk to the tile if not adjacent.
- The PC always turns to face the selected tile before placing the block.
- Placement is only possible if the player has at least one of the selected block type in inventory.
- Placement follows inventory and block replacement rules, updating the HUD immediately.
