# Architectural Styles in Game Development

This document explores multiple architectural styles for game development, as discussed in the context of a Phaser.js project. We provide an overview of each, sample implementations based on a simple tile-based game (with animation and hit detection), and a critical evaluation of their benefits and drawbacks.

## Overview

### Quick Comparison of Architecture Styles

| Style                        | Core Focus / Principle              | Strengths                                              | Drawbacks / When to Avoid                |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Japanese Software Philosophy | Simplicity, clarity, Kaizen         | Minimal, readable, easy to refactor, fast to prototype | Can get messy as complexity grows        |
| Hexagonal Architecture       | Separation of concerns, testability | Decoupled, testable, flexible, scalable                | Boilerplate, overkill for small games    |
| ECS                          | Composition over inheritance        | Highly flexible, reusable, efficient for many objects  | Verbose, harder to debug, overkill small |
| MVC                          | UI/data/input separation            | Clear roles, easy to test UI/logic separately          | Verbose, not always natural for games    |
| Event-Driven / Observer      | Decoupled event notification        | Flexible, extensible, easy to add features             | Can be hard to trace/debug, memory leaks |

**Summary:**
- For small, rapidly evolving games, Japanese style or MVC can be ideal.
- For large, complex, or long-lived games, Hexagonal or ECS offer better scalability and maintainability.
- Event-driven/Observer is best for decoupling and extensibility, but can add complexity if overused.

## Japanese Software Philosophy: Sample & Evaluation

- **Focus:** Code as craftsmanship, simplicity, clarity, and continuous small improvements (Kaizen).
- **Benefits:**
  - Highly maintainable and readable code.
  - Minimal ceremony and abstraction; only extract when needed.
  - Emphasizes bug prevention and immediate fixes.
  - Evolves codebase gradually, avoiding speculative design.
- **What it solves:**
  - Reduces over-engineering and unnecessary complexity.
  - Keeps codebase approachable and easy to refactor.

### Sample Implementation (Minimalist, In-Scene Model)

```ts
import Phaser from "phaser";

export class MainScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;

  preload() {
    this.load.spritesheet("player", "player.png", {
      frameWidth: 32,
      frameHeight: 48,
    });
    this.load.image("rock", "rock.png");
  }

  create() {
    // Player sprite with physics
    this.player = this.physics.add.sprite(100, 100, "player");
    this.player.setCollideWorldBounds(true);

    // Define player walking animations
    this.anims.create({
      key: "walk-left",
      frames: this.anims.generateFrameNumbers("player", { start: 9, end: 11 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-right",
      frames: this.anims.generateFrameNumbers("player", { start: 6, end: 8 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-up",
      frames: this.anims.generateFrameNumbers("player", { start: 3, end: 5 }),
      frameRate: 10,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-down",
      frames: this.anims.generateFrameNumbers("player", { start: 0, end: 2 }),
      frameRate: 10,
      repeat: -1,
    });

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();

    // Add obstacles (e.g., rocks)
    this.obstacles = this.physics.add.staticGroup();
    this.obstacles.create(200, 100, "rock");
    this.obstacles.create(300, 150, "rock");

    // Collision detection
    this.physics.add.collider(this.player, this.obstacles);
  }

  update() {
    const speed = 100;
    const velocity = { x: 0, y: 0 };

    if (this.cursors.left?.isDown) {
      velocity.x = -speed;
      this.player.anims.play("walk-left", true);
    } else if (this.cursors.right?.isDown) {
      velocity.x = speed;
      this.player.anims.play("walk-right", true);
    } else if (this.cursors.up?.isDown) {
      velocity.y = -speed;
      this.player.anims.play("walk-up", true);
    } else if (this.cursors.down?.isDown) {
      velocity.y = speed;
      this.player.anims.play("walk-down", true);
    } else {
      this.player.setVelocity(0, 0);
      return;
    }

    this.player.setVelocity(velocity.x, velocity.y);
  }
}
```

### Critical Evaluation
- **Benefits:**
  - Extremely clear and easy to follow; all logic is in one place.
  - No unnecessary abstractions or indirection.
  - Easy to refactor as requirements change.
  - Fast to prototype and iterate.
- **Drawbacks:**
  - As the game grows (e.g., more input types, more entities, inventory, tile placement), the scene can become bloated and harder to maintain.
  - Harder to test logic in isolation (e.g., movement, collision) without running the full game.
  - Tightly coupled to Phaser; porting to another engine or platform would require significant rewrites.

---

## Hexagonal Architecture: Sample & Evaluation

- **Focus:** Clear separation of concerns, decoupling domain logic from frameworks and external systems.
- **Benefits:**
  - Highly testable and flexible codebase.
  - Easy to swap out frameworks, input methods, or rendering engines.
  - Scales well for large, complex, or long-lived projects.
- **What it solves:**
  - Prevents framework lock-in and tangled dependencies.
  - Enables robust testing and modularity.

### Sample Implementation (Ports & Adapters, Modularized, Improved Separation)

