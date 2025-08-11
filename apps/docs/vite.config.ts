import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mdx from "@mdx-js/rollup";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import rehypeHighlight from "rehype-highlight";

// __filename and __dirname must be declared before use
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the docs configuration early so we can use docsDir and appDir everywhere below
let docsDir = "docs";
let appDir = "app-template";

try {
  const config = JSON.parse(readFileSync("./docs.config.json", "utf8"));
  docsDir = config.docsDir || "docs";
  appDir = config.appDir || "app-template";
} catch (e) {
  console.error("Error reading docs.config.json:", e);
}

let invalidMdxFiles: string[] = [];
try {
  invalidMdxFiles = JSON.parse(
    readFileSync("./src/generated/invalidMdxFiles.json", "utf8")
  );
} catch (e) {
  console.error("Error reading invalidMdxFiles.json:", e);
}

const upLevels = appDir
  .split("/")
  .filter(Boolean)
  .map(() => "..");
const REPO_ROOT = resolve(__dirname, ...upLevels);
const repoAppAbsoluteInvalidMdxFiles = invalidMdxFiles.map((rel) =>
  resolve(REPO_ROOT, docsDir, rel)
);

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "./" : "/",
  plugins: [
    react(),
    mdx({
      jsxImportSource: "react",
      providerImportSource: "@mdx-js/react",
      development: process.env.NODE_ENV !== "production",
      // Include all MDX files in docs, filter at runtime
      include: "**/*.mdx",
      rehypePlugins: [rehypeHighlight],
      jsxRuntime: "automatic",
    }),
  ],
  build: {
    rollupOptions: {
      external: repoAppAbsoluteInvalidMdxFiles,
    },
  },
  assetsInclude: ["**/*.md"],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
    preserveSymlinks: true,
  },
  optimizeDeps: {
    include: ["@mdx-js/react", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
});
