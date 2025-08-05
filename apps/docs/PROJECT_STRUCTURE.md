# Project Structure

This project is organized for robust, automated documentation processing and build safety. Below is an overview of the key directories and files, with a focus on the MDX filtering and generated artifacts workflow.

## Key Directories

- `src/` — Main application source code
  - `components/` — React components
  - `contexts/` — React context providers
  - `docs/` — All documentation content (MD/MDX files)
  - `generated/` — **Generated files for MDX filtering and imports**
    - `invalidMdxFiles.json` — List of invalid MDX files (relative paths)
    - `validMdxFiles.json` — List of valid MDX files (relative paths)
    - `validMdxFiles.json.d.ts` — TypeScript type declaration for validMdxFiles.json
    - `validMdxGlobs.generated.ts` — Import object for valid MDX files (used by loader)
  - `lib/` — App logic (e.g., docs loader)

- `scripts/` — Project scripts
  - `mdx-validate.cjs` — **Main script to validate/filter MDX files and generate artifacts**

- `public/` — Static assets
  - `files/` — Files embedded into the documentations (e.g. scripts)
- `example-docs/` — Example documentation (symlinked or copied into docs/)

## Workflow

- On every `npm run dev` or `npm run build`, the `predev`/`prebuild` script runs `scripts/mdx-validate.cjs`.
- This script scans all MDX files in `src/docs/`, validates imports and syntax, and generates the files in `src/generated/`.
- The app and Vite config use only the valid MDX files and ignore invalid ones, ensuring robust builds.

## .gitignore

- All files in `src/generated/` are gitignored **except** for `*.d.ts` type declarations, which are kept for TypeScript support.

## Example Structure

```
app-template/
├── scripts/
│   └── mdx-validate.cjs
├── src/
│   ├── components/
│   ├── contexts/
│   ├── docs/
│   ├── generated/
│   │   ├── invalidMdxFiles.json
│   │   ├── validMdxFiles.json
│   │   ├── validMdxFiles.json.d.ts
│   │   └── validMdxGlobs.generated.ts
│   ├── lib/
│   └── ...
├── .gitignore
├── package.json
└── vite.config.ts
```

---

For more details, see comments in the relevant files or ask for a specific workflow explanation.
