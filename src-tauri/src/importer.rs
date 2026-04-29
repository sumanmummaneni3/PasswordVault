use crate::vault::VaultEntry;
use chrono::Utc;
use serde::Deserialize;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum ImportError {
    #[error("Unsupported import format: {0}")]
    UnsupportedFormat(String),
    #[error("CSV parse error: {0}")]
    Csv(#[from] csv::Error),
    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("ZIP error: {0}")]
    Zip(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Empty import — no entries found")]
    Empty,
}

impl From<ImportError> for String {
    fn from(e: ImportError) -> String {
        e.to_string()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum ImportFormat {
    /// 1Password CSV export (Title, Username, Password, Notes, URL)
    OnePasswordCsv,
    /// 1Password 1PUX export (ZIP containing export.data JSON)
    OnePasswordUpx,
    /// KeePass CSV / XML export
    KeepassCsv,
    /// Bitwarden CSV export
    BitwardenCsv,
    /// Generic CSV with configurable column mapping
    GenericCsv,
}

impl ImportFormat {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "1password_csv" | "1password-csv" => Some(Self::OnePasswordCsv),
            "1password_upx" | "1pux" | "1password-upx" => Some(Self::OnePasswordUpx),
            "keepass_csv" | "keepass" => Some(Self::KeepassCsv),
            "bitwarden_csv" | "bitwarden" => Some(Self::BitwardenCsv),
            "csv" | "generic" | "generic_csv" => Some(Self::GenericCsv),
            _ => None,
        }
    }
}

pub fn import_from_file(path: &str, format: &str) -> Result<Vec<VaultEntry>, ImportError> {
    let fmt = ImportFormat::from_str(format)
        .ok_or_else(|| ImportError::UnsupportedFormat(format.to_string()))?;

    let content = std::fs::read(path)?;

    let entries = match fmt {
        ImportFormat::OnePasswordCsv => import_1password_csv(&content)?,
        ImportFormat::OnePasswordUpx => import_1password_1pux(&content)?,
        ImportFormat::KeepassCsv => import_keepass_csv(&content)?,
        ImportFormat::BitwardenCsv => import_bitwarden_csv(&content)?,
        ImportFormat::GenericCsv => import_generic_csv(&content)?,
    };

    if entries.is_empty() {
        return Err(ImportError::Empty);
    }

    Ok(entries)
}

fn make_entry(
    title: &str,
    username: &str,
    password: &str,
    url: Option<&str>,
    notes: Option<&str>,
    category: Option<&str>,
) -> VaultEntry {
    let now = Utc::now().to_rfc3339();
    VaultEntry {
        id: Uuid::new_v4().to_string(),
        title: title.to_string(),
        username: username.to_string(),
        password: password.to_string(),
        url: url.filter(|s| !s.is_empty()).map(|s| s.to_string()),
        notes: notes.filter(|s| !s.is_empty()).map(|s| s.to_string()),
        tags: Vec::new(),
        category: category.filter(|s| !s.is_empty()).map(|s| s.to_string()),
        favorite: false,
        created_at: now.clone(),
        updated_at: now,
    }
}

/// 1Password CSV columns: Title, Username, Password, Notes, URL
fn import_1password_csv(content: &[u8]) -> Result<Vec<VaultEntry>, ImportError> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(content);

    let mut entries = Vec::new();
    for result in reader.records() {
        let record = result?;
        let title = record.get(0).unwrap_or("").trim();
        let username = record.get(1).unwrap_or("").trim();
        let password = record.get(2).unwrap_or("").trim();
        let notes = record.get(3).unwrap_or("").trim();
        let url = record.get(4).unwrap_or("").trim();

        if title.is_empty() && username.is_empty() && password.is_empty() {
            continue;
        }
        entries.push(make_entry(title, username, password, Some(url), Some(notes), None));
    }
    Ok(entries)
}

/// 1PUX is a ZIP archive containing export.data (JSON)
fn import_1password_1pux(content: &[u8]) -> Result<Vec<VaultEntry>, ImportError> {
    let cursor = std::io::Cursor::new(content);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| ImportError::Zip(e.to_string()))?;

    let export_data = {
        let mut file = archive
            .by_name("export.data")
            .map_err(|_| ImportError::Zip("Missing export.data in 1PUX archive".to_string()))?;
        let mut buf = Vec::new();
        std::io::Read::read_to_end(&mut file, &mut buf)?;
        buf
    };

    #[derive(Deserialize)]
    struct OnePuxExport {
        accounts: Vec<OnePuxAccount>,
    }
    #[derive(Deserialize)]
    struct OnePuxAccount {
        vaults: Vec<OnePuxVault>,
    }
    #[derive(Deserialize)]
    struct OnePuxVault {
        items: Vec<OnePuxItem>,
    }
    #[derive(Deserialize)]
    struct OnePuxItem {
        item: OnePuxItemDetail,
    }
    #[derive(Deserialize)]
    struct OnePuxItemDetail {
        title: Option<String>,
        #[serde(rename = "categoryUuid")]
        category_uuid: Option<String>,
        login_fields: Option<Vec<OnePuxLoginField>>,
        urls: Option<Vec<OnePuxUrl>>,
        notes: Option<String>,
    }
    #[derive(Deserialize)]
    struct OnePuxLoginField {
        designation: Option<String>,
        value: Option<String>,
    }
    #[derive(Deserialize)]
    struct OnePuxUrl {
        href: Option<String>,
    }

    let parsed: OnePuxExport = serde_json::from_slice(&export_data)?;
    let mut entries = Vec::new();

    for account in parsed.accounts {
        for vault in account.vaults {
            for wrapper in vault.items {
                let item = wrapper.item;
                let title = item.title.as_deref().unwrap_or("Untitled");
                let url = item
                    .urls
                    .as_ref()
                    .and_then(|urls| urls.first())
                    .and_then(|u| u.href.as_deref());
                let notes = item.notes.as_deref();

                let mut username = "";
                let mut password = "";
                if let Some(fields) = &item.login_fields {
                    for f in fields {
                        match f.designation.as_deref() {
                            Some("username") => {
                                username = f.value.as_deref().unwrap_or("")
                            }
                            Some("password") => {
                                password = f.value.as_deref().unwrap_or("")
                            }
                            _ => {}
                        }
                    }
                }

                entries.push(make_entry(title, username, password, url, notes, None));
            }
        }
    }

    Ok(entries)
}

