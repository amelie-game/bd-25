# Changelog

## [2.0.0] - 2025-08-14

### Changed
- **Major Migration:** Migrated from a Vite+React+MDX app-template to a fully Astro-powered template for documentation and static site generation.
- **Simplified Structure:** Removed Vite, React Router, and complex MDX import logic in favor of Astro content collections and dynamic routes.
- **Improved Developer Experience:** Dramatically reduced project complexity, improved maintainability, and made interactive code and theming easier to implement.
- **Modernized Workflow:** All navigation, theming, and code embedding now handled by Astro and simple CSS/JS. Interactive code examples use React components loaded with Astro's client directives.
- **Updated Documentation:** Updated `PROJECT_STRUCTURE.md` to reflect the new Astro-based structure.

# Changelog

## [1.7.4] - 2025-07-24

### Changed
- **App Template Version**: Bumped app-template version to 1.7.4
- **Setup Script Cleanup**: Both setup scripts (`setup.sh` and `setup.bat`) now proactively delete `app/src/docs` (or `%TARGET_DIR%\src\docs`) before copying the app template, ensuring a clean state and preventing stale symlinks, files, or directories from interfering with updates.

### Fixed
- **Pre-copy Directory Removal**: Prevents copy errors and ensures template updates work reliably even if `src/docs` exists as a symlink, file, or directory from previous runs.

## [1.7.3] - 2025-07-24

### Changed
- **App Template Version**: Bumped app-template version to 1.7.3
- **Setup Script Robustness**: Improved cross-platform setup scripts (`setup.sh` and `setup.bat`) to robustly remove `src/docs` whether it is a symlink, file, or directory before copying the template. Ensures reliable updates and prevents copy errors on both Unix and Windows environments.

### Fixed
- **Symlink/Directory Handling**: Resolved edge cases where `src/docs` could block template updates due to being a symlink, file, or directory. Now always cleaned up correctly before copying.

### Changed
- **App Template Version**: Bumped app-template version to 1.7.1
- **Static Asset Fetching**: CodePlayground now fetches all snippet files from the public directory using root-relative URLs, ensuring compatibility with GitHub Pages and other static hosts.

## [1.7.2] - 2025-07-24

### Changed
- **App Template Version**: Bumped app-template version to 1.7.2
- **Base Path Support**: CodePlayground now prepends the configured base path (`import.meta.env.BASE_URL`) to all static asset fetches, ensuring compatibility with custom deployments and GitHub Pages.

### Fixed
- **Asset Fetching on Custom Base Paths**: Resolved issues with file loading when the app is deployed under a non-root base path.

### Fixed
- **404 Errors on GitHub Pages**: Resolved file loading issues by switching to public directory for all fetchable assets.

## [1.7.1] - 2025-07-24

### Changed
- **App Template Version**: Bumped app-template version to 1.7.1
- **Static Asset Fetching**: CodePlayground now fetches all snippet files from the public directory using root-relative URLs, ensuring compatibility with GitHub Pages and other static hosts.

### Fixed
- **404 Errors on GitHub Pages**: Resolved file loading issues by switching to public directory for all fetchable assets.

## [1.7.0] - 2025-07-24

### Added
- **Raw File Support in CodePlayground**: You can now pass any file type (e.g., .txt, .md, .json) to CodePlayground. Non-code files are displayed in a styled <pre> block, while code files use Sandpack as before.
- **Automatic File Type Detection**: CodePlayground automatically detects unsupported file types and renders them as raw text.

### Improved
- **Seamless Integration**: Sandpack integration for code files is robust; raw files display cleanly and consistently.

### Changed
- **App Template Version**: Bumped app-template version to 1.7.0

## [1.6.0] - 2025-07-22

### Added
- Improved generated file organization: all MDX validation/filtering outputs now in `src/generated/`.
- Added robust .gitignore rules for generated files, keeping only type declarations.
- Updated project structure documentation and README for clarity and onboarding.
- Added detailed GitHub Pages deployment instructions and workflow example.
- Centralized README and CHANGELOG as symlinks for single source of truth.
- Enhanced CLI and template documentation for new users.

## [1.5.0] - 2025-07-22

### Added
- **Robust MDX Importing**: Now supports lazy loading of all MD/MDX files in the docs directory and subdirectories
- **Error Isolation**: If an MDX file fails to import (e.g., due to missing components), only that document shows an error—other docs remain accessible
- **node_modules Ignore**: All files inside any `node_modules` directory are ignored for documentation import

