export declare class HUD {
  constructor(args: {
    parent: HTMLElement;
    blockKeys: { key: string; value: number }[];
    onSelect: (value: number | "dig") => void;
    initial?: number | "dig";
    getBlockCount: (key: string) => number;
  });
  getSelected(): number | "dig";
  destroy(): void;
}
