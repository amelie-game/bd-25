import React from "react";
import { useLocation } from "react-router-dom";
import { getDocumentBySlug } from "../lib/docs";

interface Document {
  slug: string;
  title: string;
  path: string;
  importer: () => Promise<any>;
  type: "md" | "mdx";
}

interface DocPageProps {
  documents: Document[];
  routePrefix: string;
}

export function DocPage({ documents, routePrefix }: DocPageProps) {
  const location = useLocation();

  // Extract slug from pathname, removing the base URL and docs directory prefix
  const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const relativePath = location.pathname;
  const pathParts = relativePath.split("/").filter(Boolean);
  // Use lastIndexOf to handle repeated routePrefix segments
  const prefixIndex = pathParts.lastIndexOf(routePrefix);
  // Slug is everything after the routePrefix
  const slug =
    prefixIndex !== -1 ? pathParts.slice(prefixIndex + 1).join("/") : "";

  if (!slug) {
    return <div>Document not found</div>;
  }

  const document = getDocumentBySlug(documents, slug);

  if (!document) {
    return <div>Document not found</div>;
  }

  // Lazy load the MDX/MD file using the importer
  const [Component, setComponent] = React.useState<React.ComponentType | null>(
    null
  );
  const [mdContent, setMdContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setComponent(null);
    setMdContent(null);
    if (document.type === "mdx") {
      document
        .importer()
        .then((mod) => {
          if (!cancelled) {
            setComponent(() => mod.default);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setLoading(false);
          }
        });
    } else if (document.type === "md") {
      document
        .importer()
        .then((mod) => {
          // Vite's import for .md returns the URL to the raw file
          const url = mod.default;
          return fetch(url)
            .then((res) => res.text())
            .then((raw) => {
              if (!cancelled) {
                // Use marked to parse markdown to HTML
                import("marked").then((mod) => {
                  // marked.parse can be sync or async, but we want the string result
                  const html =
                    typeof mod.marked.parse === "function"
                      ? mod.marked.parse(raw)
                      : mod.marked(raw);
                  if (typeof html === "string") {
                    setMdContent(html);
                    setLoading(false);
                  } else if (html instanceof Promise) {
                    html.then((str) => {
                      setMdContent(str);
                      setLoading(false);
                    });
                  }
                });
              }
            });
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setLoading(false);
          }
        });
    }
    return () => {
      cancelled = true;
    };
    // Only re-run when document changes
  }, [document]);

  if (loading) {
    return <div className="doc-content">Loading...</div>;
  }
  if (error) {
    return (
      <div className="doc-content">
        <h1>Error Loading Document</h1>
        <p>Failed to load: {document.title}</p>
        <details>
          <summary>Error Details</summary>
          <pre>{String(error)}</pre>
        </details>
      </div>
    );
  }
  if (document.type === "mdx") {
    if (!Component) {
      return <div className="doc-content">No content found.</div>;
    }
    return (
      <div className="doc-content">
        <Component />
      </div>
    );
  } else if (document.type === "md") {
    if (!mdContent) {
      return <div className="doc-content">No content found.</div>;
    }
    return (
      <div
        className="doc-content"
        dangerouslySetInnerHTML={{ __html: mdContent }}
      />
    );
  } else {
    return <div className="doc-content">Unknown document type.</div>;
  }
}
