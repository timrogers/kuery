# Copilot CLI hook for Kuery

A `postToolUse` hook for [GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli)
that captures Kusto queries you run via the Kusto MCP server (or any MCP
server whose tools are named `kusto_query` / `kusto_graph_query`) and POSTs
them to the locally running Kuery desktop app.

The hook fires on every successful tool call, then no-ops unless the tool name
ends with `kusto_query` or `kusto_graph_query`. `kusto_command` is intentionally
excluded — those are admin-style `.show` / `.create` commands rather than
user-authored KQL.

## Install

The CLI loads hook config from `~/.copilot/hooks/*.json` (or the inline
`hooks` block in `~/.copilot/settings.json`). The simplest installation is to
symlink this directory's config and scripts into place.

### macOS / Linux

```bash
mkdir -p ~/.copilot/hooks
# Pick whichever directory you cloned/installed Kuery into:
KUERY_HOOK_DIR="$(pwd)/hooks/copilot-cli"

# Make the script executable
chmod +x "$KUERY_HOOK_DIR/post-tool-use.sh"

# Drop a hooks file in place, expanding the absolute path now so the CLI
# doesn't need an env var at runtime.
sed "s|\$KUERY_HOOK_DIR|$KUERY_HOOK_DIR|g" "$KUERY_HOOK_DIR/kuery.json" \
    > ~/.copilot/hooks/kuery.json
```

### Windows (PowerShell)

```powershell
$dir = "$HOME\.copilot\hooks"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$kueryHookDir = (Resolve-Path .\hooks\copilot-cli).Path
(Get-Content .\hooks\copilot-cli\kuery.json) `
    -replace '\$env:KUERY_HOOK_DIR', $kueryHookDir.Replace('\','\\') `
    -replace '\$KUERY_HOOK_DIR', $kueryHookDir `
    | Set-Content "$dir\kuery.json"
```

## Verifying

Run `copilot` with a Kusto MCP server configured and execute a query. Then
check the Kuery desktop app — you should see the query appear within a
second or two with the source set to **agent**.

If nothing happens, run a tool call by hand to inspect the hook stdin:

```bash
echo '{"toolName":"kusto_query","toolResult":{"resultType":"success"},"toolArgs":{"query":"print 1","cluster_uri":"https://help.kusto.windows.net","database":"Samples"}}' \
    | hooks/copilot-cli/post-tool-use.sh
curl -s http://127.0.0.1:47821/v1/queries -X POST -d '{"query_text":"test","source":"agent"}' -H 'Content-Type: application/json'
```

## Config reference

The hook payload is documented at the
[Copilot CLI hooks reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference#posttooluse--posttooluse).
