// Shared settings helper (#666). Single source of `getSettings` so components
// (background, options, theme, …) don't each re-fetch and re-parse the config
// object from chrome.storage.local.

export type ThemeMode = "light" | "dark" | "system";

export interface Settings {
  theme: ThemeMode;
  accent: string;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  accent: "210, 100%, 50%",
};

function isValidHslComponent(hue: string, sat: string, light: string): boolean {
  const h = Number.parseInt(hue, 10);
  const s = Number.parseInt(sat, 10);
  const l = Number.parseInt(light, 10);
  return h >= 0 && h <= 360 && s >= 0 && s <= 100 && l >= 0 && l <= 100;
}

export function isValidAccent(value: string): boolean {
  const accent = value.trim();

  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(accent)) return true;

  const commaMatch = /^(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%$/.exec(accent);
  if (commaMatch) return isValidHslComponent(commaMatch[1], commaMatch[2], commaMatch[3]);

  const spaceMatch = /^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/.exec(accent);
  if (spaceMatch) return isValidHslComponent(spaceMatch[1], spaceMatch[2], spaceMatch[3]);

  return false;
}

/**
 * Normalizes a raw stored settings object: validates theme and accent, falling
 * back to defaults, while preserving any other persisted keys.
 */
export function normalizeSettings(raw: unknown): any {
  const candidate = (raw ?? {}) as Record<string, unknown>;

  const themeValue = candidate.theme;
  const theme: ThemeMode =
    themeValue === "light" || themeValue === "dark" || themeValue === "system"
      ? themeValue
      : DEFAULT_SETTINGS.theme;

  const accentCandidate = typeof candidate.accent === "string" ? candidate.accent.trim() : "";
  const accent = isValidAccent(accentCandidate) ? accentCandidate : DEFAULT_SETTINGS.accent;

  return { ...candidate, theme, accent };
}

/** Reads and normalizes the extension settings from chrome.storage.local. */
export async function getSettings(): Promise<any> {
  const result = await chrome.storage.local.get("settings");
  return normalizeSettings(result.settings);
}
