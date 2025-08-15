export type TreeNode = {
  name: string;
  slug?: string;
  title?: string;
  children: TreeNode[];
};
