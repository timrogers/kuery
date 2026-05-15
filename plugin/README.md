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

The plugin registers a single `postToolUse` HTTP hook. After every tool
call, Copilot CLI POSTs the event payload to the Kuery desktop app at
`http://127.0.0.1:47821/v1/hooks/copilot-cli`. The desktop app:

- Ignores anything that isn't a Kusto KQL query (`kusto_query` or
  `kusto_graph_query`; control commands like `.show tables` are
  filtered server-side).
- Extracts the query, cluster URI, and database from the payload.
- Stores the query with `source: "agent"` so you can tell agent-issued
  queries apart from your own in the UI.

The Kuery desktop app must be running for queries to be captured. If
it isn't, the hook silently times out — agent runs are never blocked.

## Uninstall

```bash
copilot plugin uninstall kuery
```
