/// <reference types="vite/client" />

declare module "*.mdx" {
  const component: React.ComponentType;
  export default component;
  export const frontmatter: Record<string, any>;
}
