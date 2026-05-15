// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod agent;
mod ai;
mod api;
mod ipc;
mod mcp;
mod store;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_autostart::MacosLauncher;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Stable file name for the persistent log; matched by `LogPaths::file`.
const LOG_FILE_NAME: &str = "kuery.log";

/// Canonical Copilot CLI install command, surfaced in the Settings UI.
pub const COPILOT_PLUGIN_INSTALL_COMMAND: &str =
    "copilot plugin install timrogers/kuery:plugin";

/// Filesystem locations of the persistent logs, made available to IPC commands
/// via Tauri state so the frontend can show / open them.
#[derive(Clone)]
pub struct LogPaths {
    pub dir: std::path::PathBuf,
    pub file: std::path::PathBuf,
}

/// Holds the non-blocking appender's worker guard so it isn't dropped before
/// the app exits (which would silently swallow buffered log lines).
pub struct LoggingGuard(#[allow(dead_code)] tracing_appender::non_blocking::WorkerGuard);

fn show_main_window(app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    }
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

#[cfg(target_os = "macos")]
fn hide_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
    // Drop back to Accessory so the Dock icon and app menu disappear and we
    // become a tray-only background app again.
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
}

#[cfg(not(target_os = "macos"))]
fn hide_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Re-launching the binary just brings the existing window forward.
            show_main_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .setup(|app| {
            // If we were launched by the login-item agent, start hidden in
            // the tray rather than popping the window in the user's face.
            // Otherwise, behave like a normal app on first launch — visible
            // window with a Dock icon — and only drop to Accessory once the
            // user explicitly hides/closes the window.
            let launched_at_login = std::env::args().any(|a| a == "--autostart");
            #[cfg(target_os = "macos")]
            {
                let policy = if launched_at_login {
                    tauri::ActivationPolicy::Accessory
                } else {
                    tauri::ActivationPolicy::Regular
                };
                let _ = app.set_activation_policy(policy);
            }
            if launched_at_login {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.hide();
                }
            }

            let data_dir = app
                .path()
                .app_data_dir()
                .expect("resolving app data dir");
            std::fs::create_dir_all(&data_dir).expect("creating app data dir");

            // Persistent logging — file goes in `<app_data>/logs/kuery.log` so
            // users can open it from the Settings UI for debugging. We keep
            // stderr too so `cargo tauri dev` is still useful.
            let log_dir = data_dir.join("logs");
            std::fs::create_dir_all(&log_dir).expect("creating log dir");
            let file_appender =
                tracing_appender::rolling::never(&log_dir, LOG_FILE_NAME);
            let (file_writer, guard) = tracing_appender::non_blocking(file_appender);
            let env_filter = EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info"));
            let _ = tracing_subscriber::registry()
                .with(env_filter)
                .with(
                    tracing_subscriber::fmt::layer()
                        .with_writer(std::io::stderr)
                        .with_ansi(true),
                )
                .with(
                    tracing_subscriber::fmt::layer()
                        .with_writer(file_writer)
                        .with_ansi(false),
                )
                .try_init();
            app.manage(LoggingGuard(guard));
            let log_file = data_dir.join("logs").join(LOG_FILE_NAME);
            // Touch the log file so users opening it from Settings before any
            // log lines have flushed don't hit a "file not found" error.
            let _ = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_file);
            app.manage(LogPaths {
                dir: log_dir,
                file: log_file,
            });

            tracing::info!(
                version = env!("CARGO_PKG_VERSION"),
                "Kuery starting (launched_at_login={launched_at_login})"
            );

            let db_path = data_dir.join("kuery.sqlite");

            let store = store::Store::open(&db_path).expect("opening sqlite store");
            app.manage(store.clone());

            let api_state = api::ApiState { store };
            tauri::async_runtime::spawn(async move {
                if let Err(e) = api::serve(api_state).await {
                    tracing::error!("HTTP API server failed: {e:#}");
                }
            });

            // Tray icon — primary entry point now that we're Dock-less.
            let open_item = MenuItem::with_id(app, "open", "Open Kuery", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Kuery", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("kuery-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .tooltip("Kuery")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Closing the window should hide it and drop the Dock icon, not
            // quit the app.
            if let Some(win) = app.get_webview_window("main") {
                let app_handle = app.handle().clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        hide_main_window(&app_handle);
                    }
                });
            }

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
            ipc::agent_search,
            ipc::debug_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
