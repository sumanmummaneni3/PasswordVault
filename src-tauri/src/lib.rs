mod autostart;
mod commands;
mod crypto;
mod generator;
mod importer;
mod vault;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use vault::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::new())
        .setup(|app| {
            setup_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::cmd_create_vault,
            commands::cmd_open_vault,
            commands::cmd_lock_vault,
            commands::cmd_is_unlocked,
            commands::cmd_get_vault_path,
            commands::cmd_change_master_password,
            commands::cmd_get_entries,
            commands::cmd_add_entry,
            commands::cmd_update_entry,
            commands::cmd_delete_entry,
            commands::cmd_search_entries,
            commands::cmd_toggle_favorite,
            commands::cmd_generate_password,
            commands::cmd_generate_passphrase,
            commands::cmd_import_entries,
            commands::cmd_export_entries,
            commands::cmd_get_config,
            commands::cmd_save_config,
            commands::cmd_enable_autostart,
            commands::cmd_disable_autostart,
            commands::cmd_is_autostart_enabled,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running PasswordVault");
}

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show PasswordVault", true, None::<&str>)?;
    let lock = MenuItem::with_id(app, "lock", "Lock Vault", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &lock, &sep, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("PasswordVault")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "lock" => {
                if let Some(state) = app.try_state::<AppState>() {
                    vault::lock_vault(&state);
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
