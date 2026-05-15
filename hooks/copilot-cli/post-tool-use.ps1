# Copilot CLI postToolUse hook for Kuery (Windows / PowerShell).
# See post-tool-use.sh for the full rationale. Silent, never throws.

$ErrorActionPreference = 'SilentlyContinue'

try {
    $apiUrl = if ($env:KUERY_API_URL) { $env:KUERY_API_URL } else { 'http://127.0.0.1:47821/v1/queries' }

    $raw = [Console]::In.ReadToEnd()
    if (-not $raw) { exit 0 }

    $event = $raw | ConvertFrom-Json
    $toolName = [string]$event.toolName
    if (-not ($toolName -match '(^|[-_])kusto_query$|(^|[-_])kusto_graph_query$')) { exit 0 }
    if ($event.toolResult.resultType -ne 'success') { exit 0 }

    $query = [string]$event.toolArgs.query
    if (-not $query) { exit 0 }

    $body = @{
        query_text = $query
        source     = 'agent'
    }
    if ($event.toolArgs.cluster_uri) { $body.cluster = [string]$event.toolArgs.cluster_uri }
    if ($event.toolArgs.database)    { $body.database = [string]$event.toolArgs.database }

    Invoke-RestMethod -Uri $apiUrl -Method Post -ContentType 'application/json' `
        -Body ($body | ConvertTo-Json -Compress) -TimeoutSec 2 | Out-Null
} catch {
    # Swallow everything.
}

exit 0
