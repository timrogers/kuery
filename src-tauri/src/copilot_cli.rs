//! Detects whether the GitHub Copilot CLI is installed and reachable.
//!
//! Reused by the welcome flow and the Settings panel to surface a clear
//! "✓ installed / ⚠ missing" status, since most of Kuery's intelligent
//! features (AI descriptions, smart search, the capture plugin) silently
//! degrade without it.
//!
//! We piggy-back on the SDK's resolver
//! ([`github_copilot_sdk::resolve::copilot_binary`]) so we follow the
//! exact same precedence the SDK uses at runtime: `COPILOT_CLI_PATH`,
//! the embedded CLI, then `PATH` and common install locations.

use serde::Serialize;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

/// Result of a Copilot CLI presence/health check.
#[derive(Serialize, Clone, Debug)]
pub struct CopilotCliStatus {
    /// True if the binary is on disk *and* responded to `--version`.
    pub installed: bool,
    /// Resolved path to the binary, if found.
    pub path: Option<String>,
    /// Trimmed first line of `copilot --version` output, if it ran.
    pub version: Option<String>,
    /// Human-readable error suitable for showing in the UI when
    /// `installed` is false.
    pub error: Option<String>,
}

/// Run the resolver + a short `--version` probe. Never panics; returns
/// `installed: false` with a populated `error` on any failure.
pub async fn check() -> CopilotCliStatus {
    let path = match github_copilot_sdk::resolve::copilot_binary() {
        Ok(p) => p,
        Err(e) => {
            return CopilotCliStatus {
                installed: false,
                path: None,
                version: None,
                error: Some(format!("Couldn't find the Copilot CLI: {e}")),
            };
        }
    };

    let path_str = path.to_string_lossy().to_string();

    // The CLI itself is the source of truth — `--version` proves the
    // binary actually executes, isn't a stale symlink, etc. We cap it
    // at 5s so a hung binary can't freeze the welcome flow.
    let probe = Command::new(&path).arg("--version").output();
    let output = match timeout(Duration::from_secs(5), probe).await {
        Ok(Ok(o)) => o,
        Ok(Err(e)) => {
            return CopilotCliStatus {
                installed: false,
                path: Some(path_str),
                version: None,
                error: Some(format!("Found the Copilot CLI but couldn't run it: {e}")),
            };
        }
        Err(_) => {
            return CopilotCliStatus {
                installed: false,
                path: Some(path_str),
                version: None,
                error: Some("Copilot CLI didn't respond to `--version` within 5s".to_string()),
            };
        }
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return CopilotCliStatus {
            installed: false,
            path: Some(path_str),
            version: None,
            error: Some(format!(
                "`copilot --version` exited with {}: {}",
                output.status,
                if stderr.is_empty() {
                    "(no output)"
                } else {
                    &stderr
                }
            )),
        };
    }

    let version = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()
        .map(|l| l.trim().to_string())
        .filter(|s| !s.is_empty());

    CopilotCliStatus {
        installed: true,
        path: Some(path_str),
        version,
        error: None,
    }
}
