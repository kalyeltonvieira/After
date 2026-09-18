import React, { createContext, useContext, useEffect, useState } from "react";
import { ThemeMode } from "../types";

interface ThemeContextType {
  theme: ThemeMode;
  effectiveTheme: "light" | "dark";
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("after_theme") as ThemeMode | null;
    return saved || "system";
  });

  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = () => {
      let isDark = false;
      if (theme === "dark") {
        isDark = true;
      } else if (theme === "light") {
        isDark = false;
      } else {
        isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }

      setEffectiveTheme(isDark ? "dark" : "light");
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    applyTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (mode: ThemeMode) => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    localStorage.setItem("after_theme", mode);

    const updateTheme = () => {
      setThemeState(mode);
    };

    // Use the browser View Transitions API when available for a smooth,
    // immediate cross-fade of the whole interface during theme changes.
    const startViewTransition = (document as Document & {
      startViewTransition?: (callback: () => void) => { finished: Promise<void> };
    }).startViewTransition;

    if (startViewTransition && !reducedMotion) {
      startViewTransition.call(document, updateTheme);
      return;
    }

    // Fallback for browsers without View Transitions.
    // The temporary class enables color interpolation for the existing
    // Tailwind theme tokens without delaying the actual theme change.
    if (!reducedMotion) {
      root.classList.add("theme-transitioning");
      window.setTimeout(() => root.classList.remove("theme-transitioning"), 320);
    }

    updateTheme();
  };

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