### Changed
- **App Template Version**: Bumped app-template version to 1.5.0

### Enhanced
- **Default Document Selection**: Improved logic for selecting the default document on app startup
  - Now prioritizes README.md(x) or index.md(x) files over alphabetically first document
  - Searches for README/index files closest to the documentation root
  - Falls back to first document if no README/index is found
  - Case-insensitive matching for README and index files

### Improved
- **Navigation Tree Sorting**: Enhanced file tree organization in the navigation sidebar
  - Directories are now listed before files at every level
  - All entries are sorted alphabetically (A-Z) within their type
  - Maintains consistent sorting throughout nested directory structures
  - Provides more intuitive file explorer-like navigation experience

## [1.4.0] - 2025-07-21

### Enhanced
- **Default Document Selection**: Improved logic for selecting the default document on app startup
  - Now prioritizes README.md(x) or index.md(x) files over alphabetically first document
  - Searches for README/index files closest to the documentation root
  - Falls back to first document if no README/index is found
  - Case-insensitive matching for README and index files

### Improved
- **Navigation Tree Sorting**: Enhanced file tree organization in the navigation sidebar
  - Directories are now listed before files at every level
  - All entries are sorted alphabetically (A-Z) within their type
  - Maintains consistent sorting throughout nested directory structures
  - Provides more intuitive file explorer-like navigation experience

### Changed
- **App Template Version**: Bumped app-template version to 1.4.0

## [1.3.0] - 2025-07-21

### Updated
- **Documentation Structure**: Updated PROJECT_STRUCTURE.md to reflect actual codebase structure
  - Fixed example-docs directory structure documentation
  - Added ThemeToggle.tsx component to component list
  - Corrected documentation file organization and hierarchy
  - Updated component descriptions to match current implementation

### Changed
- **App Template Version**: Bumped app-template version to 1.3.0

## [1.2.0] - 2025-07-20

### Added
- **GitHub Pages Deployment**: Automated deployment to GitHub Pages on push to main branch
  - Complete CI/CD pipeline with GitHub Actions
  - Automatic symlink resolution during build process
  - SPA routing support with 404.html fallback
  - Live demo available at: https://fea-lib.github.io/mdxpress

### Fixed
- **MDX Production Compilation**: Resolved JavaScript runtime errors in production builds
  - Fixed MDX plugin configuration for production environments
  - Added proper JSX runtime configuration (`jsxRuntime: "automatic"`)
  - Conditional development mode setting based on NODE_ENV
- **Direct URL Access**: Fixed 404 errors when refreshing or directly accessing document URLs
  - Added 404.html that serves the React app for any missing route
  - Enables bookmarking and sharing of direct document links
  - Maintains proper base path handling for GitHub Pages deployment

## [1.1.1] - 2025-07-20

### Changed
- **File Structure Optimization**: Restructured documentation file organization for better maintainability
  - Moved `README.md`, `CHANGELOG.md`, and `PROJECT_STRUCTURE.md` to `app-template/` as source of truth
  - Created symlinks from repository root to `app-template/` versions
  - Created symlinks from `example-docs/` to `app-template/` versions
  - Eliminated circular symlink dependencies that were causing development server errors

### Fixed
- Resolved `ELOOP: too many symbolic links` error during development server startup
- Fixed circular symlink references between root and example documentation files

## [1.0.0] - 2025-07-17

### Added
- Initial release of MDXpress
- Complete Vite+MDX+React template
- Cross-platform CLI scripts (bash and batch)
- Interactive code execution with Sandpack
- Responsive documentation layout
- Configurable docs directory support
- Example documentation with advanced use cases
- TypeScript support throughout
- Local development mode for CLI testing

### Features
- 🚀 Interactive code examples with live execution
- 📝 MDX support for rich documentation
- ⚡ Fast development with Vite
- 🎨 Fully customizable styling and components
- 📱 Responsive design for all devices
- 🔧 Configurable docs directory structure
- 📦 Zero lock-in philosophy - you own the code
- 🌐 Deploy anywhere with static build

### Technical Implementation
- React 18 with TypeScript
- Vite 4 with HMR support
- MDX 2 with React components
- React Router for client-side routing
- Sandpack for interactive code execution
- Comprehensive CSS styling system
- Automatic document discovery and navigation

### CLI Tools
- Bash script for Linux/macOS
- Batch script for Windows
- Local development mode detection
- Interactive setup prompts
- Automatic app-template copying and configuration
- Clear setup instructions and error handling
