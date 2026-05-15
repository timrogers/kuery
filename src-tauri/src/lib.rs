// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod api;
mod ipc;
mod mcp;
mod store;

use tauri::Manager;
use tracing_subscriber::EnvFilter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("resolving app data dir");
            std::fs::create_dir_all(&data_dir).expect("creating app data dir");
            let db_path = data_dir.join("kuery.sqlite");

            let store = store::Store::open(&db_path).expect("opening sqlite store");
            app.manage(store.clone());

            let api_state = api::ApiState { store };
            tauri::async_runtime::spawn(async move {
                if let Err(e) = api::serve(api_state).await {
                    tracing::error!("HTTP API server failed: {e:#}");
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ipc::search_queries,
            ipc::list_recent_queries,
            ipc::list_starred_queries,
            ipc::get_query,
            ipc::update_query,
            ipc::delete_query,
            ipc::set_setting,
            ipc::get_setting,
            ipc::ingest_query,
            ipc::export_database,
            ipc::import_database,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
