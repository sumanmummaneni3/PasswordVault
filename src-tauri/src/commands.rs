use crate::{
    autostart,
    generator::{generate_password, generate_passphrase, PassphraseOptions, PasswordOptions},
    importer::{export_to_csv, import_from_file},
    vault::{
        self, add_entry, change_master_password, create_vault, delete_entry, get_entries,
        import_entries, load_config, open_vault, save_config, search_entries, toggle_favorite,
        update_entry, AppConfig, AppState, VaultEntry,
    },
};
use tauri::{AppHandle, Manager, State};

fn config_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))
}

// ──────────────────────────────────────────────────────────────────────────────
// Vault lifecycle
// ──────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cmd_create_vault(
    app: AppHandle,
    path: String,
    master_password: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let vault_path = std::path::Path::new(&path);
    create_vault(vault_path, &master_password, &state).map_err(String::from)?;

    // Persist vault path in config
    let dir = config_dir(&app)?;
    let mut cfg = load_config(&dir);
    cfg.vault_path = Some(path.clone());
    save_config(&dir, &cfg).map_err(String::from)?;

    Ok(())
}

#[tauri::command]
pub async fn cmd_open_vault(
    app: AppHandle,
    path: String,
    master_password: String,
    state: State<'_, AppState>,
) -> Result<Vec<VaultEntry>, String> {
    let vault_path = std::path::Path::new(&path);
    let entries = open_vault(vault_path, &master_password, &state).map_err(String::from)?;

    // Remember vault path
    let dir = config_dir(&app)?;
    let mut cfg = load_config(&dir);
    cfg.vault_path = Some(path.clone());
    save_config(&dir, &cfg).map_err(String::from)?;

    Ok(entries)
}

#[tauri::command]
pub fn cmd_lock_vault(state: State<'_, AppState>) {
    vault::lock_vault(&state);
}

#[tauri::command]
pub fn cmd_is_unlocked(state: State<'_, AppState>) -> bool {
    state.is_unlocked()
}

#[tauri::command]
pub fn cmd_get_vault_path(app: AppHandle) -> Option<String> {
    config_dir(&app)
        .ok()
        .and_then(|d| load_config(&d).vault_path)
}

#[tauri::command]
pub async fn cmd_change_master_password(
    old_password: String,
    new_password: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    change_master_password(&state, &old_password, &new_password).map_err(String::from)
}

// ──────────────────────────────────────────────────────────────────────────────
// CRUD
// ──────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn cmd_get_entries(state: State<'_, AppState>) -> Result<Vec<VaultEntry>, String> {
    get_entries(&state).map_err(String::from)
}

#[tauri::command]
pub async fn cmd_add_entry(
    entry: VaultEntry,
    state: State<'_, AppState>,
) -> Result<VaultEntry, String> {
    add_entry(&state, entry).map_err(String::from)
}

#[tauri::command]
pub async fn cmd_update_entry(
    entry: VaultEntry,
    state: State<'_, AppState>,
) -> Result<VaultEntry, String> {
    update_entry(&state, entry).map_err(String::from)
}

#[tauri::command]
pub async fn cmd_delete_entry(id: String, state: State<'_, AppState>) -> Result<(), String> {
    delete_entry(&state, &id).map_err(String::from)
}

#[tauri::command]
pub fn cmd_search_entries(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<VaultEntry>, String> {
    search_entries(&state, &query).map_err(String::from)
}

#[tauri::command]
pub async fn cmd_toggle_favorite(
    id: String,
    state: State<'_, AppState>,
) -> Result<VaultEntry, String> {
    toggle_favorite(&state, &id).map_err(String::from)
}

// ──────────────────────────────────────────────────────────────────────────────
// Generator
// ──────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn cmd_generate_password(options: PasswordOptions) -> Result<String, String> {
    generate_password(&options).map_err(String::from)
}

#[tauri::command]
pub fn cmd_generate_passphrase(options: PassphraseOptions) -> Result<String, String> {
    generate_passphrase(&options).map_err(String::from)
}

// ──────────────────────────────────────────────────────────────────────────────
// Import / Export
// ──────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cmd_import_entries(
    path: String,
    format: String,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let parsed = import_from_file(&path, &format).map_err(String::from)?;
    let count = parsed.len();
    import_entries(&state, parsed).map_err(String::from)?;
    Ok(count)
}

#[tauri::command]
pub async fn cmd_export_entries(
    path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let entries = get_entries(&state).map_err(String::from)?;
    export_to_csv(&entries, &path).map_err(String::from)
}

// ──────────────────────────────────────────────────────────────────────────────
// Settings / Config
// ──────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn cmd_get_config(app: AppHandle) -> Result<AppConfig, String> {
    let dir = config_dir(&app)?;
    Ok(load_config(&dir))
}

#[tauri::command]
pub async fn cmd_save_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    let dir = config_dir(&app)?;
    save_config(&dir, &config).map_err(String::from)
}

// ──────────────────────────────────────────────────────────────────────────────
// Autostart
// ──────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn cmd_enable_autostart() -> Result<(), String> {
    autostart::enable()
}

#[tauri::command]
pub fn cmd_disable_autostart() -> Result<(), String> {
    autostart::disable()
}

#[tauri::command]
pub fn cmd_is_autostart_enabled() -> bool {
    autostart::is_enabled()
}
