type FrameKey = `${number}`;

export interface Frame {
  name: string;
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  duration: number;
}

export interface FrameTag {
  name: string;
  from: number; // Maps to FrameKey
  to: number; // Maps to FrameKey
  direction: string;
}

export interface Meta {
  app: string;
  version: string;
  image: string;
  format: string;
  size: { w: number; h: number };
  scale: `${number}`;
  frameTags: FrameTag[];
}

export interface Aesprite {
  frames: {
    [key: FrameKey]: Frame;
  };
  meta: Meta;
}
