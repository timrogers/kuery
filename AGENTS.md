# AGENTS.md

Guidance for AI coding agents working in this repository. Read this
before making changes.

## What this app is

Kuery is a macOS-only desktop app (Rust + Tauri 2 + React) that
captures Kusto/KQL queries from Azure Data Explorer and AI agents,
stores them locally in SQLite, and re-exposes them over an MCP server
on `127.0.0.1:47821`. See `README.md` for the architecture diagram.

## Repository layout

```
src/                    React UI (TypeScript, Vite)
  components/           UI components (PascalCase.tsx)
  api.ts                Tauri IPC wrappers (one function per Rust command)
src-tauri/              Tauri shell + Rust backend
  src/lib.rs            App setup, tray, autostart, window plumbing
  src/store.rs          SQLite + FTS5 query store (the heart of the app)
  src/api.rs            axum HTTP server (ingest + Copilot CLI hook)
  src/mcp.rs            JSON-RPC MCP server (in-process)
  src/ipc.rs            Tauri command handlers (UI ↔ backend)
  src/agent.rs          Smart-search agent loop (Copilot CLI subprocess)
  src/ai.rs             Background AI describer
  tauri.conf.json       Window, bundle, plugin config
chrome-extension/       MV3 extension that POSTs to /v1/queries
plugin/                 Copilot CLI plugin (hooks + MCP config)
.github/workflows/      CI (macOS only)
```

## Commands

Run from the repo root unless noted.

| Task | Command |
|------|---------|
| Install JS deps | `pnpm install` |
| Run app in dev | `pnpm tauri dev` |
| Typecheck + build UI | `pnpm build` |
| Build release `.app` | `pnpm tauri build --bundles app` |
| Backend tests | `cd src-tauri && cargo test` |
| Backend lint | `cd src-tauri && cargo clippy --all-targets -- -D warnings` |
| Backend fmt check | `cd src-tauri && cargo fmt --all -- --check` |
| Backend fmt apply | `cd src-tauri && cargo fmt --all` |

Always run `cargo fmt` and `cargo clippy --all-targets -- -D warnings`
before committing — CI gates on both with `-D warnings`.

## Conventions

- **macOS only.** A `compile_error!` in `src-tauri/src/lib.rs` rejects
  non-macOS targets and `package.json` declares `"os": ["darwin"]`.
  Don't add Linux/Windows-only code paths.
- **Rust style:** standard `rustfmt`, no `unwrap()` in non-test code
  (use `?` or explicit error handling), `tracing` for logs (never
  `println!`), `anyhow::Result` for fallible boundaries, `thiserror`
  enums for typed errors when surfaced over IPC.
- **TypeScript style:** strict mode is on, prefer `type` over
  `interface` for IPC-payload shapes that mirror Rust structs, no
  default exports for components. Components live one-per-file in
  `src/components/`.
- **CSS:** plain CSS in `src/App.css`, no preprocessor. Watch for
  global selectors (`button`, `input:not([type])`) — they have higher
  specificity than a single class and will override component styles
  unless you bump specificity (e.g. `input.search-input`).
- **No new build tools, linters, or formatters** without an explicit
  ask.

## Adding a new IPC command

End-to-end pattern:

1. Write the handler in `src-tauri/src/ipc.rs` as
   `#[tauri::command] async fn foo(...) -> Result<T, String>`.
2. Register it in `tauri::generate_handler![...]` in
   `src-tauri/src/lib.rs`.
3. Add a wrapper in `src/api.ts` that calls `invoke<T>("foo", {...})`.
4. Use the wrapper from React — never call `invoke` directly from a
   component.

## Adding a new HTTP endpoint

`src-tauri/src/api.rs` has the axum router. The HTTP server is
intentionally **write-only** (ingest + hook) — the read side lives
behind Tauri IPC and the in-process MCP server. Don't add a `GET`
route that exposes query history; it would let any local process read
the user's history without consent.

## Adding a new MCP tool

1. Add the tool descriptor to `tools_list()` in
   `src-tauri/src/mcp.rs`.
2. Handle the call in `tools_call()` with input validation.
3. Add a unit test covering both the dispatch and the input shape.
4. The Copilot CLI plugin (`plugin/mcp.json`) auto-discovers tools, so
   no plugin change is needed.

## Database & migrations

`store.rs` owns the schema. Migrations are applied by version number
in `apply_migrations()`; **never** mutate an existing migration —
append a new one. The legacy importer (`import_legacy_database`) maps
columns from the old kuery-legacy schema; preserve the column-mapping
table when adding fields.

## Gotchas worth remembering

- **WebKit clipboard gesture loss.** `navigator.clipboard.writeText`
  rejects with `NotAllowedError` if you `await` anything before
  calling it inside a click handler — the user-gesture token is
  dropped across the await. Precompute values in `useEffect` /
  `useMemo` and call `writeText` synchronously. See `QueryDetail.tsx`.
- **Tauri activation policy.** macOS-only — controls whether the app
  shows in the Dock. Set via `set_activation_policy` in `lib.rs`.
- **Single-instance.** A second launch focuses the existing window.
  Don't add startup work that assumes a fresh process state.
- **CSS Grid `1fr` doesn't shrink** — it's `minmax(auto, 1fr)`. Use
  `minmax(0, 1fr)` in grid columns and `min-width: 0` on flex items
  containing scrollable content.
- **`gpt-5.4-mini` is the description model.** Hardcoded in `ai.rs`;
  if Copilot CLI rejects it, descriptions silently don't appear.

## Commits

- Use clear, descriptive messages explaining the *why*, not just the
  *what*. Subject line up to 72 chars; body wraps at 72.
- Always include the trailer:

  ```
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
  ```

- Never rewrite history on shared branches.

## Don't

- Don't add Linux/Windows code paths.
- Don't add new dependencies without a clear justification — every
  dep is a maintenance and supply-chain cost.
- Don't add HTTP endpoints that read or mutate user data.
- Don't commit secrets, API keys, or test fixtures with real data.
- Don't run `cargo update` or `pnpm update` opportunistically;
  Dependabot owns version bumps.
- Don't expand scope beyond what was asked — "while I'm here" fixes
  belong in a separate PR.
