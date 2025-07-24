import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle";
import config from "../../docs.config.json";

interface Document {
  slug: string;
  title: string;
  path: string;
}

interface NavigationProps {
  documents: Document[];
}

interface TreeNode {
  name: string;
  slug?: string;
  title?: string;
  children: TreeNode[];
  isExpanded?: boolean;
}

function buildDocumentTree(documents: Document[]): TreeNode {
  const root: TreeNode = { name: "root", children: [] };

  documents.forEach((doc) => {
    const parts = doc.slug.split("/").filter(Boolean);
    let currentNode = root;

    // Build the tree structure
    parts.forEach((part, index) => {
      let existingChild = currentNode.children.find(
        (child) => child.name === part
      );

      if (!existingChild) {
        const isLeaf = index === parts.length - 1;
        existingChild = {
          name: part,
          slug: isLeaf ? doc.slug : undefined, // Only leaf nodes have slugs
          title: isLeaf ? doc.title : part.replace(/-/g, " "),
          children: [],
          isExpanded: false,
        };
        currentNode.children.push(existingChild);
      }

      currentNode = existingChild;
    });
  });

  // Sort all children recursively: directories first, then files, both A-Z
  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => {
      const aIsDirectory = a.children.length > 0;
      const bIsDirectory = b.children.length > 0;

      // If one is directory and other is file, directory comes first
      if (aIsDirectory && !bIsDirectory) return -1;
      if (!aIsDirectory && bIsDirectory) return 1;

      // Both are same type, sort alphabetically by display name
      const aName = (a.title || a.name).toLowerCase();
      const bName = (b.title || b.name).toLowerCase();
      return aName.localeCompare(bName);
    });

    // Recursively sort children of each node
    node.children.forEach(sortChildren);
  };

  sortChildren(root);
  return root;
}

function TreeNodeComponent({
  node,
  depth = 0,
  routePrefix,
}: {
  node: TreeNode;
  depth?: number;
  routePrefix: string;
}) {
  const [isExpanded, setIsExpanded] = useState(depth === 0 || depth === 1);
  const location = useLocation();
  const hasChildren = node.children.length > 0;
  // Strip the base URL from pathname for comparison
  const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const relativePath = location.pathname.replace(baseUrl, "");
  const isActive = node.slug && relativePath === `/${routePrefix}/${node.slug}`;

  const toggleExpanded = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <li className="tree-node">
      <div className={`tree-node-content ${isActive ? "active" : ""}`}>
        {hasChildren ? (
          // Directory node - make the whole thing clickable to toggle
          <button
            className="tree-folder-toggle"
            onClick={toggleExpanded}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            aria-expanded={isExpanded}
          >
            <span className="tree-toggle-icon"></span>
            <span className="tree-folder-icon"></span>
            <span className="tree-folder-name">{node.title || node.name}</span>
          </button>
        ) : (
          // Document node - regular link
          <Link to={`/${routePrefix}/${node.slug}`} className="tree-link">
            <span className="tree-file-icon"></span>
            {node.title || node.name}
          </Link>
        )}
      </div>

      {hasChildren && isExpanded && (
        <ul className="tree-children">
          {node.children.map((child, index) => (
            <TreeNodeComponent
              key={`${child.name}-${index}`}
              node={child}
              depth={depth + 1}
              routePrefix={routePrefix}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Navigation({ documents }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Use last segment of docsDir as routePrefix, matching App.tsx
  const routePrefix = config.docsDir.split("/").filter(Boolean).pop() || "docs";
  const tree = buildDocumentTree(documents);

  // Close mobile menu when clicking outside or on a link
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const nav = document.querySelector(".navigation");
      const toggle = document.querySelector(".mobile-menu-toggle");

      if (
        isMobileMenuOpen &&
        nav &&
        !nav.contains(event.target as Node) &&
        !toggle?.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMobileMenuOpen]);

  // Close mobile menu when route changes
  const location = useLocation();
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  return (
    <>
      {/* Floating burger menu button (mobile only) */}
      <button
        className="mobile-menu-toggle unified-button"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle navigation menu"
      >
        {isMobileMenuOpen ? "✕" : "☰"}
      </button>

      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className={`mobile-backdrop ${isMobileMenuOpen ? "visible" : ""}`}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <nav className={`navigation ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="navigation-header">
          <h1>
            <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>
              {config.docsDir}
            </Link>
          </h1>
          <ThemeToggle />
        </div>

        <div className="nav-content">
          <ul className="tree-root">
            {tree.children.map((child, index) => (
              <TreeNodeComponent
                key={`${child.name}-${index}`}
                node={child}
                depth={0}
                routePrefix={routePrefix}
              />
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
