"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThemeMode } from "@game-store/ui";

type ResolvedTheme = "light" | "dark";
type ThemeContextValue = { theme: ThemeMode; resolvedTheme: ResolvedTheme; setTheme: (theme: ThemeMode) => void };
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const storageKey = "game-store-theme";

export function resolveTheme(theme: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === "dark" || theme === "high-contrast-dark") return "dark";
  if (theme === "light" || theme === "high-contrast-light") return "light";
  return systemPrefersDark ? "dark" : "light";
}

export function applyTheme(theme: ThemeMode, root: HTMLElement, systemPrefersDark: boolean): ResolvedTheme {
  const resolvedTheme = resolveTheme(theme, systemPrefersDark);
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.dataset.theme = resolvedTheme;
  root.dataset.contrast = theme.startsWith("high-contrast") ? "high" : "normal";
  return resolvedTheme;
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system" || value === "high-contrast-light" || value === "high-contrast-dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const stored = window.localStorage.getItem(storageKey);
    setSystemPrefersDark(media.matches);
    if (isThemeMode(stored)) setThemeState(stored);
    const onChange = () => setSystemPrefersDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = resolveTheme(theme, systemPrefersDark);
  useEffect(() => { applyTheme(theme, document.documentElement, systemPrefersDark); }, [theme, systemPrefersDark]);
  const setTheme = (nextTheme: ThemeMode) => { window.localStorage.setItem(storageKey, nextTheme); setThemeState(nextTheme); };
  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
