//! Agentic natural-language search backed by the local Copilot CLI via the
//! [`github_copilot_sdk`].
//!
//! The user types something like _"queries about storm events from the last
//! week"_; we spin up a Copilot session, give it a single tool that searches
//! the local store, and ask it to come back with the IDs of the most
//! relevant saved queries. The Tauri command unpacks that response,
//! hydrates the IDs against the store, and returns the full query records
//! to the UI.
//!
//! The CLI is found via the SDK's default resolver (env var → embedded
//! binary → PATH). If the CLI isn't installed or the user isn't logged in,
//! the call returns an error which the UI surfaces as a hint to install
//! Copilot CLI; the rest of the desktop app keeps working without it.

use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, bail, Context, Result};
use github_copilot_sdk::handler::ApproveAllHandler;
use github_copilot_sdk::subscription::RecvError;
use github_copilot_sdk::tool::{define_tool, ToolHandlerRouter};
use github_copilot_sdk::{
    Client, ClientOptions, Error as SdkError, MessageOptions, SessionConfig, SystemMessageConfig,
    ToolResult,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::store::{Query, Store};

/// Type-erased callback for streaming progress events out to the IPC layer.
/// The IPC command wraps a Tauri `Channel<ProgressEvent>`; tests can pass a
/// no-op closure.
pub type ProgressSink = Arc<dyn Fn(ProgressEvent) + Send + Sync>;

/// Best-effort progress notifications surfaced to the UI while a smart
/// search is in flight. Designed to be displayed as a single rolling
/// status line — newer events replace older ones.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ProgressEvent {
    /// Copilot session is being created and the model hasn't replied yet.
    Starting,
    /// The agent issued a `find_queries` tool call. `text` is the search
    /// term it picked (empty string for "list everything").
    Searching { text: String },
    /// The most recent `find_queries` call returned `count` rows.
    SearchedFound { text: String, count: usize },
    /// The model is composing its final reply now.
    Thinking,
}

/// Cap on how many ranked IDs we expect from the agent. Our prompt asks for
/// at most this many, but we also clamp on parse to avoid pathological
/// responses bloating the UI.
const MAX_RESULT_IDS: usize = 25;

/// Cap on how many candidate queries we hand the agent in any single
/// `find_queries` tool call. Keeps the prompt window bounded even when the
/// store grows large.
const TOOL_PAGE_SIZE: i64 = 50;

/// Total time budget for one search end to end. Generous because the CLI
/// has to start, the model has to think, and the agent may issue several
/// `find_queries` tool calls. Also passed to `send_and_wait` so the SDK
/// gives up at the same time we do.
const SEARCH_TIMEOUT: Duration = Duration::from_secs(60);

/// Result of an agentic search — the queries the agent picked, in the
/// order it ranked them.
#[derive(Debug, serde::Serialize)]
pub struct AgentSearchResult {
    pub queries: Vec<Query>,
    /// What the assistant wrote back. Useful as a one-liner explanation in
    /// the UI; not parsed beyond extracting the JSON id list.
    pub assistant_message: String,
}

