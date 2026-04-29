import { invoke } from "@tauri-apps/api/core";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { type Theme, useThemeStore } from "../store/themeStore";
import { useVaultStore } from "../store/vaultStore";
import type { AppConfig } from "../types";

interface Props {
  onClose: () => void;
}

interface ThemeCard {
  id: Theme;
  label: string;
  description: string;
  swatches: string[];
}

const THEMES: ThemeCard[] = [
  {
    id: "dark",
    label: "Dark",
    description: "Easy on the eyes in low light",
    swatches: ["#161b22", "#2563eb", "#dc2626", "#16a34a", "#f87171"],
  },
  {
    id: "light",
    label: "Light",
    description: "Clean and bright",
    swatches: ["#f6f8fa", "#2563eb", "#b91c1c", "#15803d", "#dc2626"],
  },
  {
    id: "high-contrast",
    label: "High Contrast",
    description: "Maximum legibility, WCAG AAA",
    swatches: ["#000000", "#0078d7", "#ff6600", "#00d5c5", "#ffd700"],
  },
  {
    id: "colorblind",
    label: "Colorblind-safe",
    description: "Okabe-Ito palette, distinct for all vision types",
    swatches: ["#161b22", "#0072b2", "#d55e00", "#009e73", "#cc79a7"],
  },
];

export function SettingsModal({ onClose }: Props) {
  const { theme, setTheme } = useThemeStore();
  const { config, setConfig } = useVaultStore();

  const [localConfig, setLocalConfig] = useState<AppConfig>(
    config ?? {
      auto_lock_seconds: 300,
      minimize_to_tray: true,
      autostart: false,
    }
  );
  const [saving, setSaving] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);

  async function savePreferences() {
    setSaving(true);
    try {
      await invoke("cmd_save_config", { config: localConfig });
      setConfig(localConfig);
      onClose();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters");
      return;
    }
    setPwLoading(true);
    try {
      await invoke("cmd_change_master_password", {
        oldPassword,
        newPassword,
      });
      setPwSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setPwError(String(err).replace(/^Error: /, ""));
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-vault-700 bg-vault-800 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-vault-700 shrink-0">
          <h2 className="font-semibold text-vault-50">Settings</h2>
          <button onClick={onClose} className="btn-ghost p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-7">
          {/* ── Appearance ─────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-vault-400 uppercase tracking-wider mb-3">
              Appearance
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors ${
                    theme === t.id
                      ? "border-accent bg-accent/10"
                      : "border-vault-600 hover:border-vault-500 bg-vault-700/40"
                  }`}
                >
                  {theme === t.id && (
                    <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent">
                      <Check className="h-2.5 w-2.5 text-accent-fg" />
                    </span>
                  )}
                  {/* Swatches */}
                  <div className="flex gap-1">
                    {t.swatches.map((color, i) => (
                      <span
                        key={i}
                        className="h-4 w-4 rounded-full border border-vault-600"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-vault-100">{t.label}</p>
                    <p className="text-xs text-vault-400 mt-0.5 leading-tight">{t.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ── Preferences ────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-vault-400 uppercase tracking-wider mb-3">
              Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Auto-lock after (seconds, 0 = disabled)</label>
                <input
                  type="number"
                  min={0}
                  max={3600}
                  value={localConfig.auto_lock_seconds}
                  onChange={(e) =>
                    setLocalConfig((c) => ({ ...c, auto_lock_seconds: +e.target.value }))
                  }
                  className="input w-36"
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <ToggleSwitch
                  checked={localConfig.minimize_to_tray}
                  onChange={(v) =>
                    setLocalConfig((c) => ({ ...c, minimize_to_tray: v }))
                  }
                />
                <div>
                  <p className="text-sm text-vault-100">Minimize to tray</p>
                  <p className="text-xs text-vault-400">Keep app in system tray when window is closed</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <ToggleSwitch
                  checked={localConfig.autostart}
                  onChange={(v) =>
                    setLocalConfig((c) => ({ ...c, autostart: v }))
                  }
                />
                <div>
                  <p className="text-sm text-vault-100">Launch at login</p>
                  <p className="text-xs text-vault-400">Start PasswordVault automatically when you log in</p>
                </div>
              </label>

              <button
                onClick={savePreferences}
                disabled={saving}
                className="btn-primary text-sm"
              >
                {saving ? "Saving…" : "Save preferences"}
              </button>
            </div>
          </section>

          {/* ── Security ───────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-vault-400 uppercase tracking-wider mb-3">
              Security
            </h3>
            <form onSubmit={changePassword} className="space-y-3">
              <div>
                <label className="label">Current master password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Current password"
                    className="input pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-vault-400 hover:text-vault-200"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">New master password</label>
                <input
                  type={showPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  className="input"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input
                  type={showPw ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="input"
                  required
                />
              </div>

              {pwError && (
                <p className="text-sm text-danger-fg bg-danger/10 border border-danger rounded-md px-3 py-2">
                  {pwError}
                </p>
              )}
              {pwSuccess && (
                <p className="text-sm text-success-fg bg-success/10 border border-success rounded-md px-3 py-2">
                  Master password changed successfully.
                </p>
              )}

              <button
                type="submit"
                disabled={pwLoading || !oldPassword || !newPassword || !confirmPassword}
                className="btn-primary text-sm"
              >
                {pwLoading ? "Changing…" : "Change master password"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        checked ? "bg-accent" : "bg-vault-600"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
