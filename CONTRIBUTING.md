# Contributing to Kuery

Thanks for taking a look! Kuery is a small personal tool, but contributions
are welcome. This file collects the developer-facing details that don't
belong in the user-facing README.

See also [`AGENTS.md`](AGENTS.md) for repo layout, conventions, recipes for
common changes, and a list of gotchas.

## Dev build

```bash
git clone https://github.com/timrogers/kuery.git
cd kuery
pnpm install
pnpm tauri dev
```

The window opens and the local HTTP server binds to `127.0.0.1:47821` as
soon as the app is up. The first build takes a few minutes; after that
the React UI hot-reloads and the Rust backend recompiles on save.

## Tests and lint

Backend has a Rust test suite covering the store, ingest validation, MCP
JSON-RPC dispatch, and the legacy import path:

```bash
cd src-tauri
cargo fmt --all
cargo clippy --all-targets -- -D warnings
cargo test
```

CI (`.github/workflows/ci.yml`) runs the same commands plus `pnpm build`
(which type-checks via `tsc`) and a `node --check` syntax pass over the
Chrome extension. There is no front-end test suite yet.

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

## Debugging

The HTTP API and MCP server log to a persistent file at
`<app data>/logs/kuery.log` (e.g. `~/Library/Application
Support/com.caffeinesoftware.kuery/logs/kuery.log` on macOS). **Settings
→ Logs** has buttons to open the file, reveal it in the file manager, or
copy the path. Set `RUST_LOG=debug` in the environment to crank up
verbosity.