/// Run a single one-shot agentic search.
///
/// `prompt` is the user's natural-language ask; `store` is the persistent
/// query store. Errors out if the Copilot CLI is unavailable, the agent
/// times out, or its response is unparseable.
///
/// We intentionally don't keep a long-lived Copilot session open in the
/// background — it'd hold a CLI process, sockets, and a handler thread for
/// a feature most users invoke sporadically. Each search spins up a fresh
/// client; the SDK's startup is fast on a cached CLI binary.
pub async fn search(
    store: Store,
    prompt: String,
    progress: ProgressSink,
) -> Result<AgentSearchResult> {
    let prompt = prompt.trim().to_string();
    if prompt.is_empty() {
        bail!("Prompt is empty");
    }

    progress(ProgressEvent::Starting);

    let client = Client::start(ClientOptions::default())
        .await
        .context("failed to start Copilot CLI; install or update it with `npm install -g @github/copilot`")?;

    // Build the toolbox first. The agent only gets the search tool — it
    // can't ingest, update, delete, or hit anything outside the local
    // store.
    let store_for_tool = store.clone();
    let progress_for_tool = progress.clone();
    let router = ToolHandlerRouter::new(
        vec![define_tool(
            "find_queries",
            "Search the user's saved Kusto/KQL queries by free text. Returns up to 50 \
             matching queries per call as a JSON array. Each entry has id, query_text \
             (the KQL), description (free-text summary, may be null), cluster, database, \
             starred (bool), source, and run_count. Call this multiple times with \
             different keywords if the first call doesn't surface a clear match. To get \
             the most-recently-used queries, pass an empty `text` and a higher `limit`.",
            move |_inv, params: FindQueriesParams| {
                let store = store_for_tool.clone();
                let progress = progress_for_tool.clone();
                async move {
                    let limit = params.limit.unwrap_or(20).clamp(1, TOOL_PAGE_SIZE);
                    let text = params.text.unwrap_or_default();
                    progress(ProgressEvent::Searching { text: text.clone() });
                    let search_text = text.clone();
                    let results = tokio::task::spawn_blocking(move || {
                        store.search(&search_text, limit, false)
                    })
                    .await
                    .map_err(tool_error)?
                    .map_err(tool_error)?;
                    progress(ProgressEvent::SearchedFound {
                        text,
                        count: results.len(),
                    });
                    let json = serde_json::to_string(&results).map_err(SdkError::from)?;
                    Ok(ToolResult::Text(json))
                }
            },
        )],
        Arc::new(ApproveAllHandler),
    );

    let tools = router.tools();
    let config = SessionConfig::default()
        .with_handler(Arc::new(router))
        .with_system_message(
            SystemMessageConfig::new()
                .with_mode("replace")
                .with_content(SYSTEM_MESSAGE),
        )
        .with_tools(tools);

    let session = client
        .create_session(config)
        .await
        .context("failed to create Copilot session")?;

    // Forward the SDK's session events into our progress sink so the UI
    // can show "Thinking…" between tool calls. We only emit `Thinking`
    // when the assistant turn starts and there are no tool calls in
    // flight; the tool closure itself owns the "Searching…" / "Found N"
    // messages because it has direct access to the params and counts.
    let event_sub = session.subscribe();
    let progress_for_events = progress.clone();
    let event_task = tokio::spawn(forward_progress_events(event_sub, progress_for_events));

    let user_message = format!(
        "User asked: {prompt}\n\nUse the find_queries tool to look through their saved \
         Kusto queries (try multiple search terms if needed), pick up to {MAX_RESULT_IDS} \
         that best match, and reply with ONLY a JSON object of the shape \
         {{\"ids\":[<id>,<id>,...]}} ordered most-relevant first. If nothing matches, \
         reply with {{\"ids\":[]}}."
    );

    // `send_and_wait` blocks until the session goes idle, returning the
    // last assistant event. We pass the full SEARCH_TIMEOUT so the SDK and
    // our outer expectations agree on the deadline.
    let final_event = session
        .send_and_wait(MessageOptions::new(user_message).with_wait_timeout(SEARCH_TIMEOUT))
        .await
        .context("Copilot session failed")?;

    let _ = session.disconnect().await;
    let _ = client.stop().await;
    event_task.abort();

    let event = final_event.ok_or_else(|| anyhow!("Copilot returned no assistant message"))?;
    let text = extract_assistant_text(&event)
        .ok_or_else(|| anyhow!("Copilot returned an unexpected event type: {}", event.event_type))?;

    let ids = extract_ids(&text)?;
    let queries = tokio::task::spawn_blocking(move || hydrate(&store, &ids))
        .await
        .context("failed to load matched queries")??;

    Ok(AgentSearchResult {
        queries,
        assistant_message: text,
    })
}

/// Drains a session event subscription, emitting `Thinking` whenever the
/// assistant starts a new turn that doesn't immediately hand off to a
/// tool. Runs until the subscription closes (session disconnect) or the
/// task is aborted.
async fn forward_progress_events(
    mut sub: github_copilot_sdk::subscription::EventSubscription,
    progress: ProgressSink,
) {
    loop {
        match sub.recv().await {
            Ok(event) => {
                if event.event_type == "assistant.turn_start" {
                    progress(ProgressEvent::Thinking);
                }
            }
            Err(RecvError::Lagged(_)) => continue,
            Err(RecvError::Closed) => break,
            Err(_) => break,
        }
    }
}

const SYSTEM_MESSAGE: &str = "You help the user search their saved Kusto/KQL queries. \
The user is browsing a desktop app called Kuery. They give you a natural-language \
description of the queries they want; you call the find_queries tool to look them \
up, then reply with a JSON object of matching IDs only. Never invent IDs — only \
return IDs returned by find_queries. Never run queries, never write KQL — your \
only job is to surface saved ones.";

/// Wrap an arbitrary tool-side failure in the SDK's RPC error variant so the
/// CLI surfaces it as a tool-call failure to the agent.
fn tool_error<E: std::fmt::Display>(err: E) -> SdkError {
    SdkError::Rpc {
        code: -32603,
        message: err.to_string(),
    }
}

