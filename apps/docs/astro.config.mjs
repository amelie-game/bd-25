// @ts-check
import { defineConfig } from "astro/config";

import mdx from "@astrojs/mdx";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  base: process.env.NODE_ENV === "production" ? "/bd-25/" : "/",
  integrations: [mdx(), react()],
});
