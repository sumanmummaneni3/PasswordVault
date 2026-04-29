use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};
use thiserror::Error;
use uuid::Uuid;

use crate::crypto::{self, CryptoError, KEY_LEN};

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("Vault is locked")]
    Locked,
    #[error("Vault not found at path: {0}")]
    NotFound(String),
    #[error("Entry not found: {0}")]
    EntryNotFound(String),
    #[error("Crypto error: {0}")]
    Crypto(#[from] CryptoError),
    #[error("Serialization error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl From<VaultError> for String {
    fn from(e: VaultError) -> String {
        e.to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordHistoryEntry {
    pub password: String,
    pub changed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntry {
    pub id: String,
    pub title: String,
    pub username: String,
    pub password: String,
    /// List of URLs / IPs where this credential is used.
    #[serde(default)]
    pub urls: Vec<String>,
    /// Legacy single-URL field — deserialized only for migration, never written.
    #[serde(skip_serializing, default)]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub notes: Option<String>,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub category: Option<String>,
    pub favorite: bool,
    #[serde(default)]
    pub password_history: Vec<PasswordHistoryEntry>,
    pub created_at: String,
    pub updated_at: String,
}

impl VaultEntry {
    pub fn new(
        title: String,
        username: String,
        password: String,
        urls: Vec<String>,
        notes: Option<String>,
        tags: Vec<String>,
        category: Option<String>,
    ) -> Self {
        let now = Utc::now().to_rfc3339();
        Self {
            id: Uuid::new_v4().to_string(),
            title,
            username,
            password,
            urls,
            url: None,
            notes,
            tags,
            category,
            favorite: false,
            password_history: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultData {
    pub version: u32,
    pub entries: Vec<VaultEntry>,
}

impl VaultData {
    fn new() -> Self {
        Self {
            version: 1,
            entries: Vec::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub vault_path: Option<String>,
    pub auto_lock_seconds: u32,
    pub minimize_to_tray: bool,
    pub autostart: bool,
}

pub struct AppState {
    pub data: Mutex<Option<VaultData>>,
    pub key: Mutex<Option<Box<[u8; KEY_LEN]>>>,
    pub vault_path: Mutex<Option<PathBuf>>,
    pub salt: Mutex<Option<[u8; crypto::SALT_LEN]>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            data: Mutex::new(None),
            key: Mutex::new(None),
            vault_path: Mutex::new(None),
            salt: Mutex::new(None),
        }
    }

    pub fn is_unlocked(&self) -> bool {
        self.key.lock().unwrap().is_some()
    }
}

/// Migrates entries from the old single-`url` format to `urls: Vec<String>`.
fn migrate_entries(entries: &mut Vec<VaultEntry>) {
    for entry in entries.iter_mut() {
        if entry.urls.is_empty() {
            if let Some(ref old_url) = entry.url {
                if !old_url.is_empty() {
                    entry.urls.push(old_url.clone());
                }
            }
        }
    }
}

/// Creates a new vault file at `path` encrypted with `master_password`.
pub fn create_vault(
    path: &Path,
    master_password: &str,
    state: &AppState,
) -> Result<(), VaultError> {
    let salt = crypto::generate_salt();
    let key = crypto::derive_key(master_password, &salt)?;

    let data = VaultData::new();
    let json = serde_json::to_vec(&data)?;
    let encrypted = crypto::encrypt_vault(&key, &salt, &json)?;

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, &encrypted)?;

    *state.data.lock().unwrap() = Some(data);
    *state.key.lock().unwrap() = Some(Box::new(key));
    *state.vault_path.lock().unwrap() = Some(path.to_path_buf());
    *state.salt.lock().unwrap() = Some(salt);

    Ok(())
}

/// Opens an existing vault file and decrypts it with `master_password`.
pub fn open_vault(
    path: &Path,
    master_password: &str,
    state: &AppState,
) -> Result<Vec<VaultEntry>, VaultError> {
    if !path.exists() {
        return Err(VaultError::NotFound(path.display().to_string()));
    }

    let vault_bytes = std::fs::read(path)?;
    let salt = crypto::extract_salt(&vault_bytes)?;
    let key = crypto::derive_key(master_password, &salt)?;
    let json = crypto::decrypt_vault(&key, &vault_bytes)?;
    let mut data: VaultData = serde_json::from_slice(&json)?;

    migrate_entries(&mut data.entries);

    let entries = data.entries.clone();

    *state.data.lock().unwrap() = Some(data);
    *state.key.lock().unwrap() = Some(Box::new(key));
    *state.vault_path.lock().unwrap() = Some(path.to_path_buf());
    *state.salt.lock().unwrap() = Some(salt);

    Ok(entries)
}

/// Locks the vault — zeroes the in-memory key and clears decrypted data.
pub fn lock_vault(state: &AppState) {
    if let Some(mut key) = state.key.lock().unwrap().take() {
        crypto::zeroize_key(&mut key);
    }
    *state.data.lock().unwrap() = None;
}

/// Persists the current vault state to disk.
fn save_vault(state: &AppState) -> Result<(), VaultError> {
    let key_guard = state.key.lock().unwrap();
    let key = key_guard.as_ref().ok_or(VaultError::Locked)?;

    let data_guard = state.data.lock().unwrap();
    let data = data_guard.as_ref().ok_or(VaultError::Locked)?;

    let path_guard = state.vault_path.lock().unwrap();
    let path = path_guard.as_ref().ok_or(VaultError::Locked)?;

    let salt_guard = state.salt.lock().unwrap();
    let salt = salt_guard.as_ref().ok_or(VaultError::Locked)?;

    let json = serde_json::to_vec(data)?;
    let encrypted = crypto::encrypt_vault(key, salt, &json)?;
    std::fs::write(path, &encrypted)?;
    Ok(())
}

pub fn get_entries(state: &AppState) -> Result<Vec<VaultEntry>, VaultError> {
    let guard = state.data.lock().unwrap();
    let data = guard.as_ref().ok_or(VaultError::Locked)?;
    Ok(data.entries.clone())
}

pub fn add_entry(state: &AppState, entry: VaultEntry) -> Result<VaultEntry, VaultError> {
    {
        let mut guard = state.data.lock().unwrap();
        let data = guard.as_mut().ok_or(VaultError::Locked)?;
        data.entries.push(entry.clone());
    }
    save_vault(state)?;
    Ok(entry)
}

pub fn update_entry(state: &AppState, mut updated: VaultEntry) -> Result<VaultEntry, VaultError> {
    {
        let mut guard = state.data.lock().unwrap();
        let data = guard.as_mut().ok_or(VaultError::Locked)?;
        let entry = data
            .entries
            .iter_mut()
            .find(|e| e.id == updated.id)
            .ok_or_else(|| VaultError::EntryNotFound(updated.id.clone()))?;

        // Password changed — push the old one onto the history stack.
        if entry.password != updated.password && !entry.password.is_empty() {
            let mut history = entry.password_history.clone();
            history.push(PasswordHistoryEntry {
                password: entry.password.clone(),
                changed_at: Utc::now().to_rfc3339(),
            });
            updated.password_history = history;
        } else {
            updated.password_history = entry.password_history.clone();
        }

        updated.updated_at = Utc::now().to_rfc3339();
        *entry = updated.clone();
    }
    save_vault(state)?;
    Ok(updated)
}

pub fn delete_entry(state: &AppState, id: &str) -> Result<(), VaultError> {
    {
        let mut guard = state.data.lock().unwrap();
        let data = guard.as_mut().ok_or(VaultError::Locked)?;
        let before = data.entries.len();
        data.entries.retain(|e| e.id != id);
        if data.entries.len() == before {
            return Err(VaultError::EntryNotFound(id.to_string()));
        }
    }
    save_vault(state)?;
    Ok(())
}

pub fn toggle_favorite(state: &AppState, id: &str) -> Result<VaultEntry, VaultError> {
    let entry = {
        let mut guard = state.data.lock().unwrap();
        let data = guard.as_mut().ok_or(VaultError::Locked)?;
        let entry = data
            .entries
            .iter_mut()
            .find(|e| e.id == id)
            .ok_or_else(|| VaultError::EntryNotFound(id.to_string()))?;
        entry.favorite = !entry.favorite;
        entry.updated_at = Utc::now().to_rfc3339();
        entry.clone()
    };
    save_vault(state)?;
    Ok(entry)
}

pub fn search_entries(state: &AppState, query: &str) -> Result<Vec<VaultEntry>, VaultError> {
    let guard = state.data.lock().unwrap();
    let data = guard.as_ref().ok_or(VaultError::Locked)?;
    let q = query.to_lowercase();
    let results = data
        .entries
        .iter()
        .filter(|e| {
            e.title.to_lowercase().contains(&q)
                || e.username.to_lowercase().contains(&q)
                || e.urls.iter().any(|u| u.to_lowercase().contains(&q))
                || e.tags.iter().any(|t| t.to_lowercase().contains(&q))
        })
        .cloned()
        .collect();
    Ok(results)
}

/// Re-encrypts the vault with a new master password.
pub fn change_master_password(
    state: &AppState,
    old_password: &str,
    new_password: &str,
) -> Result<(), VaultError> {
    let salt_guard = state.salt.lock().unwrap();
    let salt = salt_guard.as_ref().ok_or(VaultError::Locked)?;

    let old_key = crypto::derive_key(old_password, salt)?;
    let current_key = state.key.lock().unwrap();
    let key = current_key.as_ref().ok_or(VaultError::Locked)?;
    if old_key != **key {
        return Err(VaultError::Crypto(CryptoError::DecryptionFailed));
    }
    drop(current_key);
    drop(salt_guard);

    let new_salt = crypto::generate_salt();
    let new_key = crypto::derive_key(new_password, &new_salt)?;
    *state.key.lock().unwrap() = Some(Box::new(new_key));
    *state.salt.lock().unwrap() = Some(new_salt);

    save_vault(state)?;
    Ok(())
}

pub fn import_entries(state: &AppState, entries: Vec<VaultEntry>) -> Result<usize, VaultError> {
    let count = entries.len();
    {
        let mut guard = state.data.lock().unwrap();
        let data = guard.as_mut().ok_or(VaultError::Locked)?;
        data.entries.extend(entries);
    }
    save_vault(state)?;
    Ok(count)
}

pub fn load_config(config_dir: &Path) -> AppConfig {
    let path = config_dir.join("config.json");
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_config(config_dir: &Path, config: &AppConfig) -> Result<(), VaultError> {
    std::fs::create_dir_all(config_dir)?;
    let json = serde_json::to_string_pretty(config)?;
    std::fs::write(config_dir.join("config.json"), json)?;
    Ok(())
}
