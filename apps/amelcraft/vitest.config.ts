import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node", // logic tests (no DOM / Phaser rendering needed)
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
    coverage: {
      enabled: false,
    },
  },
});
