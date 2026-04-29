import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { UnlockScreen } from "./components/UnlockScreen";
import { VaultView } from "./components/VaultView";
import { initTheme } from "./store/themeStore";
import { useVaultStore } from "./store/vaultStore";
import type { AppConfig, VaultEntry } from "./types";

export default function App() {
  const { view, setView, setVaultPath, setConfig } = useVaultStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const [isUnlocked, config] = await Promise.all([
          invoke<boolean>("cmd_is_unlocked"),
          invoke<AppConfig>("cmd_get_config"),
        ]);

        setConfig(config);

        if (config.vault_path) {
          setVaultPath(config.vault_path);
        }

        if (isUnlocked) {
          const entries = await invoke<VaultEntry[]>("cmd_get_entries");
          useVaultStore.getState().setEntries(entries);
          setView("vault");
        } else if (config.vault_path) {
          setView("unlock");
        } else {
          setView("setup");
        }
      } catch {
        setView("setup");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [setView, setVaultPath, setConfig]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-vault-900">
        <div className="text-vault-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (view === "vault") return <VaultView />;
  return <UnlockScreen />;
}
