//! Background AI describer for captured queries.
//!
//! Spins up a short-lived Copilot CLI session and asks a small model to
//! summarise the KQL in one line. The summary is written back to the row's
//! `description` column where it gets indexed alongside the query text for
//! search.
//!
//! Designed to be fired from a background task and to fail silently — the
//! Copilot CLI being missing or unauthenticated, a network blip, or a slow
//! model response should never disrupt ingestion. The query is still
//! captured, just without an AI-generated description.

use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use github_copilot_sdk::{
    Client, ClientOptions, MessageOptions, SessionConfig, SystemMessageConfig,
};

use crate::store::{Store, UpdateQuery};

/// Cheap, fast model — descriptions are short and we run one per ingest.
const MODEL: &str = "gpt-5.4-mini";

/// Total time budget for one description generation, including CLI startup
/// and model response. Generous enough to absorb a cold CLI start but not
/// so long that a hung session blocks the background task forever.
const DESCRIBE_TIMEOUT: Duration = Duration::from_secs(45);

/// Hard cap on how many words we'll keep from the model's reply if it
/// gets verbose. Avoids polluting the FTS index with paragraphs.
const MAX_WORDS: usize = 15;

const SYSTEM_PROMPT: &str = "You are an expert at analyzing Kusto/KQL queries. \
    Generate a concise summary of what the query does in 10 words or less. \
    Focus on the main action and data being queried. Be specific and technical. \
    Respond with the summary only — no preamble, no quotes, no trailing punctuation.";

/// Spawn a background task that asks Copilot to describe `query_text` and
/// saves the result on the row. No-op (with a debug log) if the CLI isn't
/// installed or the session fails for any reason.
pub fn describe_in_background(store: Store, id: i64, query_text: String) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = describe(&store, id, &query_text).await {
            tracing::debug!("AI description skipped for query {id}: {e:#}");
        }
    });
}

async fn describe(store: &Store, id: i64, query_text: &str) -> Result<()> {
    let cleaned = clean_query(query_text);
    if cleaned.is_empty() {
        return Ok(());
    }

    let client = Client::start(ClientOptions::default())
        .await
        .context("failed to start Copilot CLI for AI description")?;

    let config = SessionConfig::default()
        .with_client_name("kuery-describer")
        .with_model(MODEL)
        .with_streaming(false)
        .with_system_message(
            SystemMessageConfig::new()
                .with_mode("replace")
                .with_content(SYSTEM_PROMPT),
        );

    let session = client
        .create_session(config)
        .await
        .context("failed to create Copilot session")?;

    let user_message = format!("Summarize this Kusto/KQL query in 10 words or less:\n\n{cleaned}");

    let result = session
        .send_and_wait(MessageOptions::new(user_message).with_wait_timeout(DESCRIBE_TIMEOUT))
        .await;

    let _ = session.disconnect().await;
    let _ = client.stop().await;

    let final_event = result.context("Copilot session failed during description")?;
    let event = final_event.ok_or_else(|| anyhow!("Copilot returned no assistant message"))?;
    let text = extract_assistant_text(&event)
        .ok_or_else(|| anyhow!("Copilot returned an unexpected event type: {}", event.event_type))?;

    let summary = sanitize_summary(&text);
    if summary.is_empty() {
        return Ok(());
    }

    store.update(
        id,
        &UpdateQuery {
            starred: None,
            description: Some(Some(summary)),
        },
    )?;
    Ok(())
}

/// Pull the assistant text out of the final SessionEvent. Mirrors the
/// extractor in `agent.rs`; the wire shape is the same.
fn extract_assistant_text(event: &github_copilot_sdk::types::SessionEvent) -> Option<String> {
    if let Some(content) = event.data.get("content").and_then(|v| v.as_str()) {
        return Some(content.to_string());
    }
    if let Some(text) = event.data.get("text").and_then(|v| v.as_str()) {
        return Some(text.to_string());
    }
    None
}

/// Trim quotes/punctuation, collapse whitespace, and clamp word count so a
/// chatty model can't blow out the description column.
fn sanitize_summary(raw: &str) -> String {
    let trimmed = raw
        .trim()
        .trim_matches(|c: char| c == '"' || c == '\'' || c == '`')
        .trim_end_matches(|c: char| c == '.' || c == ',' || c == ';');
    let mut words = trimmed.split_whitespace();
    let mut out = String::new();
    for (i, w) in (&mut words).take(MAX_WORDS).enumerate() {
        if i > 0 {
            out.push(' ');
        }
        out.push_str(w);
    }
    out
}

fn clean_query(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut prev_ws = true;
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        // Strip /* ... */ comments
        if c == '/' && chars.peek() == Some(&'*') {
            chars.next();
            while let Some(cc) = chars.next() {
                if cc == '*' && chars.peek() == Some(&'/') {
                    chars.next();
                    break;
                }
            }
            continue;
        }
        // Strip // and -- line comments
        if (c == '/' && chars.peek() == Some(&'/'))
            || (c == '-' && chars.peek() == Some(&'-'))
        {
            while let Some(&cc) = chars.peek() {
                if cc == '\n' { break; }
                chars.next();
            }
            continue;
        }
        if c.is_whitespace() {
            if !prev_ws { out.push(' '); prev_ws = true; }
        } else {
            out.push(c);
            prev_ws = false;
        }
    }
    out.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clean_strips_comments_and_collapses_ws() {
        let q = "  /* a */ T  | where x == 1  // pick rows\n| take   10  -- limit\n";
        assert_eq!(clean_query(q), "T | where x == 1 | take 10");
    }

    #[test]
    fn sanitize_strips_quotes_and_trailing_punctuation() {
        assert_eq!(sanitize_summary("  \"counts errors per service.\"  "), "counts errors per service");
    }

    #[test]
    fn sanitize_clamps_to_max_words() {
        let long = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen";
        let result = sanitize_summary(long);
        assert_eq!(result.split_whitespace().count(), MAX_WORDS);
        assert!(result.starts_with("one two"));
    }
}
