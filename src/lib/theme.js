// ---------- palettes (inline styles only, no Tailwind arbitrary colors) ----------
// Every screen reads colors off the single `C` object below rather than these
// palettes directly, so switching themes only ever means mutating `C`'s
// fields in place (see applyTheme) — no component needs to know palettes exist.
export const THEMES = {
  pink: {
    label: "Pink",
    swatch: "#E8285B",
    bg: "#FF8FA3",
    card: "#FFFFFF",
    border: "#FFD3DC",
    primary: "#E8285B",
    primaryLight: "#FF6B6B",
    text: "#3A0D18",
    muted: "#B06070",
    muted2: "#D89AA6",
    chipBg: "#FFF3F5",
  },
  grey: {
    label: "Grey",
    swatch: "#3F4750",
    bg: "#A8AFB9",
    card: "#FFFFFF",
    border: "#D7DBE0",
    primary: "#3F4750",
    primaryLight: "#6B7280",
    text: "#20242B",
    muted: "#767D87",
    muted2: "#B7BCC3",
    chipBg: "#F4F5F6",
  },
  blue: {
    label: "Blue",
    swatch: "#1D5EA8",
    bg: "#7FB2E5",
    card: "#FFFFFF",
    border: "#CFE3F7",
    primary: "#1D5EA8",
    primaryLight: "#4C8FD9",
    text: "#0E2A46",
    muted: "#5A7FA3",
    muted2: "#A8C7E3",
    chipBg: "#EEF5FC",
  },
  green: {
    label: "Green",
    swatch: "#1E7B4D",
    bg: "#7FC79A",
    card: "#FFFFFF",
    border: "#CFEBDB",
    primary: "#1E7B4D",
    primaryLight: "#4CAE79",
    text: "#0E3A22",
    muted: "#5A9877",
    muted2: "#A8DBC0",
    chipBg: "#EFFAF4",
  },
};

export const THEME_LIST = Object.entries(THEMES).map(([id, t]) => ({
  id,
  label: t.label,
  swatch: t.swatch,
}));

export const DEFAULT_THEME = "pink";
const STORAGE_KEY = "cracklist-theme";

export const C = { ...THEMES[DEFAULT_THEME] };

export function getStoredThemeId() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && THEMES[stored] ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeThemeId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage unavailable (private browsing, etc.) — theme just won't persist
  }
}

// Mutates the shared `C` object in place so every already-imported reference
// to `C` (every screen just does `import { C } from "./lib/theme"`) picks up
// the new colors without needing context/props threaded through the app.
export function applyTheme(id) {
  Object.assign(C, THEMES[id] || THEMES[DEFAULT_THEME]);
}
