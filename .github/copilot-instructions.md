# Kuery Extension Development Setup

This document provides comprehensive instructions for setting up the development environment and working with the Kuery Chrome extension project.

## Prerequisites

Before getting started, ensure you have the following installed:

- **Node.js 18+** (tested with v20.19.3)
- **npm** (tested with v10.8.2)  
- **Chrome browser** (for development and testing)
- **Git** (for version control)

## Project Overview

Kuery is a Chrome extension built with the [Plasmo framework](https://plasmo.com) that automatically tracks and manages Azure Data Explorer (Kusto) queries. The project uses:

- **Framework**: Plasmo (Chrome Extension Framework)
- **Frontend**: React with TypeScript
- **Database**: SQLite with sql.js for client-side operations
- **AI Integration**: GitHub Models API (OpenAI GPT-4) for query descriptions
- **Build System**: Plasmo's built-in bundler (based on Parcel)

## Development Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/timrogers/kuery-extension.git
cd kuery-extension
```

### 2. Install Dependencies

```bash
npm install
```

**Note**: If you encounter platform-specific dependency issues (especially with `sharp` or `@parcel/watcher`), run a clean reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

### 3. Verify Installation

Check that the basic build process works:

```bash
npm run build
```

This should complete successfully and create a `build/chrome-mv3-prod` directory.

## Development Workflow

### Starting Development Server

For development with hot reloading:

```bash
npm run dev
```

This starts the Plasmo development server, which will:
- Watch for file changes and automatically rebuild
- Generate development builds in `build/chrome-mv3-dev`
- Provide hot reloading for faster development

### Building for Production

To create a production build:

```bash
npm run build
```

This generates optimized files in `build/chrome-mv3-prod/`.

### Packaging for Distribution

To create a packaged extension file for distribution:

```bash
npm run package
```

This creates a `.zip` file in the `build/` directory ready for Chrome Web Store submission.

## Code Quality Tools

### Linting

The project uses ESLint with TypeScript and React configurations.

**Run linter:**
```bash
npm run lint
```

**Auto-fix linting issues:**
```bash
npm run lint:fix
```

**Current linting status**: ✅ Passes (may show some warnings about `any` types)

### Code Formatting

The project uses Prettier for consistent code formatting.

**Check formatting:**
```bash
npm run format:check
```

**Apply formatting:**
```bash
npm run format
```

**Current formatting status**: ✅ Passes (may show warnings about import order plugin configuration)

### Type Checking

Run TypeScript type checking:

```bash
npm run typecheck
```

**Current type checking status**: ⚠️ Has some type errors related to event target styling, but these don't prevent the extension from building and working correctly.

## Chrome Extension Development

### Loading the Extension in Chrome

1. Build the extension:
   ```bash
   npm run build
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in the top right)

4. Click "Load unpacked" and select the `build/chrome-mv3-prod` directory

5. The extension should now appear in your extensions list

### Testing the Extension

1. **Setup API Token** (optional): 
   - Click the extension icon in Chrome
   - Go to Settings
   - Create and save a GitHub Models API token for AI-powered descriptions

2. **Test Query Tracking**:
   - Navigate to Azure Data Explorer (`https://dataexplorer.azure.com`)
   - Run a query
   - Open the extension popup to see your tracked queries

### Development vs Production Builds

- **Development** (`npm run dev`): Creates `build/chrome-mv3-dev` with hot reloading support
- **Production** (`npm run build`): Creates `build/chrome-mv3-prod` with optimized code

Always use the production build when testing the full extension functionality.

## Project Structure

```
kuery-extension/
├── .github/                 # GitHub configuration and workflows
├── assets/                  # Static assets and injection scripts
├── components/              # React components
├── options/                 # Extension options page
├── background.ts           # Service worker/background script
├── content.ts              # Content script for web pages
├── popup.tsx              # Main popup interface
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── .eslintrc.js           # ESLint configuration
├── .prettierrc            # Prettier configuration
└── build/                 # Generated build outputs
```

## Available npm Scripts

| Script | Description | Status |
|--------|-------------|---------|
| `npm run dev` | Start development server with hot reloading | ✅ Working |
| `npm run build` | Build production version | ✅ Working |
| `npm run package` | Create packaged extension for distribution | ✅ Working |
| `npm run lint` | Run ESLint | ✅ Working |
| `npm run lint:fix` | Run ESLint with auto-fix | ✅ Working |
| `npm run format` | Format code with Prettier | ✅ Working |
| `npm run format:check` | Check code formatting | ✅ Working |
| `npm run typecheck` | Run TypeScript type checking | ⚠️ Has type errors |

## Troubleshooting

### Common Issues

**1. Platform-specific dependency errors (sharp, @parcel/watcher)**
```bash
rm -rf node_modules package-lock.json
npm install
```

**2. Build fails with missing dependencies**
```bash
npm install --include=optional
```

**3. TypeScript errors during typecheck**
The current codebase has some type errors related to event target styling. These don't prevent the extension from building or working. To see the specific errors:
```bash
npm run typecheck
```

**4. Extension not loading in Chrome**
- Ensure you built the extension first: `npm run build`
- Use the `build/chrome-mv3-prod` directory (not the source code)
- Check Chrome's developer console for error messages

**5. Hot reloading not working**
- Make sure you loaded the development build (`build/chrome-mv3-dev`)
- Try restarting the development server: `npm run dev`

### Getting Help

If you encounter issues:
1. Check the console output for specific error messages
2. Verify all prerequisites are installed with correct versions
3. Try the clean install process for dependency issues
4. Check Chrome's extension developer tools for runtime errors

## Contributing

When contributing to the project:

1. Run the linter and fix any errors: `npm run lint:fix`
2. Format your code: `npm run format`
3. Build the extension to ensure it works: `npm run build`
4. Test the extension in Chrome before submitting

Note: The project currently doesn't have automated tests, so manual testing is essential.