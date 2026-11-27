"use client";

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";

/**
 * Light / dark theme.
 *
 * The theme lives on <html data-theme="light|dark">. An inline script in app/layout.js sets it during
 * HTML parsing, before the first paint, so there is no flash. React only reads it through this store.
 *
 * Resolution order: the user's saved choice (localStorage), otherwise the system preference
 * (prefers-color-scheme), which is followed live until the user picks a theme themselves.
 */
export const THEME_STORAGE_KEY = "ss-theme";

/** Runs in <head> before paint. Kept tiny and dependency-free; mirrors resolveTheme() below. */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.setAttribute("data-theme",t);d.style.colorScheme=t}catch(e){}})()`;

const listeners = new Set();
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function storedTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function resolveTheme() {
  return storedTheme() || (darkQuery().matches ? "dark" : "light");
}

function applyTheme(theme, { animate = false } = {}) {
  const root = document.documentElement;
  if (animate) {
    // Colours ease for a moment so the switch is smooth; layout and motion are untouched.
    root.setAttribute("data-theme-switching", "");
    window.setTimeout(() => root.removeAttribute("data-theme-switching"), 220);
  }
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  // Follow the operating system only while the user has not chosen a theme.
  const media = darkQuery();
  const onSystemChange = () => {
    if (!storedTheme()) applyTheme(resolveTheme());
  };
  // Keep tabs in sync when the choice changes in another window.
  const onStorage = (event) => {
    if (event.key === THEME_STORAGE_KEY) applyTheme(resolveTheme());
  };
  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
// The server cannot know the theme; null means "not known yet" and renders theme-neutral markup.
const getServerSnapshot = () => null;

/** Current theme ("light" | "dark", or null before hydration) and a setter that persists the choice. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // In development React's Strict Mode remount resets <html> attributes; put the theme back before paint.
  useLayoutEffect(() => {
    if (document.documentElement.getAttribute("data-theme") !== resolveTheme()) applyTheme(resolveTheme());
  }, []);

  const setTheme = useCallback((next) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be blocked (private mode); the theme still applies for this visit.
    }
    applyTheme(next, { animate: true });
  }, []);

  return { theme, setTheme };
}
