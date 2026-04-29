import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { CheckCircle, FileText, Upload, X } from "lucide-react";
import { useState } from "react";
import { useVaultStore } from "../store/vaultStore";
import type { ImportFormat, VaultEntry } from "../types";

interface Props {
  onClose: () => void;
}

interface FormatOption {
  id: ImportFormat;
  label: string;
  description: string;
  extensions: string[];
}

const FORMATS: FormatOption[] = [
  {
    id: "1password_csv",
    label: "1Password (CSV)",
    description: "Export from 1Password: File → Export → CSV",
    extensions: ["csv"],
  },
  {
    id: "1pux",
    label: "1Password (1PUX)",
    description: "Export from 1Password: File → Export → 1PUX",
    extensions: ["1pux"],
  },
  {
    id: "bitwarden_csv",
    label: "Bitwarden (CSV)",
    description: "Export from Bitwarden: Tools → Export Vault → CSV",
    extensions: ["csv"],
  },
  {
    id: "keepass_csv",
    label: "KeePass (CSV)",
    description: "Export from KeePass: File → Export → CSV",
    extensions: ["csv"],
  },
  {
    id: "csv",
    label: "Generic CSV",
    description: "Any CSV with Title, Username, Password, URL, Notes columns",
    extensions: ["csv"],
  },
];

export function ImportModal({ onClose }: Props) {
  const { setEntries } = useVaultStore();
  const [format, setFormat] = useState<ImportFormat>("1password_csv");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState("");

  const selectedFormat = FORMATS.find((f) => f.id === format)!;

  async function pickFile() {
    const selected = await open({
      title: "Select import file",
      filters: [
        {
          name: selectedFormat.label,
          extensions: selectedFormat.extensions,
        },
      ],
    });
    if (selected && typeof selected === "string") {
      setFilePath(selected);
      setResult(null);
      setError("");
    }
  }

  async function handleImport() {
    if (!filePath) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const count = await invoke<number>("cmd_import_entries", {
        path: filePath,
        format,
      });
      setResult(count);

      // Refresh entries from backend
      const entries = await invoke<VaultEntry[]>("cmd_get_entries");
      setEntries(entries);
    } catch (err) {
      setError(String(err).replace(/^Error: /, ""));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-vault-700 bg-vault-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-vault-700">
          <h2 className="font-semibold text-vault-50">Import Passwords</h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Format selection */}
          <div>
            <label className="label">Import format</label>
            <div className="grid grid-cols-1 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setFormat(f.id);
                    setFilePath(null);
                    setResult(null);
                    setError("");
                  }}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    format === f.id
                      ? "border-accent bg-accent/10"
                      : "border-vault-600 hover:border-vault-500 bg-vault-700/30"
                  }`}
                >
                  <div
                    className={`mt-0.5 h-3.5 w-3.5 rounded-full border-2 shrink-0 transition-colors ${
                      format === f.id
                        ? "border-accent bg-accent"
                        : "border-vault-500"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-vault-100">{f.label}</p>
                    <p className="text-xs text-vault-400 mt-0.5">{f.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* File selection */}
          <div>
            <label className="label">Import file</label>
            <button
              onClick={pickFile}
              className={`w-full rounded-lg border-2 border-dashed px-4 py-6 flex flex-col items-center gap-2 transition-colors ${
                filePath
                  ? "border-accent/50 bg-accent/5"
                  : "border-vault-600 hover:border-vault-500"
              }`}
            >
              {filePath ? (
                <>
                  <FileText className="h-8 w-8 text-accent" />
                  <p className="text-sm text-vault-200 truncate max-w-full px-4">
                    {filePath.split(/[/\\]/).pop()}
                  </p>
                  <p className="text-xs text-vault-400">Click to change</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-vault-400" />
                  <p className="text-sm text-vault-300">Click to select file</p>
                  <p className="text-xs text-vault-500">
                    .{selectedFormat.extensions.join(", .")} accepted
                  </p>
                </>
              )}
            </button>
          </div>

          {/* Success */}
          {result !== null && (
            <div className="flex items-center gap-3 rounded-lg bg-success/10 border border-success px-4 py-3">
              <CheckCircle className="h-5 w-5 text-success-fg shrink-0" />
              <div>
                <p className="text-sm font-medium text-success-fg">Import successful</p>
                <p className="text-xs text-success-fg/70">
                  Added {result} {result === 1 ? "entry" : "entries"} to your vault
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-danger/10 border border-danger px-4 py-3">
              <p className="text-sm text-danger-fg">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-vault-700">
          <button onClick={onClose} className="btn-secondary text-sm">
            {result !== null ? "Done" : "Cancel"}
          </button>
          {result === null && (
            <button
              onClick={handleImport}
              disabled={!filePath || loading}
              className="btn-primary text-sm"
            >
              <Upload className="h-4 w-4" />
              {loading ? "Importing…" : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
