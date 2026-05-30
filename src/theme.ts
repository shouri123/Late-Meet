// shared/theme.ts

type ThemeMode = "light" | "dark" | "system";

export interface Settings {
  theme: ThemeMode;
  accent: string;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  accent: "210, 100%, 50%",
};

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

export function isValidAccent(value: string): boolean {
  const accent = value.trim();
  return (
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(accent) ||
    /^\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%$/.test(accent) ||
    /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(accent)
  );
}

function normalizeSettings(raw: unknown): Settings {
  const candidate = (raw ?? {}) as Partial<Settings>;

  const theme: ThemeMode =
    candidate.theme === "light" || candidate.theme === "dark" || candidate.theme === "system"
      ? candidate.theme
      : DEFAULT_SETTINGS.theme;

  const accentCandidate = typeof candidate.accent === "string" ? candidate.accent.trim() : "";

  const accent = isValidAccent(accentCandidate) ? accentCandidate : DEFAULT_SETTINGS.accent;

  return { theme, accent };
}
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get("settings");
  return normalizeSettings(result.settings);
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
