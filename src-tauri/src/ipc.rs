use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::store::{NewQuery, Query, Store, UpdateQuery};

#[derive(Serialize)]
pub struct CommandError {
    message: String,
}

impl<E: std::fmt::Display> From<E> for CommandError {
    fn from(e: E) -> Self {
        Self { message: e.to_string() }
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
pub fn ingest_query(store: State<'_, Store>, query: NewQuery) -> CmdResult<i64> {
    let r = store.ingest(&query)?;
    Ok(r.id)
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
pub fn import_database(app: AppHandle, source_path: String) -> CmdResult<()> {
    let dest = db_path(&app)?;
    let backup = dest.with_extension("sqlite.bak");
    if dest.exists() {
        std::fs::copy(&dest, &backup)?;
    }
    std::fs::copy(&source_path, &dest)?;
    Ok(())
}

fn db_path(app: &AppHandle) -> Result<std::path::PathBuf, CommandError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| CommandError { message: e.to_string() })?;
    Ok(dir.join("kuery.sqlite"))
}
