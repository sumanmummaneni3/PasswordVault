import { useState } from "react";
import { EntryDetail } from "./EntryDetail";
import { EntryList } from "./EntryList";
import { GeneratorModal } from "./GeneratorModal";
import { ImportModal } from "./ImportModal";
import { SettingsModal } from "./SettingsModal";
import { Sidebar } from "./Sidebar";

export function VaultView() {
  const [showGenerator, setShowGenerator] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex h-full bg-vault-900 overflow-hidden">
      <Sidebar
        onOpenGenerator={() => setShowGenerator(true)}
        onOpenImport={() => setShowImport(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="flex flex-1 min-w-0 overflow-hidden">
        <EntryList />
        <EntryDetail />
      </div>

      {showGenerator && (
        <GeneratorModal onClose={() => setShowGenerator(false)} />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} />
      )}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
