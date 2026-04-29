import { invoke } from "@tauri-apps/api/core";
import {
  Check,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
  Plus,
  Save,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useVaultStore } from "../store/vaultStore";
import type { VaultEntry } from "../types";
import { GeneratorModal } from "./GeneratorModal";

export function EntryDetail() {
  const {
    selectedId,
    entries,
    selectEntry,
    addEntry,
    updateEntry,
    removeEntry,
  } = useVaultStore();

  const entry = entries.find((e) => e.id === selectedId);

  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [draft, setDraft] = useState<VaultEntry | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setEditing(false);
      setDraft(null);
    } else if (selectedId === "__new__") {
      setEditing(true);
      setDraft({
        id: "__new__",
        title: "",
        username: "",
        password: "",
        url: undefined,
        notes: undefined,
        tags: [],
        category: undefined,
        favorite: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (entry) {
      setDraft({ ...entry });
      setEditing(false);
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!draft) return;

    if (draft.id === "__new__") {
      try {
        const saved = await invoke<VaultEntry>("cmd_add_entry", {
          entry: { ...draft, id: crypto.randomUUID() },
        });
        removeEntry("__new__");
        addEntry(saved);
        selectEntry(saved.id);
        setEditing(false);
      } catch (err) {
        alert(`Failed to save: ${err}`);
      }
    } else {
      try {
        const saved = await invoke<VaultEntry>("cmd_update_entry", {
          entry: draft,
        });
        updateEntry(saved);
        setDraft(saved);
        setEditing(false);
      } catch (err) {
        alert(`Failed to save: ${err}`);
      }
    }
  }

  async function handleDelete() {
    if (!entry || !confirm(`Delete "${entry.title}"?`)) return;
    try {
      await invoke("cmd_delete_entry", { id: entry.id });
      removeEntry(entry.id);
      selectEntry(null);
    } catch (err) {
      alert(`Failed to delete: ${err}`);
    }
  }

  async function handleToggleFavorite() {
    if (!entry) return;
    try {
      const updated = await invoke<VaultEntry>("cmd_toggle_favorite", {
        id: entry.id,
      });
      updateEntry(updated);
    } catch {
      // ignore
    }
  }

  function handleCancel() {
    if (draft?.id === "__new__") {
      removeEntry("__new__");
      selectEntry(null);
    }
    setEditing(false);
    if (entry) setDraft({ ...entry });
  }

  async function copyToClipboard(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore — clipboard access might be restricted
    }
  }

  if (!selectedId || (!entry && draft?.id !== "__new__")) {
    return (
      <div className="flex flex-1 items-center justify-center bg-vault-900">
        <div className="text-center text-vault-500">
          <div className="text-4xl mb-3">🔐</div>
          <p className="text-sm">Select an entry to view details</p>
        </div>
      </div>
    );
  }

  const d = editing ? draft! : entry!;

  return (
    <div className="flex flex-1 flex-col bg-vault-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-vault-700">
        <div className="flex items-center gap-3 min-w-0">
          {editing ? (
            <input
              value={d.title}
              onChange={(e) =>
                setDraft((prev) => prev && { ...prev, title: e.target.value })
              }
              placeholder="Entry title"
              className="input text-lg font-semibold bg-transparent border-transparent focus:border-vault-600 p-0 px-1"
              autoFocus
            />
          ) : (
            <h2 className="text-lg font-semibold text-vault-50 truncate">
              {d.title || "Untitled"}
            </h2>
          )}
          {!editing && entry && (
            <button
              onClick={handleToggleFavorite}
              className={`transition-colors ${
                entry.favorite ? "text-favorite" : "text-vault-500 hover:text-favorite"
              }`}
            >
              <Heart
                className={`h-4 w-4 ${entry.favorite ? "fill-favorite" : ""}`}
              />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 ml-2 shrink-0">
          {editing ? (
            <>
              <button onClick={handleSave} className="btn-primary text-xs py-1 px-2">
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
              <button onClick={handleCancel} className="btn-ghost text-xs py-1 px-2">
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="btn-ghost text-xs py-1 px-2"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="btn-ghost text-xs py-1 px-2 hover:text-danger-fg"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Username */}
        <Field
          label="Username / Email"
          value={d.username}
          editing={editing}
          copyKey="username"
          copied={copied}
          onCopy={() => copyToClipboard(d.username, "username")}
          onChange={(v) =>
            setDraft((prev) => prev && { ...prev, username: v })
          }
        />

        {/* Password */}
        <div>
          <label className="label">Password</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword ? "text" : "password"}
                value={d.password}
                readOnly={!editing}
                onChange={(e) =>
                  setDraft((prev) => prev && { ...prev, password: e.target.value })
                }
                className="input pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-vault-400 hover:text-vault-200"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <CopyButton
              copied={copied === "password"}
              onClick={() => copyToClipboard(d.password, "password")}
            />
            {editing && (
              <button
                type="button"
                onClick={() => setShowGenerator(true)}
                className="btn-secondary text-xs px-2"
                title="Generate password"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* URL */}
        <div>
          <label className="label">URL</label>
          {editing ? (
            <input
              type="url"
              value={d.url ?? ""}
              onChange={(e) =>
                setDraft((prev) =>
                  prev && { ...prev, url: e.target.value || undefined }
                )
              }
              placeholder="https://example.com"
              className="input"
            />
          ) : (
            <div className="input flex items-center">
              {d.url ? (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent/80 flex items-center gap-1 truncate text-sm"
                >
                  {d.url}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <span className="text-vault-500 text-sm">—</span>
              )}
            </div>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="label">Category</label>
          {editing ? (
            <input
              type="text"
              value={d.category ?? ""}
              onChange={(e) =>
                setDraft((prev) =>
                  prev && { ...prev, category: e.target.value || undefined }
                )
              }
              placeholder="e.g. Work, Personal, Finance"
              className="input"
            />
          ) : (
            <div className="input text-sm text-vault-300">
              {d.category || <span className="text-vault-500">—</span>}
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="label">Tags</label>
          {editing ? (
            <input
              type="text"
              value={d.tags.join(", ")}
              onChange={(e) =>
                setDraft((prev) =>
                  prev && {
                    ...prev,
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  }
                )
              }
              placeholder="tag1, tag2, tag3"
              className="input"
            />
          ) : (
            <div className="flex flex-wrap gap-1.5 min-h-[38px] items-center">
              {d.tags.length > 0 ? (
                d.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-vault-700 text-vault-200 border border-vault-600"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-sm text-vault-500">—</span>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes</label>
          {editing ? (
            <textarea
              value={d.notes ?? ""}
              onChange={(e) =>
                setDraft((prev) =>
                  prev && { ...prev, notes: e.target.value || undefined }
                )
              }
              placeholder="Additional notes…"
              rows={4}
              className="input resize-none"
            />
          ) : (
            <div className="input text-sm text-vault-300 whitespace-pre-wrap min-h-[80px]">
              {d.notes || <span className="text-vault-500">—</span>}
            </div>
          )}
        </div>

        {/* Timestamps */}
        {!editing && entry && (
          <div className="pt-2 border-t border-vault-800 text-xs text-vault-500 space-y-1">
            <p>Created: {new Date(entry.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(entry.updated_at).toLocaleString()}</p>
          </div>
        )}
      </div>

      {showGenerator && (
        <GeneratorModal
          onClose={() => setShowGenerator(false)}
          onUse={(pw) => {
            setDraft((prev) => prev && { ...prev, password: pw });
            setShowGenerator(false);
          }}
        />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  editing,
  copyKey,
  copied,
  onCopy,
  onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  copyKey: string;
  copied: string | null;
  onCopy: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        {editing ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input flex-1"
          />
        ) : (
          <div className="input flex-1 text-sm text-vault-200 truncate">
            {value || <span className="text-vault-500">—</span>}
          </div>
        )}
        <CopyButton copied={copied === copyKey} onClick={onCopy} />
      </div>
    </div>
  );
}

function CopyButton({
  copied,
  onClick,
}: {
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn shrink-0 transition-colors px-2 ${
        copied
          ? "bg-success/20 text-success-fg border border-success"
          : "btn-secondary"
      }`}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}
