export interface VaultEntry {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  tags: string[];
  category?: string;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  custom_symbols?: string;
  exclude_ambiguous: boolean;
}

export interface PassphraseOptions {
  word_count: number;
  separator: string;
  capitalize: boolean;
  include_number: boolean;
}

export interface AppConfig {
  vault_path?: string;
  auto_lock_seconds: number;
  minimize_to_tray: boolean;
  autostart: boolean;
}

export type AppView = "unlock" | "setup" | "vault";

export type ImportFormat =
  | "1password_csv"
  | "1pux"
  | "keepass_csv"
  | "bitwarden_csv"
  | "csv";
