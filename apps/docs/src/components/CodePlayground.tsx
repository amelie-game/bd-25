import React from "react";
import { Sandpack } from "@codesandbox/sandpack-react";
import { useTheme } from "../contexts/ThemeContext";

// Helper to fetch file content at runtime, with validation
// Helper to fetch file content at runtime, resolving relative to MDX file location
async function fetchFileContent(
  relativePath: string,
  mdxFilePath?: string
): Promise<string | undefined> {
  let cleanPath = relativePath.replace(/^\.\//, "").replace(/^\//, "");
  // Prepend base path for static asset fetches
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  // Ensure no double slashes
  const publicPath = `${baseUrl.replace(/\/$/, "")}/${cleanPath}`;
  try {
    let res = await fetch(publicPath);
    if (res.ok) {
      const text = await res.text();
      if (text.includes("404") && text.length < 512) {
        return undefined;
      }
      return text;
    }
  } catch (e) {
    // Ignore fetch errors
  }
  return undefined;
}

interface CodePlaygroundProps {
  children?: React.ReactNode;
  className?: string;
  template?: string;
  files?: Record<string, string>;
  options?: any;
}

export function CodePlayground({
  children,
  className,
  template,
  files,
  options = {},
  ...props
}: CodePlaygroundProps) {
  const { theme } = useTheme();

  // Determine Sandpack theme based on current theme
  const sandpackTheme = theme === "dark" ? "dark" : "light";

  // If files prop is provided, support file content or relative path
  const [resolvedFiles, setResolvedFiles] = React.useState<Record<
    string,
    string
  > | null>(null);

  React.useEffect(() => {
    if (!files) return;
    let isMounted = true;
    const resolveAllFiles = async () => {
      const result: Record<string, string> = {};
      // Helper to recursively load dependencies

      async function loadFileWithDeps(
        fileName: string,
        value: string,
        loaded: Record<string, string>,
        mdxFilePath?: string
      ) {
        // Heuristic: treat as file path if it ends with a known extension and does not contain newlines
        const isFilePath = /^[^\n]+\.[a-zA-Z0-9]+$/.test(value.trim());
        if (isFilePath) {
          // Always fetch file content for file paths, relative to MDX file
          const content = await fetchFileContent(value);
          const code =
            content !== undefined
              ? content
              : `// File not found or could not be loaded: ${value}`;
          loaded[fileName] = code;
          // Scan for import statements (simple regex)
          const importRegex = /import\s+[^'"\n]+['"](.+?)['"]/g;
          let match;
          while ((match = importRegex.exec(code))) {
            let depPath = match[1];
            // Only handle relative imports
            if (depPath.startsWith("./") || depPath.startsWith("../")) {
              // Normalize to Sandpack file system
              let depFileName = depPath.startsWith("./")
                ? depPath.replace("./", "/")
                : depPath;
              if (!loaded[depFileName]) {
                // Try to fetch dependency
                const depContent = await fetchFileContent(depPath, mdxFilePath);
                if (depContent !== undefined) {
                  loaded[depFileName] = depContent;
                  // Recursively load dependencies
                  await loadFileWithDeps(
                    depFileName,
                    depPath,
                    loaded,
                    mdxFilePath
                  );
                }
              }
            }
          }
        } else {
          // Direct code, do not scan for imports
          loaded[fileName] = value;
        }
      }

      // Try to get MDX file path from options (if provided)
      const mdxFilePath = options?.mdxFilePath;
      const loadedFiles: Record<string, string> = {};
      await Promise.all(
        Object.entries(files).map(async ([fileName, value]) => {
          await loadFileWithDeps(fileName, value, loadedFiles, mdxFilePath);
        })
      );
      if (isMounted) setResolvedFiles(loadedFiles);
    };
    resolveAllFiles();
    return () => {
      isMounted = false;
    };
  }, [files]);

  if (files) {
    if (!resolvedFiles) {
      // Loading state
      return <div className="code-playground">Loading code...</div>;
    }
    // Detect if all files are unsupported types (e.g., .txt, .md, .json)
    const supportedExtensions = [
      "js",
      "ts",
      "tsx",
      "jsx",
      "html",
      "css",
      "json",
    ];
    const allUnsupported = Object.keys(resolvedFiles).every((fileName) => {
      const ext = fileName.split(".").pop()?.toLowerCase();
      return ext && !supportedExtensions.includes(ext);
    });
    if (allUnsupported) {
      // Show raw content for the first file
      const firstFile = Object.keys(resolvedFiles)[0];
      return (
        <div className="code-playground">
          <pre
            style={{
              background: sandpackTheme === "dark" ? "#222" : "#f5f5f5",
              color: sandpackTheme === "dark" ? "#eee" : "#222",
              padding: 16,
              borderRadius: 8,
              overflowX: "auto",
              minHeight: options.editorHeight || 200,
            }}
          >
            {resolvedFiles[firstFile]}
          </pre>
        </div>
      );
    }
    // Otherwise, use Sandpack as usual
    return (
      <div className="code-playground">
        <Sandpack
          template={template as any}
          files={resolvedFiles}
          options={{
            showNavigator: false,
            showTabs: true,
            showLineNumbers: true,
            showInlineErrors: true,
            wrapContent: true,
            editorHeight: 350,
            ...options,
          }}
          theme={sandpackTheme}
        />
      </div>
    );
  }

  // Check if this is a code block that should be interactive
  const isInteractive =
    className?.includes("language-tsx") || className?.includes("language-ts");

  if (!isInteractive) {
    return (
      <pre className={className} {...props}>
        {children}
      </pre>
    );
  }

  // Extract code from children
  const code = React.Children.toArray(children)
    .map((child) => {
      if (typeof child === "string") return child;
      if (React.isValidElement(child) && child.props.children) {
        return typeof child.props.children === "string"
          ? child.props.children
          : "";
      }
      return "";
    })
    .join("");

  return (
    <div className="code-playground">
      <Sandpack
        template="react-ts"
        files={{
          "/App.tsx": code,
        }}
        options={{
          showNavigator: false,
          showTabs: false,
          showLineNumbers: true,
          showInlineErrors: true,
          wrapContent: true,
          editorHeight: 350,
        }}
        theme={sandpackTheme}
      />
    </div>
  );
}
