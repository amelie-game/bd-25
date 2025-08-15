# 📝 MDXpress - Interactive Documentation CLI

A copy-in CLI tool that scaffolds a customizable Vite+MDX+React documentation app into any project. Inspired by the shadcn/ui approach, this tool gives you full ownership of your documentation code with zero lock-in.

## 🚀 Quick Start

### Interactive Setup

Run the setup script and follow the prompts:

```bash
curl -fsSL https://raw.githubusercontent.com/fea-lib/mdxpress/main/cli/setup.sh | bash
```

### One-liner Setup (with arguments)

Skip the prompts by providing your directories directly:

```bash
curl -fsSL https://raw.githubusercontent.com/fea-lib/mdxpress/main/cli/setup.sh | bash -s -- docs my-docs-app
```

Where:
- `docs` is your documentation source directory
- `my-docs-app` is where the documentation app will be created

### Alternative: Using wget

```bash
# Interactive
wget -qO- https://raw.githubusercontent.com/fea-lib/mdxpress/main/cli/setup.sh | bash

# With arguments
wget -qO- https://raw.githubusercontent.com/fea-lib/mdxpress/main/cli/setup.sh | bash -s -- docs my-docs-app
```

### Manual Download

Download and run the setup script for your platform:

- **Linux/macOS**: [setup.sh](https://raw.githubusercontent.com/fea-lib/mdxpress/main/cli/setup.sh)

```bash
# Interactive mode
./setup.sh

# With arguments
./setup.sh docs my-docs-app

# Show help
./setup.sh --help
```

➡️ See [Usage](#️-usage) and [Troubleshooting](#️-troubleshooting) for next steps and help.

### 💡 Pro Tips

- **For CI/CD pipelines**: Use the argument version for automated setups
- **First-time users**: Use interactive mode to understand the options
- **Team onboarding**: Share the one-liner with arguments for consistent setup
- **Multiple projects**: Arguments make it easy to script different configurations

## 🎯 Perfect For

- Software project documentation
- Educational content with live code examples
- API documentation with interactive examples
- Component libraries and design systems
- Technical tutorials and guides

## ✨ Features

- 🚀 **Interactive Code Examples**: Live TypeScript/JavaScript execution with provided `CodePlayground` component
- 📝 **MDX Support**: Write documentation in MDX format with React components
- ⚡ **Fast Development**: Powered by Vite for instant hot reload
- 🎨 **Fully Customizable**: Own the code, modify anything you want
- 📱 **Responsive Design**: Works perfectly on all devices
- 🔧 **Configurable**: Specify any docs directory structure
- 📦 **Zero Lock-in**: Copy the code and make it yours
- 🌐 **Deploy Anywhere**: Static build works with any hosting provider

## 🚀 Live Demo

Check out the live demo to see MDXpress in action: **[https://fea-lib.github.io/mdxpress](https://fea-lib.github.io/mdxpress)**

The demo showcases all the features including interactive code examples, MDX documentation, and the complete documentation structure.

## 📋 What You Get

The CLI copies a complete Vite+MDX+React application to your project, including robust MDX filtering and generated file support:

```
your-docs-app/                # Configurable via CLI
├── package.json              # Dependencies and scripts
├── vite.config.ts            # Vite configuration with MDX support
├── tsconfig.json             # TypeScript configuration
├── tsconfig.node.json        # Node.js TypeScript configuration
├── docs.config.json          # Docs directory configuration
├── index.html                # Entry HTML file
├── .gitignore                # Template Git ignore patterns
├── scripts/
│   └── mdx-validate.cjs      # MDX validation and filtering script
├── src/
│   ├── main.tsx              # React app entry point
│   ├── App.tsx               # Main application component
│   ├── index.css             # Global styles
│   ├── vite-env.d.ts         # Vite type definitions
│   ├── components/           # React components
│   ├── contexts/             # React contexts (theme, etc.)
│   ├── docs/                 # Symlink to your documentation files
│   ├── lib/                  # Utility functions
│   └── generated/            # Generated files for MDX filtering and imports
│       ├── invalidMdxFiles.json         # List of invalid MDX files (relative paths)
│       ├── validMdxFiles.json           # List of valid MDX files (relative paths)
│       ├── validMdxFiles.json.d.ts      # TypeScript type declaration for validMdxFiles.json
│       └── validMdxGlobs.generated.ts   # Import object for valid MDX files (used by loader)
├── public/                   # Static assets
```

```
your-docs-app/          # Configurable via CLI
├── package.json        # Dependencies and scripts
├── astro.config.mjs    # Astro configuration with MDX support
├── tsconfig.json       # TypeScript configuration
├── .gitignore          # Template Git ignore patterns
├── example-docs/       # Example documentation
├── public/             # Static assets (served as-is)
├── src/                # Main Astro application source code
│   ├── components/     # Astro and React components (for interactive/MDX code)
│   ├── content/        # Astro configuration from where to gather the documents
│   ├── pages/          # Astro page routes (including dynamic docs routing)
│   ├── styles/         # Global and component CSS
│   ├── types/          # All globally used types
│   ├── utils/          # All globally used utilities
│   └── environment.ts  # Path constants derived from the CLI input
└── tests/              # Unit tests
```

## 🛠️ Usage

1. **Run the setup script** (see Quick Start above)
   - Use interactive mode for guidance: `curl -s URL | bash`
   - Use direct arguments for automation: `curl -s URL | bash -s -- docs my-docs-app`

2. **Install dependencies**:
   ```bash
   cd your-docs-app
   npm install
   ```

3. **Start developing**:
   ```bash
   npm run dev
   ```

### Setup Options

- **Interactive mode**: Script will prompt for directories
- **Direct arguments**: `./setup.sh [docs_dir] [target_dir]`
- **Help**: `./setup.sh --help` shows all usage options

### Common Issues

- **Vite fails to start**: Delete `node_modules` folder and run `npm install` again
- **Module resolution errors**: Ensure all dependencies are installed with `npm install`
- **Port conflicts**: Vite will automatically use a different port if 5173 is busy

## 📖 Writing Documentation

Create `.mdx` files in your docs directory:

```mdx
# Getting Started

Here's an interactive React example using the CodePlayground component:

<Code
  src={{ "react-ts": {
    "/App.tsx": `export default function App() {
      return <h1>Hello Interactive Docs!</h1>
    }`
  } }}
/>
```

## ⚙️ Configuration

The CLI handles all configuration during setup:

- **Target directory**: Choose where to create your documentation app
- **Source directory**: Specify where your existing documentation files are located
- **Automatic symlink**: The CLI creates a symlink from `src/docs/` to your actual documentation directory

The setup creates a seamless connection between your existing docs and the interactive app, so you can keep your documentation files in their original location while powering them with the MDXpress interface.

## 🎨 Customization

Since you own the code, you can customize everything:

- **Styling**: Edit `src/styles/index.css` or add your own CSS
- **Components**: Create custom components in `src/components/`
- **Layout**: Modify `src/pages/docs/[...slug].astro` and navigation
- **Build process**: Update `astro.config.mjs`
- **Routes**: Add new file-based routes in `src/pages`

## 🚢 Deployment

Build for production and deploy anywhere:

```bash
npm run build
```

Deploy the `dist` folder to:
- Vercel
- Netlify  
- GitHub Pages
- AWS S3
- Any static hosting provider

**Important:**
The `base` property in your `astro.config.mjs` (see:
```js
base: process.env.NODE_ENV === "production" ? "/mdxpress/" : "/",
```
) must be set to the correct base URL for your deployment target. For example, if deploying to a subpath or GitHub Pages, set it to your repository name (e.g. `"/my-repo/"`).


### Deploying to GitHub Pages

You can automate deployment to GitHub Pages using GitHub Actions. Here is a sample workflow (`.github/workflows/deploy.yml`) that builds your app and deploys it to GitHub Pages:

```yaml
name: Deploy Template App to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"
          cache: "npm"
          cache-dependency-path: "./app-template/package-lock.json"

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Install dependencies
        working-directory: ./app-template
        run: npm install

      - name: Build
        working-directory: ./app-template
        run: npm run build
        env:
          NODE_ENV: production

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./app-template/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

This workflow will:
- Build your app in the `app-template` directory
- Deploy the contents of `dist` to GitHub Pages

**Note:**
For GitHub Pages, the `base` property in your `astro.config.mjs` must be set to the name of your repository (e.g. `base: "/my-repo/"`) so that all links and assets resolve correctly in production.

For more details, see the [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages) and the [actions/deploy-pages](https://github.com/actions/deploy-pages) action.


## 🔧 Troubleshooting

### Installation Issues

If you encounter `ERR_MODULE_NOT_FOUND` or similar installation errors:

1. **Clear npm cache and reinstall**:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Verify Node.js and npm versions**:
   ```bash
   node --version  # Should be >=18.0.0
   npm --version   # Should be >=9.0.0
   ```

3. **If using an older Node.js version**, update from [nodejs.org](https://nodejs.org/)


## Astro Starter Kit: Minimal

```sh
npm create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

### 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

### 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

### 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).


---

**Ready to create interactive documentation?** Run the setup script and start documenting! 🚀