// MDX validation and filtering script
// Usage: node scripts/mdx-validate.js

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

(async () => {
  const mdx = await import("@mdx-js/mdx");

  const DOCS_DIR = path.resolve(__dirname, "../src/docs");
  const GENERATED_DIR = path.resolve(__dirname, "../src/generated");