/// KeePass CSV: Title, Username, Password, URL, Notes
fn import_keepass_csv(content: &[u8]) -> Result<Vec<VaultEntry>, ImportError> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(content);

    let headers = reader
        .headers()
        .map(|h| {
            h.iter()
                .map(|s| s.to_lowercase())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let title_idx = col_idx(&headers, &["title", "name"]).unwrap_or(0);
    let user_idx = col_idx(&headers, &["username", "user", "login"]).unwrap_or(1);
    let pass_idx = col_idx(&headers, &["password", "pass", "secret"]).unwrap_or(2);
    let url_idx = col_idx(&headers, &["url", "website"]).unwrap_or(3);
    let notes_idx = col_idx(&headers, &["notes", "comment", "remarks"]).unwrap_or(4);

    let mut entries = Vec::new();
    for result in reader.records() {
        let record = result?;
        let title = record.get(title_idx).unwrap_or("").trim();
        let username = record.get(user_idx).unwrap_or("").trim();
        let password = record.get(pass_idx).unwrap_or("").trim();
        let url = record.get(url_idx).unwrap_or("").trim();
        let notes = record.get(notes_idx).unwrap_or("").trim();
        entries.push(make_entry(title, username, password, Some(url), Some(notes), None));
    }
    Ok(entries)
}

/// Bitwarden CSV: folder, favorite, type, name, notes, fields, reprompt, login_uri,
///                login_username, login_password, login_totp
fn import_bitwarden_csv(content: &[u8]) -> Result<Vec<VaultEntry>, ImportError> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(content);

    let headers: Vec<String> = reader
        .headers()
        .map(|h| h.iter().map(|s| s.to_lowercase()).collect())
        .unwrap_or_default();

    let name_idx = col_idx(&headers, &["name"]).unwrap_or(3);
    let notes_idx = col_idx(&headers, &["notes"]).unwrap_or(4);
    let uri_idx = col_idx(&headers, &["login_uri", "uri"]).unwrap_or(7);
    let user_idx = col_idx(&headers, &["login_username", "username"]).unwrap_or(8);
    let pass_idx = col_idx(&headers, &["login_password", "password"]).unwrap_or(9);
    let folder_idx = col_idx(&headers, &["folder"]).unwrap_or(0);

    let mut entries = Vec::new();
    for result in reader.records() {
        let record = result?;
        let title = record.get(name_idx).unwrap_or("").trim();
        let username = record.get(user_idx).unwrap_or("").trim();
        let password = record.get(pass_idx).unwrap_or("").trim();
        let url = record.get(uri_idx).unwrap_or("").trim();
        let notes = record.get(notes_idx).unwrap_or("").trim();
        let category = record.get(folder_idx).unwrap_or("").trim();
        entries.push(make_entry(
            title,
            username,
            password,
            Some(url),
            Some(notes),
            Some(category),
        ));
    }
    Ok(entries)
}

/// Generic CSV: auto-detects Title/Username/Password/URL/Notes columns by header name.
fn import_generic_csv(content: &[u8]) -> Result<Vec<VaultEntry>, ImportError> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(content);

    let headers: Vec<String> = reader
        .headers()
        .map(|h| h.iter().map(|s| s.to_lowercase()).collect())
        .unwrap_or_default();

    let title_idx = col_idx(&headers, &["title", "name", "site", "service"]);
    let user_idx = col_idx(&headers, &["username", "user", "login", "email"]);
    let pass_idx = col_idx(&headers, &["password", "pass", "secret"]);
    let url_idx = col_idx(&headers, &["url", "uri", "website", "web"]);
    let notes_idx = col_idx(&headers, &["notes", "note", "comment"]);

    let mut entries = Vec::new();
    for result in reader.records() {
        let record = result?;
        let get = |idx: Option<usize>| idx.and_then(|i| record.get(i)).unwrap_or("").trim().to_string();
        entries.push(make_entry(
            &get(title_idx),
            &get(user_idx),
            &get(pass_idx),
            Some(&get(url_idx)),
            Some(&get(notes_idx)),
            None,
        ));
    }
    Ok(entries)
}

/// Exports vault entries to a generic CSV file.
pub fn export_to_csv(entries: &[VaultEntry], path: &str) -> Result<(), ImportError> {
    let mut writer = csv::WriterBuilder::new().from_path(path)?;
    writer.write_record(["Title", "Username", "Password", "URL", "Notes", "Tags", "Category"])?;
    for e in entries {
        writer.write_record([
            &e.title,
            &e.username,
            &e.password,
            e.url.as_deref().unwrap_or(""),
            e.notes.as_deref().unwrap_or(""),
            &e.tags.join(", "),
            e.category.as_deref().unwrap_or(""),
        ])?;
    }
    writer.flush()?;
    Ok(())
}

fn col_idx(headers: &[String], candidates: &[&str]) -> Option<usize> {
    for candidate in candidates {
        if let Some(idx) = headers.iter().position(|h| h == candidate) {
            return Some(idx);
        }
    }
    None
}
