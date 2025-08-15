# Project Structure

This project is powered by **Astro** for static site generation and documentation.

## Key Directories

```
app-template/
├── example-docs/       # Example documentation
├── public/             # Static assets (served as-is)
├── src/                # Main Astro application source code
│   ├── components/     # Astro and React components (for interactive/MDX code)
│   ├── content/        # Astro configuration from where to gather the documents
│   ├── pages/          # Astro page routes (including dynamic docs routing)
│   ├── styles/         # Global and component CSS
│   ├── types/          # All globally used types
│   └── utils/          # All globally used utilities
└── tests/              # Unit tests
```

## Workflow

- Documentation lives in `src/docs/` (or as configured)
- Astro content collections and dynamic routes power the docs system
- Interactive code examples use React components, loaded with Astro's `client:only`
- All navigation, theming, and code embedding is handled by Astro and simple CSS

---

For more details, see comments in the relevant files or ask for a specific workflow explanation.