```ts
// domain/Player.ts
export class Player {
  x: number = 100;
  y: number = 100;
  lastDirection: { dx: number; dy: number } = { dx: 0, dy: 1 };
  move(dx: number, dy: number) {
    if (dx !== 0 || dy !== 0) {
      this.lastDirection = { dx, dy };
    }
    this.x += dx;
    this.y += dy;
  }
}

// ports/RendererPort.ts
export interface RendererPort {
  drawPlayer(x: number, y: number, anim: string): void;
}

// ports/InputPort.ts
export interface InputPort {
  getDirection(): { dx: number; dy: number };
}

// adapters/PhaserRenderer.ts
import { RendererPort } from "../ports/RendererPort";
import Phaser from "phaser";

export class PhaserRenderer implements RendererPort {
  constructor(private scene: Phaser.Scene, private sprite: Phaser.GameObjects.Sprite) {}
  drawPlayer(x: number, y: number, anim: string) {
    this.sprite.setPosition(x, y);
    this.sprite.anims.play(anim, true);
  }
}

// adapters/KeyboardInput.ts
import { InputPort } from "../ports/InputPort";
import Phaser from "phaser";

export class KeyboardInput implements InputPort {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  constructor(scene: Phaser.Scene) {
    this.cursors = scene.input.keyboard.createCursorKeys();
  }
  getDirection() {
    if (this.cursors.left?.isDown) return { dx: -1, dy: 0 };
    if (this.cursors.right?.isDown) return { dx: 1, dy: 0 };
    if (this.cursors.up?.isDown) return { dx: 0, dy: -1 };
    if (this.cursors.down?.isDown) return { dx: 0, dy: 1 };
    return { dx: 0, dy: 0 };
  }
}

// application/GameLoop.ts
import { Player } from "../domain/Player";
import { RendererPort } from "../ports/RendererPort";
import { InputPort } from "../ports/InputPort";

function getAnimationKey(dx: number, dy: number, lastDirection: { dx: number; dy: number }): string {
  if (dx === 0 && dy === 0) {
    // Idle animation based on last direction
    if (lastDirection.dx === -1) return "idle-left";
    if (lastDirection.dx === 1) return "idle-right";
    if (lastDirection.dy === -1) return "idle-up";
    return "idle-down";
  }
  if (dx === -1) return "walk-left";
  if (dx === 1) return "walk-right";
  if (dy === -1) return "walk-up";
  if (dy === 1) return "walk-down";
  return "idle-down";
}

export class GameLoop {
  constructor(
    private player: Player,
    private renderer: RendererPort,
    private input: InputPort
  ) {}
  update() {
    const { dx, dy } = this.input.getDirection();
    this.player.move(dx, dy);
    const anim = getAnimationKey(dx, dy, this.player.lastDirection);
    this.renderer.drawPlayer(this.player.x, this.player.y, anim);
  }
}

// scenes/MainScene.ts
import Phaser from "phaser";
import { Player } from "../domain/Player";
import { PhaserRenderer } from "../adapters/PhaserRenderer";
import { KeyboardInput } from "../adapters/KeyboardInput";
import { GameLoop } from "../application/GameLoop";

export class MainScene extends Phaser.Scene {
  private gameLoop!: GameLoop;
  private playerSprite!: Phaser.GameObjects.Sprite;

  preload() {
    this.load.spritesheet("player", "player.png", { frameWidth: 32, frameHeight: 48 });
    this.load.image("rock", "rock.png");
  }

  create() {
    this.playerSprite = this.physics.add.sprite(100, 100, "player");
    this.playerSprite.setCollideWorldBounds(true);
    // ...obstacle setup and collision as before...
    const player = new Player();
    const renderer = new PhaserRenderer(this, this.playerSprite);
    const input = new KeyboardInput(this);
    this.gameLoop = new GameLoop(player, renderer, input);
  }

  update() {
    this.gameLoop.update();
  }
}
```


### Critical Evaluation
- **Benefits:**
  - Clear separation of concerns: input, domain logic, and animation/presentation are modular and testable.
  - Animation selection is decoupled from input, following best practices.
  - Easy to extend (e.g., add AI, new input types, or swap out rendering engine).
  - Domain logic is decoupled from Phaser, making porting and testing easier.
- **Drawbacks:**
  - More boilerplate and indirection, especially for small/simple games.
  - Can feel over-engineered if the game remains simple.
  - Slightly slower to prototype and iterate due to extra layers.

---

## Entity-Component-System (ECS): Sample & Evaluation

- **Focus:** Composition over inheritance; entities are composed of reusable components, and systems operate on entities with specific components.
- **Benefits:**
  - Highly flexible and extensible; new behaviors are added by composing components.
  - Efficient for games with many similar objects (e.g., tile-based, simulation, or action games).
  - Decouples data (components) from behavior (systems).
- **What it solves:**
  - Avoids deep inheritance hierarchies and promotes code reuse.
  - Makes it easy to add, remove, or modify behaviors at runtime.

### Sample Implementation (Simplified ECS)

