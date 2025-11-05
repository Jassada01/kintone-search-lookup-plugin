# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a kintone plugin project that uses esbuild for bundling and modern frontend tooling. It provides a search/lookup functionality for kintone applications.

## Build Commands

### Initial Setup
```bash
npm run init
```
Creates `.cert` directory with self-signed certificate for HTTPS development server, installs dependencies, generates `plugin.key`, and removes unnecessary files.

### Development Mode
```bash
npm run build:dev
```
- Runs TypeScript compiler (`tsc`)
- Packs the plugin with `kintone-plugin-packer`
- Starts esbuild in development mode with watch and serve
- Launches HTTPS server at https://localhost:9000/
- Automatically switches `manifest.dev.json` → `manifest.json` if `manifest.dev.json` exists
- Automatically switches `manifest.json` → `manifest.prod.json` if switching back from production

### Production Build
```bash
npm run build:prod
```
- Runs TypeScript compiler (`tsc`)
- Builds with esbuild in production mode (minified, no sourcemaps)
- Packs the plugin into `dist/plugin.zip`
- Automatically switches `manifest.prod.json` → `manifest.json` if it exists
- Automatically switches `manifest.json` → `manifest.dev.json` if switching from development

### Upload Plugin
```bash
npm run upload
```
Uploads `dist/plugin.zip` to kintone environment using `kintone-plugin-uploader`.

## Architecture

### Manifest File Switching
The project uses a dual-manifest system:
- **manifest.json** (dev): Points to `https://127.0.0.1:9000/` for local development
- **manifest.prod.json**: Points to bundled files in `dist/` directory
- Build scripts automatically swap these files based on the build mode

### Code Structure
- **src/appPage/**: Application page code (desktop and mobile views)
  - `desktop/desktop.ts`: Desktop application logic
  - `mobile/mobile.ts`: Mobile application logic
- **src/configPage/**: Plugin configuration page
  - `config.ts`: Configuration page logic using kintone-ui-component
  - `config.html`: Configuration page HTML template
- **src/common/**: Shared utilities
  - `i18n/`: Internationalization using i18next (supports ja, en, zh)
  - `types/`: TypeScript type definitions
  - `config/constants.ts`: Shared constants (classNames, element IDs)

### Entry Points
The esbuild configuration ([scripts/esbuild/build.mjs:25-32](scripts/esbuild/build.mjs#L25-L32)) bundles these entry points:
- `src/appPage/desktop/desktop.ts` & `.css`
- `src/appPage/mobile/mobile.ts` & `.css`
- `src/configPage/config.ts` & `.css`

### Plugin Pattern
All TypeScript entry points use an IIFE pattern that receives `kintone.$PLUGIN_ID`:
```typescript
((PLUGIN_ID: string) => {
  "use strict";
  const CONFIG = kintone.plugin.app.getConfig(PLUGIN_ID);
  // Plugin logic here
})(kintone.$PLUGIN_ID);
```

### Internationalization
i18n is configured in [src/common/i18n/i18n.ts](src/common/i18n/i18n.ts) using i18next. It automatically detects the user's kintone language preference via `kintone.getLoginUser().language` and falls back to English.

### UI Components
The config page uses `kintone-ui-component` library for consistent kintone-style UI elements (Button, Spinner, Notification).

## Key Dependencies
- `@kintone/rest-api-client`: kintone REST API interactions
- `kintone-ui-component`: Official kintone UI component library
- `i18next`: Internationalization framework
- `esbuild`: Fast bundler
- `@kintone/plugin-packer`: Packages plugin for kintone
- `@kintone/plugin-uploader`: Uploads plugin to kintone environment

## Development Notes
- TypeScript compilation happens before esbuild bundling in both dev and prod modes
- Development mode runs TypeScript compiler, then packer, then esbuild serve (in that specific order)
- Production mode runs TypeScript compiler, then esbuild production build, then packer
- The local HTTPS server requires `.cert/private.key` and `.cert/private.cert` generated during init
