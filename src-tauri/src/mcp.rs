use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::api::ApiState;
use crate::store::Store;

const PROTOCOL_VERSION: &str = "2025-06-18";

#[derive(Debug, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    #[serde(default)]
    pub id: Option<Value>,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

pub async fn handle(
    State(state): State<ApiState>,
    Json(req): Json<JsonRpcRequest>,
) -> impl IntoResponse {
    if req.jsonrpc != "2.0" {
        return error_response(req.id, -32600, "Invalid Request: jsonrpc must be \"2.0\"");
    }

    // Notifications (no id) get a 202 with empty body.
    let is_notification = req.id.is_none();
    let id = req.id.clone();

    let result = match req.method.as_str() {
        "initialize" => Ok(json!({
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": { "tools": {} },
            "serverInfo": { "name": "kuery", "version": env!("CARGO_PKG_VERSION") },
        })),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(tools_list()),
        "tools/call" => tools_call(&state.store, &req.params),
        // Common notifications: just acknowledge.
        "notifications/initialized" | "notifications/cancelled" => Ok(json!({})),
        other => Err((-32601, format!("Method not found: {other}"))),
    };

    if is_notification {
        return (StatusCode::ACCEPTED, "").into_response();
    }

    match result {
        Ok(value) => Json(json!({ "jsonrpc": "2.0", "id": id, "result": value })).into_response(),
        Err((code, msg)) => error_response(id, code, &msg),
    }
}

fn error_response(id: Option<Value>, code: i64, message: &str) -> axum::response::Response {
    Json(json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": code, "message": message },
    }))
    .into_response()
}

fn tools_list() -> Value {
    json!({
        "tools": [
            {
                "name": "search_queries",
                "description": "Full-text search across the user's saved Kusto queries (matches both query text and AI-generated description).",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Search terms" },
                        "limit": { "type": "integer", "default": 20, "minimum": 1, "maximum": 200 },
                        "starred_only": { "type": "boolean", "default": false }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "get_query",
                "description": "Fetch a single saved query by its numeric id.",
                "inputSchema": {
                    "type": "object",
                    "properties": { "id": { "type": "integer" } },
                    "required": ["id"]
                }
            },
            {
                "name": "list_recent_queries",
                "description": "List the most recently run saved queries, newest first.",
                "inputSchema": {
                    "type": "object",
                    "properties": { "limit": { "type": "integer", "default": 20, "minimum": 1, "maximum": 200 } }
                }
            },
            {
                "name": "list_starred_queries",
                "description": "List queries the user has starred as favourites.",
                "inputSchema": {
                    "type": "object",
                    "properties": { "limit": { "type": "integer", "default": 50, "minimum": 1, "maximum": 200 } }
                }
            }
        ]
    })
}

fn tools_call(store: &Store, params: &Value) -> Result<Value, (i64, String)> {
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .ok_or((-32602, "missing tool name".into()))?;
    let args = params.get("arguments").cloned().unwrap_or(json!({}));

    let result_json = match name {
        "search_queries" => {
            let q = args.get("query").and_then(Value::as_str).unwrap_or("");
            let limit = args.get("limit").and_then(Value::as_i64).unwrap_or(20);
            let starred = args.get("starred_only").and_then(Value::as_bool).unwrap_or(false);
            store
                .search(q, limit, starred)
                .map(|rows| json!(rows))
                .map_err(internal)?
        }
        "get_query" => {
            let id = args
                .get("id")
                .and_then(Value::as_i64)
                .ok_or((-32602, "missing id".into()))?;
            store.get(id).map(|r| json!(r)).map_err(internal)?
        }
        "list_recent_queries" => {
            let limit = args.get("limit").and_then(Value::as_i64).unwrap_or(20);
            store.list_recent(limit).map(|r| json!(r)).map_err(internal)?
        }
        "list_starred_queries" => {
            let limit = args.get("limit").and_then(Value::as_i64).unwrap_or(50);
            store.list_starred(limit).map(|r| json!(r)).map_err(internal)?
        }
        other => return Err((-32602, format!("unknown tool: {other}"))),
    };

    let text = serde_json::to_string_pretty(&result_json).unwrap_or_else(|_| "null".into());
    Ok(json!({
        "content": [{ "type": "text", "text": text }],
        "isError": false,
    }))
}

fn internal(e: anyhow::Error) -> (i64, String) {
    (-32000, e.to_string())
}
