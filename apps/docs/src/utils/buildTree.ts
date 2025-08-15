import { DOCS_DIR } from "../environment";
import type { Doc } from "../types/Doc";
import type { TreeNode } from "../types/TreeNode";

const skippedPathParts = ["", ".."];
export const ROOT_NAME = "__ROOT__";

export function buildTree(docs: Doc[]): TreeNode {
  const root: TreeNode = { name: ROOT_NAME, children: [] };

  for (const doc of docs) {
    if (!doc.filePath) continue;

    const parts = doc.filePath
      .split("/")
      .filter((part) => !skippedPathParts.includes(part));

    let node = root;

    parts.forEach((part: string, idx: number) => {
      let child = node.children.find((c) => c.name === part);

      if (!child) {
        const title = idx === parts.length - 1 ? part : part.replace(/-/g, " ");

        child = {
          name: part,
          slug: idx === parts.length - 1 ? doc.id : undefined,
          title,
          children: [],
        };

        node.children.push(child);
      }

      node = child;
    });
  }

  normalize(root);
  sort(root);

  if (root.name === ROOT_NAME) {
    root.name = DOCS_DIR;
    root.title = DOCS_DIR;
  }

  return root;
}

function normalize(node: TreeNode, parent?: TreeNode) {
  // node represents a file
  if (typeof node.slug === "string") return;

  let parentForChildren = node;

  if (parent && parent.children.length === 1) {
    parentForChildren = parent;

    parentForChildren.title =
      parent.name === ROOT_NAME ? node.title : `${parent.title}/${node.title}`;
    parentForChildren.name =
      parent.name === ROOT_NAME ? node.name : `${parent.name}/${node.name}`;
    parentForChildren.slug = node.slug;
    parentForChildren.children = node.children;
  }

  parentForChildren.children.forEach((child) =>
    normalize(child, parentForChildren)
  );
}

function sort(node: TreeNode) {
  node.children.sort((a, b) => {
    const aDir = a.children.length > 0;
    const bDir = b.children.length > 0;
    if (aDir && !bDir) return -1;
    if (!aDir && bDir) return 1;
    return (a.title || a.name).localeCompare(b.title || b.name);
  });

  node.children.forEach(sort);
}
