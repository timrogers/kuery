use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::store::{ImportSummary, NewQuery, Query, Store, UpdateQuery};

#[derive(Serialize)]
pub struct CommandError {
    message: String,
}

impl<E: std::fmt::Display> From<E> for CommandError {
    fn from(e: E) -> Self {
        Self {
            message: e.to_string(),
        }
    }
}

type CmdResult<T> = Result<T, CommandError>;

#[derive(Deserialize)]
pub struct SearchArgs {
    pub query: String,
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub starred_only: bool,
}

fn default_limit() -> i64 {
    100
}

#[tauri::command]
pub fn search_queries(store: State<'_, Store>, args: SearchArgs) -> CmdResult<Vec<Query>> {
    Ok(store.search(&args.query, args.limit, args.starred_only)?)
}

#[tauri::command]
pub fn list_recent_queries(store: State<'_, Store>, limit: Option<i64>) -> CmdResult<Vec<Query>> {
    Ok(store.list_recent(limit.unwrap_or(100))?)
}

#[tauri::command]
pub fn list_starred_queries(store: State<'_, Store>, limit: Option<i64>) -> CmdResult<Vec<Query>> {
    Ok(store.list_starred(limit.unwrap_or(100))?)
}

#[tauri::command]
pub fn get_query(store: State<'_, Store>, id: i64) -> CmdResult<Option<Query>> {
    Ok(store.get(id)?)
}

#[tauri::command]
pub fn update_query(
    store: State<'_, Store>,
    id: i64,
    patch: UpdateQuery,
) -> CmdResult<Option<Query>> {
    Ok(store.update(id, &patch)?)
}

#[tauri::command]
pub fn delete_query(store: State<'_, Store>, id: i64) -> CmdResult<bool> {
    Ok(store.delete(id)?)
}

#[tauri::command]
pub fn set_setting(store: State<'_, Store>, key: String, value: Option<String>) -> CmdResult<()> {
    store.set_setting(&key, value.as_deref())?;
    Ok(())
}

#[tauri::command]
pub fn get_setting(store: State<'_, Store>, key: String) -> CmdResult<Option<String>> {
    Ok(store.get_setting(&key)?)
}

#[tauri::command]
pub fn ingest_query(store: State<'_, Store>, query: NewQuery) -> CmdResult<Option<i64>> {
    let Some(r) = store.ingest(&query)? else {
        return Ok(None);
    };
    if r.created {
        crate::ai::describe_in_background(store.inner().clone(), r.id, query.query_text.clone());
    }
    Ok(Some(r.id))
}

#[tauri::command]
pub fn export_database(app: AppHandle, dest_path: String) -> CmdResult<()> {
    let src = db_path(&app)?;
    std::fs::copy(&src, &dest_path).map_err(|e| CommandError {
        message: format!("copy failed: {e}"),
    })?;
    Ok(())
}

#[tauri::command]
pub fn import_database(
    store: State<'_, Store>,
    app: AppHandle,
    source_path: String,
) -> CmdResult<ImportSummary> {
    // Belt-and-braces: keep a copy of the live db before merging.
    let dest = db_path(&app)?;
    if dest.exists() {
        let backup = dest.with_extension("sqlite.bak");
        std::fs::copy(&dest, &backup).map_err(|e| CommandError {
            message: format!("backup failed: {e}"),
        })?;
    }
    let summary = store
        .import_legacy(std::path::Path::new(&source_path))
        .map_err(|e| CommandError {
            message: e.to_string(),
        })?;
    Ok(summary)
}

fn db_path(app: &AppHandle) -> Result<std::path::PathBuf, CommandError> {
    let dir = app.path().app_data_dir().map_err(|e| CommandError {
        message: e.to_string(),
    })?;
    Ok(dir.join("kuery.sqlite"))
}

#[tauri::command]
pub async fn agent_search(
    store: State<'_, Store>,
    prompt: String,
    on_progress: tauri::ipc::Channel<crate::agent::ProgressEvent>,
) -> CmdResult<crate::agent::AgentSearchResult> {
    // Clone out of `State` so we can move into the spawned future without
    // borrowing the request guard across await points.
    let store = store.inner().clone();
    let progress: crate::agent::ProgressSink = std::sync::Arc::new(move |event| {
        // Channel send only fails if the JS handle has been dropped — at
        // worst we lose UI progress updates, the search itself is
        // unaffected.
        let _ = on_progress.send(event);
    });
    crate::agent::search(store, prompt, progress)
        .await
        .map_err(|e| CommandError {
            message: e.to_string(),
        })
}

#[derive(Serialize)]
pub struct DebugInfo {
    pub log_file: String,
    pub log_dir: String,
    pub install_command: String,
    pub chrome_extension_path: Option<String>,
}

#[tauri::command]
pub fn debug_info(paths: State<'_, crate::LogPaths>) -> CmdResult<DebugInfo> {
    Ok(DebugInfo {
        log_file: paths.file.to_string_lossy().to_string(),
        log_dir: paths.dir.to_string_lossy().to_string(),
        install_command: crate::copilot_plugin_install_command(),
        chrome_extension_path: crate::chrome_extension_path(),
    })
}

#[tauri::command]
pub async fn copilot_cli_status() -> CmdResult<crate::copilot_cli::CopilotCliStatus> {
    Ok(crate::copilot_cli::check().await)
}

#[tauri::command]
pub fn export_queries_csv(
    store: State<'_, Store>,
    dest_path: String,
    cluster_filter: Option<String>,
) -> CmdResult<usize> {
    Ok(store.export_queries_csv(&dest_path, cluster_filter.as_deref())?)
}
