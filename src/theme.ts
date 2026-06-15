// shared/theme.ts
import { getSettings, normalizeSettings, type Settings, type ThemeMode } from "./settings";

// Re-exported for backward compatibility with existing importers (#666).
export { getSettings, isValidAccent } from "./settings";
export type { Settings } from "./settings";

// Mode Helper: Safe to evaluate anywhere
function resolveTheme(theme: ThemeMode): "light" | "dark" {
  if (theme === "system") {
    // Check if window exists before calling matchMedia
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark"; // Safe headless default fallback for background context
  }
  return theme;
}

export function applyTheme(settings: Settings): void {
  // Guard clause: If there is no DOM available, skip styling entirely
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const activeTheme = resolveTheme(settings.theme);

  root.dataset.theme = activeTheme;
  root.style.setProperty("--accent-color", settings.accent);
}

export async function syncTheme(): Promise<void> {
  const settings = await getSettings();
  applyTheme(settings);
}

function handleStorageChange(
  changes: { [key: string]: chrome.storage.StorageChange },
  namespace: string,
): void {
  if (namespace !== "local" || !("settings" in changes)) {
    return;
  }

  const settings = normalizeSettings(changes.settings?.newValue);

  applyTheme(settings);
}

async function handleSystemThemeChange(): Promise<void> {
  const settings = await getSettings();
  if (settings.theme === "system") {
    applyTheme(settings);
  }
}

export function watchTheme(): void {
  chrome.storage.onChanged.addListener(handleStorageChange);

  // Guard media queries listening against headless worker processes
  if (typeof window !== "undefined" && window.matchMedia) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", handleSystemThemeChange);
  }
}

export async function initTheme(): Promise<void> {
  await syncTheme();
  watchTheme();
}
