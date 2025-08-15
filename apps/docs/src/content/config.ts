import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { DOCS_DIR, PATH_APP_TO_REPO_ROOT } from "@/src/environment";

const docs = defineCollection({
  loader: glob({
    pattern: [
      "**/*.{md,mdx}",
      "!**/node_modules/**/*",
      "!**/dist/**/*",
      "!**/src/**/*",
      "!**/.astro/**/*",
    ],
    base: `${PATH_APP_TO_REPO_ROOT}/${DOCS_DIR}`,
  }),
  schema: z.object({
    title: z.string().optional(),
    draft: z.boolean().optional(),
    // Add more fields as needed
  }),
});

export const collections = { docs };
