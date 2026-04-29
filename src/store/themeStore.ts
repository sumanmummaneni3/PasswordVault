import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "dark" | "light" | "high-contrast" | "colorblind";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => {
        document.documentElement.setAttribute("data-theme", theme);
        set({ theme });
      },
    }),
    { name: "pv-theme" }
  )
);

export function initTheme() {
  const theme = useThemeStore.getState().theme;
  document.documentElement.setAttribute("data-theme", theme);
}
