"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTheme } from "./theme";

/**
 * Switches between light and dark mode. The icon is chosen by CSS (the `dark:` variant), so the
 * server-rendered button is already correct before React knows the theme: no flash, no mismatch.
 */
export function ThemeToggle({ className }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const label = theme === null ? "Toggle colour theme" : isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-2 hover:text-fg",
        className,
      )}
      aria-label={label}
      title={label}
    >
      {/* Moon in light mode (go dark), sun in dark mode (go light). */}
      <Moon className="size-[1.125rem] dark:hidden" strokeWidth={1.9} aria-hidden="true" />
      <Sun className="hidden size-[1.125rem] dark:block" strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
}
