import { Heart, KeyRound } from "lucide-react";
import { filteredEntries, useVaultStore } from "../store/vaultStore";
import type { VaultEntry } from "../types";

export function EntryList() {
  const store = useVaultStore();
  const { selectedId, selectEntry, searchQuery } = store;
  const entries = filteredEntries(store);

  function getFaviconUrl(url?: string): string | null {
    if (!url) return null;
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
    } catch {
      return null;
    }
  }

  return (
    <div className="flex w-72 shrink-0 flex-col border-r border-vault-700 bg-vault-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-vault-700">
        <span className="text-xs font-medium text-vault-300">
          {entries.length} {entries.length === 1 ? "item" : "items"}
        </span>
      </div>

      {entries.length === 0 ? (
        <EmptyState searchQuery={searchQuery} />
      ) : (
        <ul className="flex-1 overflow-y-auto divide-y divide-vault-800">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              selected={entry.id === selectedId}
              favicon={getFaviconUrl(entry.url)}
              onClick={() => selectEntry(entry.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  selected,
  favicon,
  onClick,
}: {
  entry: VaultEntry;
  selected: boolean;
  favicon: string | null;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
          selected ? "bg-accent/15 border-l-2 border-accent" : "hover:bg-vault-800"
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-vault-700 overflow-hidden">
          {favicon ? (
            <img
              src={favicon}
              alt=""
              className="h-5 w-5 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <KeyRound className="h-4 w-4 text-vault-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="truncate text-sm font-medium text-vault-100">
              {entry.title || "Untitled"}
            </p>
            {entry.favorite && (
              <Heart className="h-3 w-3 text-favorite shrink-0 fill-favorite" />
            )}
          </div>
          <p className="truncate text-xs text-vault-400 mt-0.5">
            {entry.username || entry.url || "—"}
          </p>
        </div>
      </button>
    </li>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      {searchQuery ? (
        <>
          <p className="text-sm text-vault-300">No results</p>
          <p className="text-xs text-vault-500 mt-1">
            No entries match "{searchQuery}"
          </p>
        </>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-vault-800 mb-3">
            <KeyRound className="h-6 w-6 text-vault-400" />
          </div>
          <p className="text-sm font-medium text-vault-300">Vault is empty</p>
          <p className="text-xs text-vault-500 mt-1">
            Click <strong>New Entry</strong> to add your first password
          </p>
        </>
      )}
    </div>
  );
}
