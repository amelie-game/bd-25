/**
 * Phaser 3 Pack File (LoaderPlugin.pack). Describes a batch of assets for loading.
 */
export interface Pack {
  files: PackFile[];
  /** Optional base URL applied to file URLs. */
  baseURL?: string;
  /** Optional default key prefix. */
  prefix?: string;
  /** Arbitrary metadata (not interpreted by Phaser). */
  meta?: Record<string, unknown>;
}

type AssetKey = string;

// Shared base for all entries
interface BasePackFile {
  type: string; // loader type identifier
  key: AssetKey; // cache key
  path?: string; // per-file path override
  prefix?: string; // per-file key prefix override
  loadOnce?: boolean; // load only if not already cached
  skipCache?: boolean; // don't cache result
  data?: unknown; // user data
  url?: string | string[] | never;
  atlasURL: string | never;
  textureURL?: string | never;
  frameConfig:
    | {
        frameWidth: number;
        frameHeight: number;
        startFrame?: number;
        endFrame?: number;
        margin?: number;
        spacing?: number;
      }
    | never;
}

export interface ImageFile extends BasePackFile {
  type: "image";
  url: string;
  normalMap?: string;
}

export interface AtlasFile extends BasePackFile {
  type: "atlas";
  textureURL: string; // PNG texture
  atlasURL: string; // JSON with frames
  normalMap?: string;
}

interface MultiAtlasFile extends BasePackFile {
  type: "multiatlas";
  url: string; // multi-atlas master JSON
  path?: string; // internal images path
}

interface AudioFile extends BasePackFile {
  type: "audio";
  url: string | string[]; // multiple extensions
}

export interface SpritesheetFile extends BasePackFile {
  type: "spritesheet";
  url: string;
  frameConfig: {
    frameWidth: number;
    frameHeight: number;
    startFrame?: number;
    endFrame?: number;
    margin?: number;
    spacing?: number;
  };
}

interface BitmapFontFile extends BasePackFile {
  type: "bitmapFont";
  url?: string; // combined
  textureURL?: string; // split
  fontDataURL?: string; // split
}

interface TilemapTiledJSONFile extends BasePackFile {
  type: "tilemapTiledJSON";
  url: string;
}

interface PluginFile extends BasePackFile {
  type: "plugin";
  url: string;
  start?: boolean;
  mapping?: string;
}

interface GenericPackFile extends BasePackFile {
  url: never;
  [extra: string]: unknown;
}

export type PackFile =
  | ImageFile
  | AtlasFile
  | MultiAtlasFile
  | AudioFile
  | SpritesheetFile
  | BitmapFontFile
  | TilemapTiledJSONFile
  | PluginFile
  | GenericPackFile;

export type MultiAtlas = Record<string, Atlas>;

type FrameKey = string;

export type Atlas = {
  /**
   * String you pass as the frame name when creating or changing textures (this.add.image(x, y, ASSET_KEY, FRAME_KEY))
   */
  frames: Record<FrameKey, Frame>;
  meta: Meta;
};

export interface Frame {
  name: string;
  /**
   * Rectangle inside the atlas image actually copied to the GPU quad.
   * These pixel coords define what portion of the texture is sampled.
   * Changing these changes what you see.
   */
  frame: { x: number; y: number; w: number; h: number };
  /**
   * Placement of the trimmed rectangle inside the original (untrimmed)
   * logical rectangle. (x,y) = offset relative to the original top-left.
   * Used to restore visual alignment if trimming occurred. For untrimmed
   * frames this matches (0,0,w,h).
   */
  spriteSourceSize?: { x: number; y: number; w: number; h: number };
  /**
   * The full original (untrimmed) dimensions. Useful for layout,
   * collision boxes, or if you later re-add padding.
   */
  sourceSize?: { w: number; h: number };
  /**
   * Normalized pivot (anchor) inside the untrimmed logical rectangle.
   * If Phaser uses the atlas pivot it sets the default origin.
   * A pivot of {0.5,0.5} centers; {0.5,1} bottom-center. If absent you
   * set origin manually (setOrigin).
   */
  pivot?: { x: number; y: number };
  /**
   * If true, the stored sub‑image was rotated 90° when packed.
   * Phaser (TexturePacker format) will internally rotate UVs back.
   * If false (typical for Aseprite export) nothing special happens.
   */
  rotated?: boolean;
  /**
   * true means transparent padding around the original sprite was removed.
   * Rendering then uses frame (the smaller box) but logical positioning can
   * still respect the original untrimmed bounds via spriteSourceSize/sourceSize.
   */
  trimmed?: boolean;
  /**
   * Frame display time for animations. Phaser’s Animation system ignores this in
   * plain atlas loading; you supply frameRate or duration when creating animations.
   * Useful if you build animations dynamically from the JSON.
   */
  duration?: number;
}

interface FrameTag {
  name: string;
  from: number; // Maps to `keyof frames`
  to: number; // Maps to `keyof frames`
  direction: string;
}

interface Meta {
  /**
   * Filename of the texture (PNG) this JSON describes. Loader combines this with frame rects.
   */
  image: string;
  /**
   * Dimensions of the whole atlas image; not used per draw, but sanity/meta info.
   */
  size: { w: number; h: number };
  /**
   * Pixel format string (e.g. RGBA8888). Informational; Phaser usually ignores it at runtime.
   */
  format?: string;
  /**
   * Indicates scale applied during export (string). Usually "1".
   * If not 1 you may need to adjust physics/layout.
   */
  scale?: `${number}` | number;
  /**
   * (Aseprite only) Defines animation ranges (from/to). Not consumed automatically by Phaser;
   * you translate them into Phaser animation configs.
   */
  frameTags?: FrameTag[];
  /**
   * Identifier (URL or name) of the tool that generated the atlas.
   * Useful for tooling audits or conditional logic.
   */
  app?: string;
  /**
   * Exporter/tool version. Lets you detect format shifts.
   */
  version?: string;
}