```ts
// Entity, Component, and System base types
type Entity = number;
interface Component {}
interface System {
  update(entities: Entity[], components: Map<string, Map<Entity, Component>>): void;
}

// Components
interface Position extends Component { x: number; y: number; }
interface Velocity extends Component { dx: number; dy: number; }
interface Sprite extends Component { key: string; }
interface Collider extends Component {}

// Example systems
class MovementSystem implements System {
  update(entities, components) {
    const positions = components.get('Position')!;
    const velocities = components.get('Velocity')!;
    for (const entity of entities) {
      const pos = positions.get(entity) as Position;
      const vel = velocities.get(entity) as Velocity;
      if (pos && vel) {
        pos.x += vel.dx;
        pos.y += vel.dy;
      }
    }
  }
}

class AnimationSystem implements System {
  update(entities, components) {
    // ...set animation based on velocity or state...
  }
}

class CollisionSystem implements System {
  update(entities, components) {
    // ...detect and handle collisions between entities with Collider...
  }
}

// Usage: create entities, add components, run systems in a loop
```

### Critical Evaluation
- **Benefits:**
  - Extremely flexible; new behaviors are added by composing components and systems.
  - Efficient for games with many similar objects (e.g., tiles, enemies, projectiles).
  - Decouples data and behavior, making code reusable and testable.
- **Drawbacks:**
  - Can be overkill for small/simple games.
  - More boilerplate and indirection; debugging can be harder.
  - Requires careful management of component data and system order.

---

## Model-View-Controller (MVC): Sample & Evaluation

- **Focus:** Separates application logic (model), user interface (view), and input handling (controller).
- **Benefits:**
  - Clear separation of concerns; UI and logic can evolve independently.
  - Multiple views can represent the same model.
  - Well-suited for UI-heavy or tool-driven games.
- **What it solves:**
  - Keeps UI code and business/game logic separate.
  - Makes it easier to test and maintain code.

### Sample Implementation (MVC)

```ts
// Model
class PlayerModel {
  x = 100;
  y = 100;
  move(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }
}

// View
class PlayerView {
  constructor(private sprite: Phaser.GameObjects.Sprite) {}
  render(x: number, y: number, anim: string) {
    this.sprite.setPosition(x, y);
    this.sprite.anims.play(anim, true);
  }
}

// Controller
class PlayerController {
  constructor(private model: PlayerModel, private view: PlayerView, private cursors: Phaser.Types.Input.Keyboard.CursorKeys) {}
  update() {
    let dx = 0, dy = 0, anim = 'idle-down';
    if (this.cursors.left?.isDown) { dx = -1; anim = 'walk-left'; }
    else if (this.cursors.right?.isDown) { dx = 1; anim = 'walk-right'; }
    else if (this.cursors.up?.isDown) { dy = -1; anim = 'walk-up'; }
    else if (this.cursors.down?.isDown) { dy = 1; anim = 'walk-down'; }
    this.model.move(dx, dy);
    this.view.render(this.model.x, this.model.y, anim);
  }
}
```

### Critical Evaluation
- **Benefits:**
  - Clear separation of data, presentation, and input logic.
  - Easy to swap out or test views and controllers independently.
  - Well-suited for games/tools with complex UI or multiple representations of state.
- **Drawbacks:**
  - Can be verbose for simple games.
  - May require extra glue code to synchronize model and view.
  - Not always a natural fit for real-time, highly interactive games.

---

## Event-Driven / Observer Pattern: Sample & Evaluation

- **Focus:** Components communicate by emitting and listening for events; observer pattern enables one-to-many notification of state changes.
- **Benefits:**
  - Decouples components; emitters and listeners don’t need to know about each other.
  - Enables flexible, dynamic interactions and extensibility.
  - Well-suited for UI, input, and game state changes.
- **What it solves:**
  - Reduces tight coupling between systems.
  - Makes it easy to add new reactions to events without modifying existing code.

### Sample Implementation (Observer/Event-Driven)

```ts
// Subject (Observable)
class Player {
  private observers: ((event: string, data?: any) => void)[] = [];
  x = 100;
  y = 100;
  move(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
    this.notify('move', { x: this.x, y: this.y });
  }
  on(event: string, callback: (event: string, data?: any) => void) {
    this.observers.push(callback);
  }
  notify(event: string, data?: any) {
    for (const cb of this.observers) cb(event, data);
  }
}

// Observer (e.g., View)
class PlayerView {
  constructor(private sprite: Phaser.GameObjects.Sprite, player: Player) {
    player.on('move', (_, data) => {
      this.sprite.setPosition(data.x, data.y);
    });
  }
}

// Usage: player.move(dx, dy) triggers view update via event
```

### Critical Evaluation
- **Benefits:**
  - Decouples state changes from reactions; easy to add new listeners.
  - Flexible and extensible; new features can subscribe to events without modifying core logic.
  - Well-suited for UI, input, and game state changes.
- **Drawbacks:**
  - Can lead to hard-to-trace event chains and debugging challenges.
  - Risk of memory leaks if observers are not properly removed.
  - Overuse can make codebase harder to reason about.
