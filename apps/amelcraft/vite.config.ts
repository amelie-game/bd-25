import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: process.env.NODE_ENV === "production" ? "/bd-25/" : "/",
  build: {
    outDir: "dist",
  },
});