#[derive(Debug, Deserialize, JsonSchema)]
struct FindQueriesParams {
    /// Free-text search. Substring match against the saved KQL, the
    /// description, the cluster, and the database. Empty string matches
    /// everything (useful for "show me my recent queries").
    text: Option<String>,
    /// Maximum number of matches to return. Defaults to 20, hard-capped at
    /// 50 server-side.
    limit: Option<i64>,
}

/// Pick the assistant text out of the final SessionEvent. We try the
/// typed `content` field first (the documented shape for
/// `assistant.message`) and fall back to scanning common alternatives so
/// we still work if the wire format gains new variants.
fn extract_assistant_text(event: &github_copilot_sdk::types::SessionEvent) -> Option<String> {
    if let Some(content) = event.data.get("content").and_then(|v| v.as_str()) {
        return Some(content.to_string());
    }
    if let Some(text) = event.data.get("text").and_then(|v| v.as_str()) {
        return Some(text.to_string());
    }
    None
}

/// Pull a list of integer IDs out of whatever the assistant wrote back.
/// We try a strict JSON object first, then fall back to a bare JSON
/// array, and finally to a regex-style sweep so a chatty model still
/// gets a usable answer.
fn extract_ids(text: &str) -> Result<Vec<i64>> {
    #[derive(Deserialize)]
    struct Wrapper {
        ids: Vec<i64>,
    }

    if let Some(json_blob) = first_json_blob(text) {
        if let Ok(w) = serde_json::from_str::<Wrapper>(&json_blob) {
            return Ok(clamp(w.ids));
        }
        if let Ok(ids) = serde_json::from_str::<Vec<i64>>(&json_blob) {
            return Ok(clamp(ids));
        }
    }

    // Last-ditch: pull bare integers out of the response. Better than
    // failing entirely on a chatty model.
    let ids: Vec<i64> = text
        .split(|c: char| !c.is_ascii_digit())
        .filter_map(|s| s.parse().ok())
        .collect();
    if ids.is_empty() {
        bail!("Couldn't parse query IDs from agent response: {text}");
    }
    Ok(clamp(ids))
}

fn clamp(mut ids: Vec<i64>) -> Vec<i64> {
    ids.dedup();
    ids.truncate(MAX_RESULT_IDS);
    ids
}

/// Returns the first balanced `{...}` or `[...]` substring, ignoring
/// text outside the braces. Models tend to wrap JSON in markdown fences
/// or chatter around it.
fn first_json_blob(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        let opener = match b {
            b'{' => b'}',
            b'[' => b']',
            _ => continue,
        };
        let mut depth = 0i32;
        let mut in_string = false;
        let mut escaped = false;
        for (j, &c) in bytes.iter().enumerate().skip(i) {
            if in_string {
                if escaped {
                    escaped = false;
                } else if c == b'\\' {
                    escaped = true;
                } else if c == b'"' {
                    in_string = false;
                }
                continue;
            }
            match c {
                b'"' => in_string = true,
                b'{' | b'[' => depth += 1,
                b'}' | b']' => {
                    depth -= 1;
                    if depth == 0 && c == opener {
                        return Some(text[i..=j].to_string());
                    }
                }
                _ => {}
            }
        }
    }
    None
}

fn hydrate(store: &Store, ids: &[i64]) -> Result<Vec<Query>> {
    let mut out = Vec::with_capacity(ids.len());
    for &id in ids {
        if let Some(q) = store.get(id)? {
            out.push(q);
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_id_object() {
        let ids = extract_ids("here you go: {\"ids\":[3,7,2]} thanks").unwrap();
        assert_eq!(ids, vec![3, 7, 2]);
    }

    #[test]
    fn extracts_bare_array() {
        let ids = extract_ids("[1, 2, 3]").unwrap();
        assert_eq!(ids, vec![1, 2, 3]);
    }

    #[test]
    fn extracts_from_markdown_fences() {
        let ids = extract_ids("Sure!\n```json\n{\"ids\": [42]}\n```\n").unwrap();
        assert_eq!(ids, vec![42]);
    }

    #[test]
    fn falls_back_to_integers() {
        let ids = extract_ids("ids 9 and 17").unwrap();
        assert_eq!(ids, vec![9, 17]);
    }

    #[test]
    fn clamps_results() {
        let huge: Vec<i64> = (0..100).collect();
        let json = format!("{{\"ids\": {huge:?}}}");
        let ids = extract_ids(&json).unwrap();
        assert_eq!(ids.len(), MAX_RESULT_IDS);
        assert_eq!(ids[0], 0);
    }
}
