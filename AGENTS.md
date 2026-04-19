# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**Vpanel** is a web-based label generator for electrical panels and enclosures. It features a React frontend with a PHP backend for PDF export and project management. The app supports multiple deployment modes and generates electrical schemas (unifilaire diagrams) with theme customization.

## Development Commands

### Setup & Dependencies
```bash
npm install              # Install dependencies
npm run update:all       # Update all dependencies to latest versions
npm run compile          # Compile app config (required before dev/build)
npm run copies           # Copy schema functions JSON to public
```

### Development
```bash
npm run dev              # Start dev server with PHP backend (localhost:8080)
                         # Runs Vite on port 5173 concurrently with PHP server
npm run lint             # ESLint check - must pass without warnings (--max-warnings 0)
npm run preview          # Preview production build locally
```

### Building
```bash
npm run build            # Build for GitHub Pages (mode: ghpages)
npm run build:web        # Build for web deployment (mode: web)
npm run build:dev        # Build for development (mode: dev)
npm run build:coolify    # Build for Coolify hosting (mode: production)
```

### Git Workflow
```bash
npm run gitpush:dev      # Commit and push to dev branch with auto-compile
npm run gitmerge:main    # Merge dev into main and push
```

## Key Architecture

### Frontend Structure (React 19 + Vite)
- **src/App.jsx**: Main application component with complex state management for projects, modules, themes, and schema
- **src/main.jsx**: Entry point with version checking and SpaceProvider setup
- **Component Organization**:
  - Editors: `EditorXxxSelector.jsx` components for schema properties (function, parent, type, etc.)
  - UI Elements: Module, Row, Editor components for the canvas
  - Popups: WelcomePopup, NewProjectEditor, ThemeEditorPopup, LoadingPopup
  - Selectors: IconSelector, GroupColorSelector for UI interactions

### State Management
- **App.jsx is a large class-like component** (not hooks-based) that manages:
  - Project data and metadata
  - Module definitions and positions
  - Theme/decoration settings
  - Schema (electrical diagram) state
  - Print options and preferences

### Backend (PHP)
Located in `public/api/`:
- **toPdf.php**: PDF generation using libraries (PHPMailer, php-jwt)
- **action.php**: Project management operations
- **choices.php**: Returns schema function definitions and options
- **stats.php**, **reports.php**: Analytics and reporting
- **resume.php**: Project summary statistics

### Build Modes & Environments
Different `.env` files control deployment:
- **.env**: Local development (localhost:5173)
- **.env.dev**: Development server (www.vpanel.fr/dev/)
- **.env.web**: Web deployment
- **.env.ghpages**: GitHub Pages deployment
- **.env.coolify**: Coolify/self-hosted deployment

Key variables: `VITE_APP_BASE`, `VITE_APP_URL`, `VITE_APP_API_URL`, server port

### App Configuration Compilation
- **app-config-compiler.cjs**: Pre-build script that:
  - Reads `app-config.json` and `package-base.json`
  - Generates `package.json` with current version from changelog
  - Creates `public/infos.json` with app metadata
  - Generates `CHANGELOG.md` from structured config
- Runs automatically on `npm run dev` and before all builds via `predev` and `prebuild` hooks

### Utilities
- **color.js / colorSolver.js**: Color manipulation for theme system
- **generateDisplayName.js**: Module label generation
- **useLocalDebounce.jsx**, **useMultiClickHandler.jsx**, **useVisibilityChange.jsx**: Custom React hooks
- **SpaceProvider/SpaceContext.jsx**: Global context for spatial/theme settings

## Code Quality

### Linting
- **ESLint 9**: Configured for React 18.2 with jsx-runtime
- Must pass `npm run lint` with **zero warnings** (`--max-warnings 0`)
- Config file: `.eslintrc.cjs`
- Rules:
  - `react/prop-types`: Disabled (0)
  - `react/jsx-no-target-blank`: Off
  - `react-refresh/only-export-components`: Warns on non-component exports

### Dependencies
- **React 19.2.4** + React DOM
- **Vite 7.3.1**: Build tool with multiple plugins:
  - `@vitejs/plugin-react`: React Fast Refresh
  - `vite-plugin-pwa`: Progressive Web App support with workbox
  - `vite-plugin-mkcert`: Local HTTPS in dev
  - `vite-plugin-open-graph`: OG tag generation
  - `vite-plugin-sitemap`: Sitemap generation
- **Axios**: HTTP client
- **Sharp 0.34.5**: Image processing
- **semver, compare-versions**: Version management
- **sanitize-filename**: Safe filename generation

## Important Notes

### The Large App.jsx Component
App.jsx (107KB) is monolithic and manages all application state without using hooks. When making changes:
- Search for state references like `this.state.modules`, `this.state.project`
- Look for event handlers: `handleModuleXxx`, `handleEditorXxx`
- Theme state is under `this.state.selectedTheme` and `this.state.themes`
- Project persistence uses `localStorage` through the action API

### API Integration
- Backend serves from `VITE_APP_API_URL` environment variable
- CORS must be configured properly for cross-origin API calls
- Project import/export uses BASE64 encoding of JSON data
- PDF generation happens server-side via `toPdf.php`

### Print & PDF
- Uses native browser print API + custom CSS
- Server-side PDF rendering via Sharp + PHPMailer libraries
- Themes determine label appearance and layout
- Multiple print configurations: labels, schema, summary

### PWA & Offline Support
- Service workers auto-update projects
- Manifest configured in vite.config.js
- Icons: 64x64, 192x192, 512x512 PNG + maskable variants

### Deployment Considerations
- App supports standalone deployment (auto-redirect disabled in main.jsx)
- Version checking at runtime via `/infos.json`
- Custom domain support via `VITE_APP_HOSTNAME`
- Auth system controllable via `VITE_USE_AUTH` variable

## Testing & Debugging

### Browser Console
- Check for version update messages: `console.log` in main.jsx
- App logs mode: `Mode: [dev|production]`
- API errors from fetch calls will appear in console

### Local Development with PHP Backend
```bash
npm run dev
# Vite runs on http://localhost:5173
# PHP server runs on http://localhost:8080
# API endpoints proxied to PHP backend
```

### Building for Local Testing
```bash
npm run build:dev && npm run preview
# Simulates prod build locally on port 8080
```
