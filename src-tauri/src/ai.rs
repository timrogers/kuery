// Best-effort GitHub Models client that produces a one-line description for a
// captured query and writes it back to the store. Designed to be fired from a
// background task and to fail silently — a missing token, network error, or
// rate-limit response should never disrupt ingestion.

use serde::{Deserialize, Serialize};

use crate::store::{Store, UpdateQuery};

const MODEL: &str = "openai/gpt-4.1";
const ENDPOINT: &str = "https://models.github.ai/inference/chat/completions";
const TOKEN_SETTING: &str = "github_models_token";

const SYSTEM_PROMPT: &str = "You are an expert at analyzing Kusto queries. \
    Generate a concise summary of what the query does in 10 words or less. \
    Focus on the main action and data being queried. Be specific and technical. \
    Respond with the summary only — no preamble, no quotes, no trailing punctuation.";

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<Message<'a>>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Serialize)]
struct Message<'a> {
    role: &'a str,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChoiceMessage,
}

#[derive(Deserialize)]
struct ChoiceMessage {
    content: String,
}

/// Spawn a background task that asks GitHub Models to describe `query_text`
/// and saves the result on the row. No-op if no token is configured.
pub fn describe_in_background(store: Store, id: i64, query_text: String) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = describe(&store, id, &query_text).await {
            tracing::debug!("AI description skipped for query {id}: {e:#}");
        }
    });
}

async fn describe(store: &Store, id: i64, query_text: &str) -> anyhow::Result<()> {
    let token = match store.get_setting(TOKEN_SETTING)? {
        Some(t) if !t.trim().is_empty() => t,
        _ => {
            tracing::debug!("no github_token configured; skipping AI description");
            return Ok(());
        }
    };

    let cleaned = clean_query(query_text);
    if cleaned.is_empty() {
        return Ok(());
    }

    let body = ChatRequest {
        model: MODEL,
        messages: vec![
            Message { role: "system", content: SYSTEM_PROMPT.into() },
            Message {
                role: "user",
                content: format!("Summarize this Kusto query in 10 words or less:\n\n{cleaned}"),
            },
        ],
        max_tokens: 50,
        temperature: 0.1,
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()?;

    let resp = client
        .post(ENDPOINT)
        .bearer_auth(token)
        .header("Accept", "application/json")
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        anyhow::bail!("github models returned HTTP {}", resp.status());
    }

    let parsed: ChatResponse = resp.json().await?;
    let summary = parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content.trim().to_string())
        .filter(|s| !s.is_empty());

    if let Some(summary) = summary {
        store.update(
            id,
            &UpdateQuery {
                starred: None,
                description: Some(Some(summary)),
            },
        )?;
    }
    Ok(())
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
}
