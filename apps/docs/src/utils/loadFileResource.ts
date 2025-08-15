import { pathToFileURL } from "node:url";
import * as path from "node:path";
import type {
  FileContent,
  FilePath,
  RemoteUrl,
  FileResource,
} from "@/src/types/FileResource";
import { PATH_APP_TO_REPO_ROOT } from "@/src/environment";

export async function loadFileResource(
  resource: FileResource
): Promise<string> {
  if (isFileContent(resource)) return resource;

  if (isFilePath(resource)) {
    // Remove leading slash to make it relative to project root

    const relPath = resource.pathname.startsWith("/")
      ? resource.pathname.slice(1)
      : resource.pathname;
    // Go up one directory from app-template to repo root
    const repoRoot = path.resolve(process.cwd(), PATH_APP_TO_REPO_ROOT);
    const absPath = path.resolve(repoRoot, relPath);
    const fileUrl = pathToFileURL(absPath);

    const fs = await import("fs/promises");
    return await fs.readFile(fileUrl, "utf-8");
  }

  if (isRemoteUrl(resource)) {
    const res = await fetch(resource);
    return await res.text();
  }
  throw new Error(`Unknown file resource: ${resource}`);
}

function isFileContent(resource: unknown): resource is FileContent {
  return typeof resource === "string";
}

function isFilePath(resource: unknown): resource is FilePath {
  return resource instanceof URL && resource.protocol === "file:";
}

function isRemoteUrl(resource: unknown): resource is RemoteUrl {
  return (
    resource instanceof URL &&
    (resource.protocol === "http:" || resource.protocol === "https:")
  );
}
