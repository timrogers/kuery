# Kuery plugin for GitHub Copilot CLI

Capture Kusto queries that the Copilot CLI agent runs via the Kusto MCP
server into your local [Kuery](https://github.com/timrogers/kuery)
desktop app, alongside queries you ran in Azure Data Explorer.

## Install

```bash
copilot plugin install timrogers/kuery:plugin
```

To install from a local checkout:

```bash
copilot plugin install ./plugin
```

## How it works

The plugin contributes two things to your Copilot CLI session:

1. An **MCP server** exposing the desktop app's saved queries to the
   agent, so it can search, list, and reload your Kusto queries
   without leaving the chat. The MCP server runs inside the Kuery
   desktop app and is reached over HTTP at
   `http://127.0.0.1:47821/mcp`. Tools available: `search_queries`,
   `get_query`, `list_recent_queries`, `list_starred_queries`.

2. A **`postToolUse` command hook**. After every tool call, Copilot
   CLI pipes the event payload as JSON over stdin to a small inline
   shell command (`bash` on macOS/Linux, `powershell` on Windows)
   that POSTs the body unchanged to
   `http://127.0.0.1:47821/v1/hooks/copilot-cli`. The desktop app:

   - Ignores anything that isn't a Kusto KQL query (`kusto_query` or
     `kusto_graph_query`; control commands like `.show tables` are
     filtered server-side).
   - Extracts the query, cluster URI, and database from the payload.
   - Stores the query with `source: "agent"` so you can tell agent-issued
     queries apart from your own in the UI.

The Kuery desktop app must be running for either of these to work. If
it isn't, the hook silently fails — agent runs are never blocked.

> Why a command hook instead of an HTTP hook? Copilot CLI's HTTP hooks
> refuse to target loopback addresses, so the plugin shells out to
> `curl` (or `Invoke-RestMethod`) which has no such restriction. The
> MCP server has no such restriction and uses HTTP directly.

## Uninstall

```bash
copilot plugin uninstall kuery
```
