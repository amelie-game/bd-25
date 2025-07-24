import { Routes, Route, Navigate } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { DocPage } from "./components/DocPage";
import { getDocuments } from "./lib/docs";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThemeToggle } from "./components/ThemeToggle";

import config from "../docs.config.json";

function App() {
  const documents = getDocuments();

  // Find the best default document: README or index files first, then fallback to first document
  const findDefaultDocument = (docs: ReturnType<typeof getDocuments>) => {
    if (docs.length === 0) return undefined;

    // Look for README.md(x) or index.md(x) files, prioritizing those closest to root
    const readmeOrIndex = docs
      .filter((doc) => {
        const filename = doc.slug.split("/").pop()?.toLowerCase() || "";
        const basename = filename.replace(/\.(mdx?|md)$/, "");
        return basename === "readme" || basename === "index";
      })
      .sort((a, b) => {
        // Sort by depth (fewer slashes = closer to root)
        const depthA = a.slug.split("/").length;
        const depthB = b.slug.split("/").length;
        if (depthA !== depthB) return depthA - depthB;

        // If same depth, prioritize README over index
        const nameA = a.slug.split("/").pop()?.toLowerCase() || "";
        const nameB = b.slug.split("/").pop()?.toLowerCase() || "";
        const basenameA = nameA.replace(/\.(mdx?|md)$/, "");
        const basenameB = nameB.replace(/\.(mdx?|md)$/, "");

        if (basenameA === "readme" && basenameB === "index") return -1;
        if (basenameA === "index" && basenameB === "readme") return 1;

        return 0;
      });

    // Return the best README/index file, or fall back to the first document
    return readmeOrIndex.length > 0 ? readmeOrIndex[0] : docs[0];
  };

  const firstDocument = findDefaultDocument(documents);

  // Derive route prefix from docsDir (use last segment or "docs" as fallback)
  const routePrefix = config.docsDir
    ? config.docsDir.split("/").filter(Boolean).pop() || "docs"
    : "docs";

  return (
    <ThemeProvider>
      <div className={`app ${documents.length === 1 ? "single-doc-mode" : ""}`}>
        {documents.length > 1 && <Navigation documents={documents} />}
        {documents.length === 1 && (
          <div className="floating-theme-toggle">
            <ThemeToggle />
          </div>
        )}
        <main className="main-content">
          <Routes>
            <Route
              path="/"
              element={
                firstDocument ? (
                  <Navigate
                    to={`/${routePrefix}/${firstDocument.slug}`}
                    replace
                  />
                ) : (
                  <div>No documents found</div>
                )
              }
            />
            <Route
              path={`/${routePrefix}/*`}
              element={
                <DocPage documents={documents} routePrefix={routePrefix} />
              }
            />
          </Routes>
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;
