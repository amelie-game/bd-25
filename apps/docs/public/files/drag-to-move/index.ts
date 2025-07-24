// Dynamically load Phaser, then run the game code
function loadPhaserAndRun(main) {
  if (window.Phaser) return main();
  var script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.js";
  script.onload = main;
  document.head.appendChild(script);
}

// @ts-ignore: Phaser is loaded dynamically
declare var Phaser: any;
loadPhaserAndRun(function () {
  let player: any;
  let isDragging = false;
  let target: { x: number; y: number } | null = null;
  const moveSpeed = 248; // pixels per second (e.g., 96px = 1.5 tiles/sec if tile is 64px)
  // Animation frame rate calculation: higher moveSpeed = faster animation, but clamped to 4–12 fps
  const animFrameRate = Math.max(4, Math.min(12, Math.round(moveSpeed / 32)));

  function preload() {
    // Load the 'dude' sprite sheet (standard Phaser walking animation asset)
    this.load.spritesheet(
      "player",
      "https://labs.phaser.io/assets/sprites/dude.png",
      {
        frameWidth: 32,
        frameHeight: 48,
      }
    );
  }

  function create() {
    player = this.add.sprite(
      this.sys.game.config.width / 2,
      this.sys.game.config.height / 2,
      "player"
    );
    player.setScale(2);

    // Define walking and idle animations with dynamic frameRate
    this.anims.create({
      key: "left",
      frames: this.anims.generateFrameNumbers("player", { start: 0, end: 3 }),
      frameRate: animFrameRate,
      repeat: -1,
    });
    this.anims.create({
      key: "turn",
      frames: [{ key: "player", frame: 4 }],
      frameRate: Math.max(2, Math.round(animFrameRate * 2)),
    });
    this.anims.create({
      key: "right",
      frames: this.anims.generateFrameNumbers("player", { start: 5, end: 8 }),
      frameRate: animFrameRate,
      repeat: -1,
    });
    // Simulate up/down animations using left/right frames
    this.anims.create({
      key: "up",
      frames: this.anims.generateFrameNumbers("player", { start: 0, end: 3 }), // reuse left frames
      frameRate: animFrameRate,
      repeat: -1,
    });
    this.anims.create({
      key: "down",
      frames: this.anims.generateFrameNumbers("player", { start: 5, end: 8 }), // reuse right frames
      frameRate: animFrameRate,
      repeat: -1,
    });

    // Use the canvas element for pointer events for better reliability
    const canvas = this.sys.game.canvas;
    let pointerMoveHandler: ((ev: PointerEvent) => void) | null = null;
    let pointerUpHandler: (() => void) | null = null;

    canvas.addEventListener("pointerdown", (e) => {
      isDragging = true;
      target = { x: e.offsetX, y: e.offsetY };

      pointerMoveHandler = (ev: PointerEvent) => {
        if (isDragging) {
          target = { x: ev.offsetX, y: ev.offsetY };
        }
      };
      canvas.addEventListener("pointermove", pointerMoveHandler);

      pointerUpHandler = () => {
        isDragging = false;
        target = null;
        if (pointerMoveHandler)
          canvas.removeEventListener("pointermove", pointerMoveHandler);
        if (pointerUpHandler)
          canvas.removeEventListener("pointerup", pointerUpHandler);
      };
      canvas.addEventListener("pointerup", pointerUpHandler);
    });
  }

  function update(time: number, delta: number) {
    if (isDragging && target) {
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Calculate step based on moveSpeed (pixels/sec) and delta (ms)
      const step = moveSpeed * (delta / 1000);
      const snapThreshold = 2; // pixels
      if (dist > snapThreshold) {
        player.x += (dx / dist) * Math.min(step, dist);
        player.y += (dy / dist) * Math.min(step, dist);
        // Play walking animation based on direction
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) {
            player.anims.play("left", true);
          } else {
            player.anims.play("right", true);
          }
        } else {
          if (dy < 0) {
            player.anims.play("up", true);
          } else {
            player.anims.play("down", true);
          }
        }
      } else {
        player.x = target.x;
        player.y = target.y;
        player.anims.play("turn"); // Idle frame
      }
    } else {
      // Not moving, idle
      if (player && player.anims) player.anims.play("turn");
    }
  }

  const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#87ceeb",
    parent: "game-container",
    scene: {
      preload,
      create,
      update,
    },
  };

  new Phaser.Game(config);
});
