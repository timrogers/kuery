# Kuery

<img width="382" height="620" alt="Kuery extension popup screenshot" src="https://github.com/user-attachments/assets/241dbf24-d11e-4d93-8879-99d1a8c2751e" />


A Chrome extension for automatically tracking and managing your Azure Data Explorer (Kusto) queries, with AI-powered summaries.

## What it does

Kuery automatically captures and stores your Azure Data Explorer queries in a local SQLite database whenever you run them. It provides:

- **Query History**: Automatically saves all successful queries with metadata (database, cluster, run count, timestamps)
- **AI-Powered Descriptions**: Generates concise descriptions for your queries using OpenAI GPT-4.1, powered by GitHub Models
- **Query Management**: Star useful queries, edit descriptions, delete queries, and view detailed query information
- **Data Export/Import**: Export your query database or import from other devices

## Getting started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:

```bash
git clone https://github.com/timrogers/kuery-extension.git
```

2. Install dependencies:

```bash
npm install
```

3. Build the extension:

```bash
npm run build
```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select the `build/chrome-mv3-prod` folder

## Usage

1. Open the extension's popup, click "Settings", then follow the instructions to create, test and save your GitHub Models token. The extension will use this to create AI-generated query descriptions, completely free of charge ✨
1. Run a query in Azure Data Explorer
1. Open the popup again. Your query will appear 🎉

## How it works under the hood

### Architecture

Kuery consists of three main components:

1. **Content Script** (`content.ts`): Runs on Azure Data Explorer pages and injects the interception script
2. **Injection Script** (`assets/inject.js`): Intercepts HTTP requests/responses to capture query data
3. **Background Service Worker** (`background.ts`): Handles data storage, AI integration, and database operations
4. **Popup UI** (`popup.tsx`): Main interface for browsing and managing queries
5. **Options Page** (`options/index.tsx`): Settings for GitHub token and database import/export

### Data Flow

1. **Query Capture**: When you run a query in Azure Data Explorer, the injection script intercepts the API call
2. **Response Analysis**: The script analyzes the response to determine if the query was successful
3. **Data Storage**: Query metadata is sent to the background worker and stored in SQLite
4. **AI Processing**: If configured, the background worker generates an AI description using GitHub Models
5. **UI Updates**: The popup displays your query history with search and management features

### Technology Stack

- **Framework**: Built with [Plasmo](https://plasmo.com) for modern Chrome extension development
- **Database**: SQLite with [sql.js](https://github.com/sql-js/sql.js) for client-side database operations
- **AI Integration**: GitHub Models API (OpenAI GPT-4) for query descriptions
- **UI**: React with TypeScript for the popup and options interfaces
- **Storage**: Chrome Extension Storage API for configuration and database persistence

### Security Features

- **Local Storage**: All query data is stored locally on your device
- **Token Security**: GitHub tokens are stored securely using Chrome's sync storage
- **Domain Restrictions**: Only operates on authorized Azure Data Explorer domains
- **Error Handling**: Graceful handling of SQLite errors with user notifications

### Database Management

The extension automatically creates and manages a SQLite database. You can:

- **Export Database**: Download your query history as a `.sqlite` file
- **Import Database**: Replace your current database with one from another device
- **View Backups**: Access automatically created backups before migrations or imports

## Privacy

- All data is stored locally on your device
- No data is sent to external servers except for AI descriptions (when configured)
- GitHub token is only used for GitHub Models API calls
- Query data never leaves your local environment

## Development

For development with hot reloading:

```bash
npm run dev
```

This will start the development server and automatically reload the extension when files change.

### Available Scripts

- `npm run dev` - Start development server with hot reloading
- `npm run build` - Build production version
- `npm run package` - Create packaged extension for distribution

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request
