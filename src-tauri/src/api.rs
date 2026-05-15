use std::net::SocketAddr;

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use serde_json::json;
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
