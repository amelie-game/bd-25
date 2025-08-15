import type { CollectionEntry } from "astro:content";

export type Doc = Pick<CollectionEntry<"docs">, "id" | "filePath"> & {
  data: Pick<CollectionEntry<"docs">["data"], "title">;
};
