import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { AppConfig, AppView, VaultEntry } from "../types";

interface VaultStore {
  view: AppView;
  entries: VaultEntry[];
  selectedId: string | null;
  searchQuery: string;
  filterCategory: string | null;
  filterFavorites: boolean;
  vaultPath: string | null;
  config: AppConfig | null;

  setView: (view: AppView) => void;
  setEntries: (entries: VaultEntry[]) => void;
  selectEntry: (id: string | null) => void;
  setSearch: (query: string) => void;
  setFilterCategory: (cat: string | null) => void;
  setFilterFavorites: (v: boolean) => void;
  setVaultPath: (path: string | null) => void;
  setConfig: (cfg: AppConfig) => void;

  addEntry: (entry: VaultEntry) => void;
  updateEntry: (entry: VaultEntry) => void;
  removeEntry: (id: string) => void;

  lock: () => void;
}

export const useVaultStore = create<VaultStore>((set) => ({
  view: "unlock",
  entries: [],
  selectedId: null,
  searchQuery: "",
  filterCategory: null,
  filterFavorites: false,
  vaultPath: null,
  config: null,

  setView: (view) => set({ view }),
  setEntries: (entries) => set({ entries }),
  selectEntry: (selectedId) => set({ selectedId }),
  setSearch: (searchQuery) => set({ searchQuery }),
  setFilterCategory: (filterCategory) => set({ filterCategory }),
  setFilterFavorites: (filterFavorites) => set({ filterFavorites }),
  setVaultPath: (vaultPath) => set({ vaultPath }),
  setConfig: (config) => set({ config }),

  addEntry: (entry) =>
    set((state) => ({ entries: [entry, ...state.entries] })),

  updateEntry: (updated) =>
    set((state) => ({
      entries: state.entries.map((e) => (e.id === updated.id ? updated : e)),
    })),

  removeEntry: (id) =>
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  lock: () => {
    invoke("cmd_lock_vault").catch(() => {});
    set({ view: "unlock", entries: [], selectedId: null });
  },
}));

export function filteredEntries(store: VaultStore): VaultEntry[] {
  let list = store.entries;

  if (store.searchQuery.trim()) {
    const q = store.searchQuery.toLowerCase();
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url?.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  if (store.filterFavorites) {
    list = list.filter((e) => e.favorite);
  }

  if (store.filterCategory) {
    list = list.filter((e) => e.category === store.filterCategory);
  }

  return list.sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return a.title.localeCompare(b.title);
  });
}
