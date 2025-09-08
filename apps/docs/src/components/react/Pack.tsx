import type {
  Atlas,
  AtlasFile,
  Frame,
  ImageFile,
  Pack,
  PackFile,
  SpritesheetFile,
} from "@/src/types/assets";
import { useEffect, useRef, useState, type PropsWithChildren } from "react";

export interface Props {
  data: Pack;
  basePath?: string;
}

export default function Pack({ data, basePath = "" }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2rem",
      }}
    >
      {data.files.map((file) => (
        <PackFile key={file.key} basePath={basePath} file={file} />
      ))}
    </div>
  );
}

function PackFile({ file, basePath }: { file: PackFile; basePath: string }) {
  const content = (() => {
    switch (file.type) {
      case "atlas":
        return (
          <Atlas
            atlasURL={withBasePath({ path: file.atlasURL, basePath })}
            textureURL={withBasePath({ path: file.textureURL!, basePath })}
          />
        );
      case "image":
        return <Image url={withBasePath({ path: file.url, basePath })} />;
      case "spritesheet":
        return (
          <SpriteSheet
            url={withBasePath({ path: file.url, basePath })}
            frameConfig={file.frameConfig}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div>
      <h3>{file.key}</h3>
      {content}
    </div>
  );
}

type Animation = {
  name: string;
  frames: Pick<Frame, "frame" | "duration">[];
  texture: HTMLImageElement;
};

type Sprite = Pick<Frame, "name" | "frame"> & { texture: HTMLImageElement };

function Atlas({
  atlasURL,
  textureURL,
}: Pick<AtlasFile, "atlasURL" | "textureURL">) {
  const [texture, setTexture] = useState<HTMLImageElement | null>(null);
  const [{ animations, sprites }, setState] = useState<{
    animations: Animation[];
    sprites: Sprite[];
  }>(() => ({
    animations: [],
    sprites: [],
  }));

  useEffect(() => {
    const img = new window.Image();

    img.onload = () => {
      setTexture(img);
    };

    img.src = textureURL;
  }, [textureURL]);

  useEffect(() => {
    if (!texture) return;

    (async () => {
      const atlas = (await (await fetch(atlasURL)).json()) as Atlas;

      const framesInAnimations = new Set<string>();

      const animations =
        atlas.meta.frameTags?.map((tag) => {
          const frames = Array.from(
            { length: tag.to + 1 - tag.from },
            (_, i) => {
              const frameKey = `${tag.from + i}`;

              framesInAnimations.add(frameKey);

              return atlas.frames[frameKey];
            }
          );

          return { name: tag.name, frames, texture };
        }) ?? [];

      const sprites = Object.entries(atlas.frames).reduce(
        (sprites, [frameKey, frame]) => {
          if (!framesInAnimations.has(frameKey)) {
            sprites.push({ ...frame, texture, name: frame.name ?? frameKey });
          }

          return sprites;
        },
        new Array<Sprite>()
      );

      setState({ animations, sprites });
    })();
  }, [atlasURL, texture]);

  return (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        flexDirection: "column",
      }}
    >
      {!!sprites.length && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <h4>Sprites</h4>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
              alignItems: "stretch",
              justifyContent: "stretch",
              justifyItems: "stretch",
              alignContent: "stretch",
            }}
          >
            {sprites.map((sprite) => (
              <Sprite key={sprite.name} {...sprite} />
            ))}
          </div>
        </div>
      )}

      {!!animations.length && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <h4>Animations</h4>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
              justifyItems: "stretch",
            }}
          >
            {animations?.map((animation) => (
              <Animation key={animation.name} {...animation} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Image({ url }: Pick<ImageFile, "url">) {
  return <img src={url} alt={url} />;
}

function Animation({ name, frames, texture }: Animation) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMountedRef = useRef(false);
  const frameIndex = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    const drawFrame = () => {
      if (!frames.length) return;

      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      if (!isMountedRef.current) return;

      const frame = frames[frameIndex.current];

      ctx.clearRect(0, 0, frame.frame.w, frame.frame.h);
      ctx.drawImage(
        texture,
        frame.frame.x,
        frame.frame.y,
        frame.frame.w,
        frame.frame.h,
        0,
        0,
        frame.frame.w,
        frame.frame.h
      );

      if (frames.length > 1) {
        frameIndex.current = (frameIndex.current + 1) % frames.length;
        timeoutRef.current = setTimeout(drawFrame, frame.duration);
      }
    };

    drawFrame();

    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  });

  if (!frames.length) return null;

  return (
    <Box title={name}>
      <canvas
        ref={canvasRef}
        title={name}
        width={frames[0].frame.w}
        height={frames[0].frame.h}
        style={{
          imageRendering: "pixelated",
          display: "block",
          background: "none",
        }}
      />
    </Box>
  );
}

function Sprite({ name, frame, texture }: Sprite) {
  return <Animation name={name} frames={[{ frame }]} texture={texture} />;
}

type SpriteSheet = Pick<SpritesheetFile, "frameConfig" | "url">;

function SpriteSheet({ frameConfig, url }: SpriteSheet) {
  const [{ sprites }, setState] = useState<{
    sprites: Sprite[];
  }>(() => ({
    sprites: [],
  }));

  useEffect(() => {
    const img = new window.Image();

    img.onload = () => {
      const { frameWidth, frameHeight, margin = 0, spacing = 0 } = frameConfig;
      const sheetWidth = img.naturalWidth; // intrinsic bitmap width
      const sheetHeight = img.naturalHeight; // intrinsic bitmap height

      // Compute how many columns & rows we can extract respecting margin & spacing
      const cols = Math.floor(
        (sheetWidth - margin + spacing) / (frameWidth + spacing)
      );
      const rows = Math.floor(
        (sheetHeight - margin + spacing) / (frameHeight + spacing)
      );

      const sprites: Sprite[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = margin + col * (frameWidth + spacing);
          const y = margin + row * (frameHeight + spacing);

          // Guard against partial tiles at the edge
          if (x + frameWidth <= sheetWidth && y + frameHeight <= sheetHeight) {
            sprites.push({
              name: `${row * cols + col}`,
              frame: { x, y, w: frameWidth, h: frameHeight },
              texture: img,
            });
          }
        }
      }

      setState({ sprites });
    };

    img.src = url;
  }, [url, frameConfig]);

  return (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        flexWrap: "wrap",
        alignItems: "stretch",
        justifyContent: "stretch",
        justifyItems: "stretch",
        alignContent: "stretch",
      }}
    >
      {sprites.map((sprite) => (
        <Sprite key={sprite.name} {...sprite} />
      ))}
    </div>
  );
}

function withBasePath({ path, basePath }: { path: string; basePath: string }) {
  // Ensure path starts without a leading slash to control joining
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const normalizedBase =
    basePath.endsWith("/") || basePath === "" ? basePath : basePath + "/";

  let full = `${normalizedBase}${normalizedPath}`;

  if (import.meta.env.PROD) {
    const prefix = "/bd-25";
    if (!full.startsWith(prefix + "/")) {
      full = prefix + (full.startsWith("/") ? "" : "/") + full;
    }
  }

  return full;
}

function Box({ children, title }: PropsWithChildren<{ title: string }>) {
  return (
    <div
      style={{
        border: "1px dotted rgb(48,54,61)",
        padding: "1rem",
        gap: "0.75rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <h5 style={{ margin: 0, color: "#aabbcc" }}>{title}</h5>
      {children}
    </div>
  );
}
