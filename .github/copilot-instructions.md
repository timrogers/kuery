# Copilot Instructions for Kuery Extension

This file provides setup and development instructions for AI agents working on the Kuery Chrome extension project.

## Project Overview

Chrome extension for tracking Azure Data Explorer queries, built with Plasmo framework, TypeScript, and React.

## Development Environment Setup

### Prerequisites
- Node.js 18+ (tested with v20.19.3)
- npm 8+ (tested with v10.8.2)

### Installation
```bash
npm install
```

## Build Process

### Development Build with Hot Reloading
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Create Distribution Package
```bash
npm run package
```

## Code Quality Tools

### Linting
```bash
# Check for linting issues
npm run lint

# Fix auto-fixable linting issues
npm run lint:fix
```

### Formatting
```bash
# Check code formatting
npm run format:check

# Format code
npm run format
```

### Type Checking
```bash
npm run typecheck
```

## Project Structure

- `background.ts` - Extension background service worker
- `content.ts` - Content script for Azure Data Explorer pages
- `popup.tsx` - Main popup interface
- `options/` - Extension options/settings page
- `components/` - React components
- `assets/` - Static assets and injection scripts
- `build/` - Build output directory (generated)

## Known Issues

The project currently has some existing TypeScript errors and ESLint warnings that do not prevent successful building:
- 14 TypeScript errors related to event target styling in components
- 8 ESLint warnings about explicit any types
- Build and packaging work successfully despite these issues

## Extension Loading for Testing

After building:
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `build/chrome-mv3-prod` folder

## Key Dependencies

- `plasmo` - Extension framework
- `react` + `react-dom` - UI framework
- `sql.js` - SQLite database operations
- `openai` - AI integration for query descriptions
- `typescript` + various linting/formatting tools