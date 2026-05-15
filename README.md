# Kuery

A small desktop app that watches the Kusto queries you run — in
[Azure Data Explorer](https://dataexplorer.azure.com/) and from AI agents
that talk to a Kusto MCP server — and saves them locally so you can search
them, star the good ones, and feed them back to the next agent.

This is the Rust/Tauri rewrite of the original
[`kuery-legacy`](https://github.com/timrogers/kuery) Chrome extension. The
storage, search, UI, AI summaries, and MCP server now all live in one native
process; the browser extension and the CLI hook are tiny shims that just
forward queries over HTTP.

## Architecture

```
                ┌──────────────────────────────────────────────────────┐
                │                  Kuery desktop app                    │
                │                                                      │
   ADX page ─►  │   HTTP ingest (POST /v1/queries)                     │
   (extension)  │            │                                         │
                │            ▼                                         │
   Copilot CLI  │   Store (SQLite + FTS5)  ◄── React UI (Tauri IPC)    │
   (hook) ────► │            │                                         │
                │            │   ▲                                     │
                │            ▼   │                                     │
                │   AI describer ─► GitHub Models (gpt-4.1)            │
                │                                                      │
                │   MCP server (POST /mcp, JSON-RPC)  ◄─── any agent   │
                └──────────────────────────────────────────────────────┘
```

- **Rust backend** (`src-tauri/`): SQLite store with FTS5 full-text search,
  an axum HTTP server bound to `127.0.0.1:47821`, an embedded MCP server,
  and a background AI describer.
- **React UI** (`src/`): two-pane query browser with debounce search, star
  toggle, settings, and import/export.
- **Chrome capture shim** (`chrome-extension/`): MV3 extension that
  intercepts ADX query requests and POSTs them to the local app.
- **Copilot CLI plugin** (`plugin/`): one-line install (`copilot plugin
  install timrogers/kuery:plugin`) that captures KQL run by AI agents
  through a Kusto MCP server.

## HTTP API surface

Bound to `127.0.0.1:47821` only. There is intentionally no read-side HTTP
API — the UI uses Tauri IPC and the MCP server runs in-process — so a
local process can append queries but cannot read or destroy your history.

| Method | Path                      | Description                                          |
|--------|---------------------------|------------------------------------------------------|
| GET    | `/v1/health`              | Liveness check                                       |
| POST   | `/v1/queries`             | Ingest a single query (`{query_text, cluster?, database?, source}`) |
| POST   | `/v1/hooks/copilot-cli`   | `postToolUse` payload sink for the Copilot CLI plugin |
| POST   | `/mcp`                    | JSON-RPC 2.0 MCP endpoint                            |

## MCP tools

Available to any MCP client that can talk to a Streamable HTTP transport at
`http://127.0.0.1:47821/mcp`:

- `search_queries(query, limit?, starred_only?)`
- `get_query(id)`
- `list_recent_queries(limit?)`
- `list_starred_queries(limit?)`

## Running

Prerequisites: Node 20+, pnpm, Rust 1.80+, the Tauri 2 toolchain.

```bash
pnpm install
pnpm tauri dev
```

The desktop window opens; the HTTP server binds to `127.0.0.1:47821` as
soon as the app is up. To install the optional pieces:

- **Chrome extension** — see `chrome-extension/README.md`.
- **Copilot CLI plugin** — `copilot plugin install timrogers/kuery:plugin`
  (see `plugin/README.md`).

## Background mode

Kuery is designed to run quietly in the background so the capture API and
MCP server are always available.

- On macOS the app runs as a tray-only "accessory" — there is **no Dock
  icon**. Click the menu-bar icon to open the window or quit the app.
- Closing the window just hides it; the server keeps running.
- A **Start at login** option (in the first-run welcome flow and in
  Settings) registers Kuery with the OS so it's running whenever you are.
  When launched at login the window stays hidden until you open it from
  the tray.
- Running the app a second time just focuses the existing window.

## Importing legacy data

Settings → Import database… and pick your old `kuery.sqlite`. Schemas are
mapped automatically (`runs_count` → `run_count`, `starred_at` → `starred`,
etc.) and rows are merged by query text + cluster + database. A backup of
the current database is taken before merge.

## AI descriptions

When a brand-new query is captured the app asks GitHub Models (`openai/gpt-4.1`,
free with a GitHub PAT — see Settings) to write a one-line summary, which is
saved on the row and indexed alongside the query text for search. If no token
is configured the step is skipped silently.

## License

MIT.
