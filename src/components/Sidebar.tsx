import type { ReactNode } from "react";
import {
  Download,
  Heart,
  KeyRound,
  Lock,
  Plus,
  Search,
  Settings,
  Shield,
  Tag,
} from "lucide-react";
import { useMemo } from "react";
import { useVaultStore } from "../store/vaultStore";

interface Props {
  onOpenGenerator: () => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ onOpenGenerator, onOpenImport, onOpenSettings }: Props) {
  const {
    entries,
    searchQuery,
    filterCategory,
    filterFavorites,
    setSearch,
    setFilterCategory,
    setFilterFavorites,
    lock,
  } = useVaultStore();

  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const e of entries) {
      if (e.category) {
        cats.set(e.category, (cats.get(e.category) ?? 0) + 1);
      }
    }
    return [...cats.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  const favoriteCount = entries.filter((e) => e.favorite).length;

  function handleNewEntry() {
    const store = useVaultStore.getState();
    const blank = {
      id: "__new__",
      title: "",
      username: "",
      password: "",
      urls: [],
      notes: undefined,
      tags: [],
      category: undefined,
      favorite: false,
      password_history: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.addEntry(blank);
    store.selectEntry("__new__");
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-vault-700 bg-vault-800">
      {/* App header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-vault-700">
        <Shield className="h-5 w-5 text-accent shrink-0" />
        <span className="font-semibold text-vault-50 text-sm">PasswordVault</span>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-vault-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="input pl-8 text-xs py-1.5"
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        <SidebarItem
          icon={<KeyRound className="h-4 w-4" />}
          label="All Items"
          count={entries.length}
          active={!filterCategory && !filterFavorites}
          onClick={() => {
            setFilterCategory(null);
            setFilterFavorites(false);
          }}
        />
        <SidebarItem
          icon={<Heart className="h-4 w-4" />}
          label="Favorites"
          count={favoriteCount}
          active={filterFavorites}
          onClick={() => {
            setFilterFavorites(!filterFavorites);
            setFilterCategory(null);
          }}
        />

        {categories.length > 0 && (
          <>
            <div className="px-2 pt-4 pb-1">
              <span className="text-xs font-medium text-vault-500 uppercase tracking-wider">
                Categories
              </span>
            </div>
            {categories.map(([cat, count]) => (
              <SidebarItem
                key={cat}
                icon={<Tag className="h-4 w-4" />}
                label={cat}
                count={count}
                active={filterCategory === cat}
                onClick={() => {
                  setFilterCategory(filterCategory === cat ? null : cat);
                  setFilterFavorites(false);
                }}
              />
            ))}
          </>
        )}
      </nav>

      {/* Actions */}
      <div className="border-t border-vault-700 p-3 space-y-1">
        <button
          onClick={handleNewEntry}
          className="btn-primary w-full text-xs py-1.5 justify-start"
        >
          <Plus className="h-4 w-4" />
          New Entry
        </button>
        <button
          onClick={onOpenGenerator}
          className="btn-ghost w-full text-xs py-1.5 justify-start"
        >
          <KeyRound className="h-4 w-4" />
          Generator
        </button>
        <button
          onClick={onOpenImport}
          className="btn-ghost w-full text-xs py-1.5 justify-start"
        >
          <Download className="h-4 w-4" />
          Import
        </button>
        <button
          onClick={onOpenSettings}
          className="btn-ghost w-full text-xs py-1.5 justify-start"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>
        <button
          onClick={lock}
          className="btn-ghost w-full text-xs py-1.5 justify-start text-vault-400 hover:text-danger-fg"
        >
          <Lock className="h-4 w-4" />
          Lock Vault
        </button>
      </div>
    </aside>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors text-left ${
        active
          ? "bg-accent/20 text-accent"
          : "text-vault-300 hover:bg-vault-700 hover:text-vault-100"
      }`}
    >
      <span className={active ? "text-accent" : "text-vault-400"}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span
        className={`text-[10px] tabular-nums ${
          active ? "text-accent" : "text-vault-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
