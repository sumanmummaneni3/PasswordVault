use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use rand_core::OsRng;
use thiserror::Error;
use zeroize::Zeroize;

const MAGIC: &[u8; 4] = b"PVLT";
const FORMAT_VERSION: u16 = 1;

pub const SALT_LEN: usize = 32;
pub const NONCE_LEN: usize = 12;
pub const KEY_LEN: usize = 32;

// Header layout: MAGIC(4) + VERSION(2) + SALT(32) + NONCE(12) + LEN(4) = 54 bytes
const HEADER_LEN: usize = 4 + 2 + SALT_LEN + NONCE_LEN + 4;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("Invalid vault file format")]
    InvalidMagic,
    #[error("Unsupported vault version: {0}")]
    UnsupportedVersion(u16),
    #[error("Key derivation failed")]
    KeyDerivation,
    #[error("Decryption failed — wrong master password or corrupted vault")]
    DecryptionFailed,
    #[error("Encryption failed")]
    EncryptionFailed,
    #[error("Vault file is truncated")]
    Truncated,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Derives a 256-bit AES key from the master password using Argon2id.
/// Parameters are tuned for ~300ms on a typical 2024 desktop.
pub fn derive_key(password: &str, salt: &[u8; SALT_LEN]) -> Result<[u8; KEY_LEN], CryptoError> {
    // 64 MiB memory, 3 iterations, 4-way parallelism → ~300ms on modern hardware
    let params = Params::new(65536, 3, 4, Some(KEY_LEN)).map_err(|_| CryptoError::KeyDerivation)?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|_| CryptoError::KeyDerivation)?;
    Ok(key)
}

pub fn generate_salt() -> [u8; SALT_LEN] {
    use rand_core::RngCore;
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    salt
}

/// Serialises plaintext JSON bytes into an encrypted vault binary blob.
/// Format: MAGIC(4) | VERSION(2 LE) | SALT(32) | NONCE(12) | CIPHERTEXT_LEN(4 LE) | CIPHERTEXT
pub fn encrypt_vault(
    key: &[u8; KEY_LEN],
    salt: &[u8; SALT_LEN],
    plaintext: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    let aes_key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(aes_key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|_| CryptoError::EncryptionFailed)?;

    let mut out = Vec::with_capacity(HEADER_LEN + ciphertext.len());
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&FORMAT_VERSION.to_le_bytes());
    out.extend_from_slice(salt);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&(ciphertext.len() as u32).to_le_bytes());
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Decrypts a vault binary blob and returns the plaintext JSON bytes.
/// Returns `Err(CryptoError::DecryptionFailed)` if the key is wrong (AES-GCM tag mismatch).
pub fn decrypt_vault(key: &[u8; KEY_LEN], vault_bytes: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if vault_bytes.len() < HEADER_LEN {
        return Err(CryptoError::Truncated);
    }

    if &vault_bytes[0..4] != MAGIC {
        return Err(CryptoError::InvalidMagic);
    }

    let version = u16::from_le_bytes([vault_bytes[4], vault_bytes[5]]);
    if version != FORMAT_VERSION {
        return Err(CryptoError::UnsupportedVersion(version));
    }

    let salt_end = 6 + SALT_LEN;
    let nonce_end = salt_end + NONCE_LEN;
    let len_end = nonce_end + 4;

    let nonce_bytes = &vault_bytes[salt_end..nonce_end];
    let payload_len = u32::from_le_bytes(
        vault_bytes[nonce_end..len_end]
            .try_into()
            .map_err(|_| CryptoError::Truncated)?,
    ) as usize;

    if vault_bytes.len() < len_end + payload_len {
        return Err(CryptoError::Truncated);
    }

    let ciphertext = &vault_bytes[len_end..len_end + payload_len];

    let aes_key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(aes_key);
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::DecryptionFailed)
}

/// Extracts the Argon2 salt from a vault blob (needed to re-derive key for password change).
pub fn extract_salt(vault_bytes: &[u8]) -> Result<[u8; SALT_LEN], CryptoError> {
    if vault_bytes.len() < HEADER_LEN {
        return Err(CryptoError::Truncated);
    }
    if &vault_bytes[0..4] != MAGIC {
        return Err(CryptoError::InvalidMagic);
    }
    let mut salt = [0u8; SALT_LEN];
    salt.copy_from_slice(&vault_bytes[6..6 + SALT_LEN]);
    Ok(salt)
}

/// Zeroises a key buffer — call this when locking the vault.
pub fn zeroize_key(key: &mut [u8; KEY_LEN]) {
    key.zeroize();
}
