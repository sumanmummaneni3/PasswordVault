import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { KeyRound, Lock, Plus, FolderOpen, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useVaultStore } from "../store/vaultStore";
import type { VaultEntry } from "../types";

type Mode = "unlock" | "setup" | "create";

export function UnlockScreen() {
  const { vaultPath, setVaultPath, setEntries, setView, view } = useVaultStore();
  const [mode, setMode] = useState<Mode>(view === "setup" ? "setup" : "unlock");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newVaultPath, setNewVaultPath] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const path = vaultPath!;
      const entries = await invoke<VaultEntry[]>("cmd_open_vault", {
        path,
        masterPassword: password,
      });
      setEntries(entries);
      setView("vault");
    } catch (err) {
      setError(String(err).replace(/^Error: /, ""));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Master password must be at least 8 characters");
      return;
    }
    if (!newVaultPath) {
      setError("Choose a location to save your vault");
      return;
    }
    setLoading(true);
    try {
      await invoke("cmd_create_vault", {
        path: newVaultPath,
        masterPassword: password,
      });
      setVaultPath(newVaultPath);
      setEntries([]);
      setView("vault");
    } catch (err) {
      setError(String(err).replace(/^Error: /, ""));
    } finally {
      setLoading(false);
    }
  }

  async function pickExistingVault() {
    const selected = await open({
      title: "Open PasswordVault file",
      filters: [{ name: "PasswordVault", extensions: ["pvlt"] }],
    });
    if (selected && typeof selected === "string") {
      setVaultPath(selected);
      setMode("unlock");
    }
  }

  async function pickNewVaultPath() {
    const selected = await save({
      title: "Save new vault",
      defaultPath: "vault.pvlt",
      filters: [{ name: "PasswordVault", extensions: ["pvlt"] }],
    });
    if (selected) setNewVaultPath(selected);
  }

  return (
    <div className="flex h-full items-center justify-center bg-vault-900 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent mb-3">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-vault-50">PasswordVault</h1>
          <p className="text-sm text-vault-400 mt-1">Your passwords, encrypted.</p>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-lg bg-vault-800 p-1 mb-6 border border-vault-700">
          <button
            className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
              mode !== "create"
                ? "bg-vault-600 text-vault-50"
                : "text-vault-400 hover:text-vault-200"
            }`}
            onClick={() => setMode(vaultPath ? "unlock" : "setup")}
          >
            Unlock Vault
          </button>
          <button
            className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
              mode === "create"
                ? "bg-vault-600 text-vault-50"
                : "text-vault-400 hover:text-vault-200"
            }`}
            onClick={() => setMode("create")}
          >
            New Vault
          </button>
        </div>

        {/* Unlock form */}
        {mode !== "create" && (
          <form onSubmit={handleUnlock} className="space-y-4">
            {/* Vault path */}
            <div>
              <label className="label">Vault file</label>
              <div className="flex gap-2">
                <div className="input flex-1 truncate text-vault-300 text-xs py-2">
                  {vaultPath ? vaultPath.split(/[/\\]/).pop() : "No vault selected"}
                </div>
                <button
                  type="button"
                  onClick={pickExistingVault}
                  className="btn-secondary shrink-0 text-xs px-2"
                >
                  <FolderOpen className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label">Master password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password…"
                  className="input pr-10"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-vault-400 hover:text-vault-200"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-danger-fg bg-danger/10 border border-danger rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !vaultPath || !password}
              className="btn-primary w-full py-2"
            >
              <KeyRound className="h-4 w-4" />
              {loading ? "Unlocking…" : "Unlock"}
            </button>

            <p className="text-center text-xs text-vault-400">
              No vault?{" "}
              <button
                type="button"
                onClick={() => setMode("create")}
                className="text-accent hover:text-accent/80 underline"
              >
                Create one
              </button>
            </p>
          </form>
        )}

        {/* Create vault form */}
        {mode === "create" && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">Save vault to</label>
              <div className="flex gap-2">
                <div className="input flex-1 truncate text-vault-300 text-xs py-2">
                  {newVaultPath
                    ? newVaultPath.split(/[/\\]/).pop()
                    : "Choose location…"}
                </div>
                <button
                  type="button"
                  onClick={pickNewVaultPath}
                  className="btn-secondary shrink-0 text-xs px-2"
                >
                  <FolderOpen className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="label">Master password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a strong master password…"
                  className="input pr-10"
                  autoFocus
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-vault-400 hover:text-vault-200"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrengthBar password={password} />
            </div>

            <div>
              <label className="label">Confirm master password</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat master password…"
                className="input"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-danger-fg bg-danger/10 border border-danger rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <p className="text-xs text-vault-400 bg-vault-700/40 rounded-md p-3 border border-vault-600">
              Your master password cannot be recovered. Store it somewhere safe.
            </p>

            <button
              type="submit"
              disabled={loading || !newVaultPath || !password || !confirmPassword}
              className="btn-primary w-full py-2"
            >
              <Plus className="h-4 w-4" />
              {loading ? "Creating…" : "Create Vault"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function PasswordStrengthBar({ password }: { password: string }) {
  const score = calcStrength(password);
  const labels = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
  const colors = [
    "bg-danger",
    "bg-warn",
    "bg-warn",
    "bg-accent",
    "bg-success",
  ];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= score ? colors[score] : "bg-vault-600"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${score < 2 ? "text-danger-fg" : score < 4 ? "text-warn" : "text-success-fg"}`}>
        {labels[score]}
      </p>
    </div>
  );
}

function calcStrength(pw: string): number {
  if (pw.length < 6) return 0;
  let score = 0;
  if (pw.length >= 12) score++;
  if (pw.length >= 20) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score);
}
