#!/usr/bin/env bash
# Copilot CLI postToolUse hook for Kuery.
#
# Reads the hook payload from stdin, and if the tool that just completed was a
# Kusto MCP query tool, POSTs the executed query to the local Kuery desktop app
# so it gets captured alongside queries you run in Azure Data Explorer.
#
# This script is intentionally silent and never exits non-zero — a broken hook
# must never break the agent.

set -u

API_URL="${KUERY_API_URL:-http://127.0.0.1:47821/v1/queries}"

# Need jq + curl; bail silently if either is missing.
command -v jq >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0

INPUT="$(cat)"
[ -z "$INPUT" ] && exit 0

# Tool name (e.g. "kusto_query" or "kusto-mcp-kusto_query"). We capture KQL
# tools only; .show / .create style commands handled by `kusto_command` are
# intentionally excluded.
TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.toolName // empty')"
case "$TOOL_NAME" in
  *kusto_query|*kusto_graph_query) ;;
  *) exit 0 ;;
esac

# Only success — failures arrive on the postToolUseFailure event.
RESULT_TYPE="$(printf '%s' "$INPUT" | jq -r '.toolResult.resultType // empty')"
[ "$RESULT_TYPE" = "success" ] || exit 0

QUERY="$(printf '%s' "$INPUT" | jq -r '.toolArgs.query // empty')"
CLUSTER="$(printf '%s' "$INPUT" | jq -r '.toolArgs.cluster_uri // empty')"
DATABASE="$(printf '%s' "$INPUT" | jq -r '.toolArgs.database // empty')"
[ -z "$QUERY" ] && exit 0

PAYLOAD="$(jq -n \
  --arg q "$QUERY" \
  --arg c "$CLUSTER" \
  --arg d "$DATABASE" \
  '{query_text: $q, cluster: ($c | select(. != "")), database: ($d | select(. != "")), source: "agent"}')"

curl -fsS \
  --max-time 2 \
  -H 'Content-Type: application/json' \
  -d "$PAYLOAD" \
  "$API_URL" >/dev/null 2>&1 || true

exit 0
