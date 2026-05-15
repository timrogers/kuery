use std::net::SocketAddr;

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tower_http::cors::{Any, CorsLayer};

use crate::store::{NewQuery, Store};

pub const API_PORT: u16 = 47821;

#[derive(Clone)]
pub struct ApiState {
    pub store: Store,
}

pub fn router(state: ApiState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/v1/health", get(health))
        .route("/v1/queries", post(ingest))
        .route("/v1/hooks/copilot-cli", post(copilot_cli_hook))
        .route("/mcp", post(crate::mcp::handle))
        .with_state(state)
        .layer(cors)
}

pub async fn serve(state: ApiState) -> anyhow::Result<()> {
    let app = router(state);
    let addr: SocketAddr = ([127, 0, 0, 1], API_PORT).into();
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("HTTP API listening on http://{}", addr);
    axum::serve(listener, app).await?;
    Ok(())
}

#[derive(Serialize)]
struct Health {
    status: &'static str,
    name: &'static str,
    version: &'static str,
}

async fn health() -> Json<Health> {
    Json(Health {
        status: "ok",
        name: "kuery",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn ingest(
    State(state): State<ApiState>,
    Json(payload): Json<NewQuery>,
) -> Result<Response, ApiError> {
    let result = state
        .store
        .ingest(&payload)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let Some(result) = result else {
        // Filtered (e.g. control command). Acknowledge with 204 so the
        // client doesn't retry.
        return Ok((StatusCode::NO_CONTENT, ()).into_response());
    };
    if result.created {
        crate::ai::describe_in_background(state.store.clone(), result.id, payload.query_text.clone());
    }
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": result.id,
            "created": result.created,
            "run_count": result.run_count,
        })),
    )
        .into_response())
}

struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn bad_request(msg: impl Into<String>) -> Self {
        Self { status: StatusCode::BAD_REQUEST, message: msg.into() }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}

/// Payload from the Copilot CLI plugin's `postToolUse` HTTP hook. The hook
/// fires after every tool, so the bulk of payloads are not Kusto queries —
/// the filter logic lives here so the plugin itself can be a single static
/// JSON file with no scripting.
#[derive(Deserialize)]
struct CopilotCliHookPayload {
    #[serde(default, alias = "tool_name")]
    tool_name: Option<String>,
    #[serde(default, alias = "tool_args")]
    tool_args: Option<Value>,
    #[serde(default, alias = "tool_result")]
    tool_result: Option<Value>,
}

fn extract_tool_name(p: &CopilotCliHookPayload) -> Option<&str> {
    p.tool_name.as_deref()
}

fn is_kusto_query_tool(tool_name: &str) -> bool {
    const SUFFIXES: &[&str] = &["kusto_query", "kusto_graph_query"];
    SUFFIXES.iter().any(|s| {
        tool_name == *s
            || tool_name.ends_with(&format!("-{s}"))
            || tool_name.ends_with(&format!("_{s}"))
    })
}

async fn copilot_cli_hook(
    State(state): State<ApiState>,
    Json(payload): Json<CopilotCliHookPayload>,
) -> Result<Response, ApiError> {
    let Some(tool_name) = extract_tool_name(&payload) else {
        return Ok(StatusCode::NO_CONTENT.into_response());
    };
    if !is_kusto_query_tool(tool_name) {
        return Ok(StatusCode::NO_CONTENT.into_response());
    }

    // Only ingest successful tool calls. Failures arrive on the
    // postToolUseFailure event which we don't subscribe to.
    let success = payload
        .tool_result
        .as_ref()
        .and_then(|v| v.get("resultType").or_else(|| v.get("result_type")))
        .and_then(Value::as_str)
        .map(|s| s.eq_ignore_ascii_case("success"))
        .unwrap_or(true);
    if !success {
        return Ok(StatusCode::NO_CONTENT.into_response());
    }

    let args = payload.tool_args.as_ref();
    let query_text = args
        .and_then(|v| v.get("query"))
        .and_then(Value::as_str)
        .map(str::to_string);
    let Some(query_text) = query_text.filter(|s| !s.trim().is_empty()) else {
        return Ok(StatusCode::NO_CONTENT.into_response());
    };
    let cluster = args
        .and_then(|v| v.get("cluster_uri").or_else(|| v.get("clusterUri")))
        .and_then(Value::as_str)
        .map(str::to_string);
    let database = args
        .and_then(|v| v.get("database"))
        .and_then(Value::as_str)
        .map(str::to_string);

    let new_query = NewQuery {
        query_text,
        cluster,
        database,
        source: "agent".into(),
    };
    let result = state
        .store
        .ingest(&new_query)
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let Some(result) = result else {
        return Ok(StatusCode::NO_CONTENT.into_response());
    };
    if result.created {
        crate::ai::describe_in_background(
            state.store.clone(),
            result.id,
            new_query.query_text.clone(),
        );
    }
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": result.id,
            "created": result.created,
            "run_count": result.run_count,
        })),
    )
        .into_response())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_kusto_query_variants() {
        assert!(is_kusto_query_tool("kusto_query"));
        assert!(is_kusto_query_tool("kusto-mcp-kusto_query"));
        assert!(is_kusto_query_tool("kusto_mcp_kusto_query"));
        assert!(is_kusto_query_tool("kusto_graph_query"));
        assert!(is_kusto_query_tool("foo-bar-kusto_graph_query"));
    }

    #[test]
    fn rejects_other_tools() {
        assert!(!is_kusto_query_tool("kusto_command"));
        assert!(!is_kusto_query_tool("bash"));
        assert!(!is_kusto_query_tool("view"));
        assert!(!is_kusto_query_tool("kusto_describe_database"));
    }
}
