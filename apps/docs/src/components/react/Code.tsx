import {
  Sandpack,
  SANDBOX_TEMPLATES,
  type SandpackInternal,
} from "@codesandbox/sandpack-react";
import { useTheme } from "./useTheme";

type AppType = keyof typeof SANDBOX_TEMPLATES;

type AppTemplate = {
  [K in AppType]: {
    [key in K]: {
      [F in keyof (typeof SANDBOX_TEMPLATES)[K]["files"]]?: string;
    } & {
      [key: string]: string | undefined;
    };
  };
}[AppType];

type Options = Omit<
  Parameters<SandpackInternal>[0]["options"],
  "files" | "theme" | "template"
>;

export type Props = { src: AppTemplate } & Options;

export default function Code({ src, ...options }: Props) {
  const theme = useTheme();

  const template = Object.keys(src)[0] as AppType;
  const files = (src as Record<string, any>)[template];

  // You can now use the theme variable ("dark" or "light") as needed
  return (
    <Sandpack
      theme={theme}
      files={files}
      template={template === "NULL" ? undefined : template}
      options={options}
    />
  );
}
