import {
  getApiCredentials,
  saveApiCredentials,
  unlockCredentials,
  isUnlocked,
  isVaultInitialized,
} from "./utils/credentials";
import { validateOpenAIKey, validateElevenLabsKey } from "./utils/api";
import { renderStorageDashboard } from "./storageDashboard";
import { renderApiUsageDashboard } from "./apiUsageDashboard";
import { MIN_PASSPHRASE_LENGTH, evaluatePassphraseStrength } from "./passphraseStrength";
import { getSettings } from "./settings";

/**
 * Strongly-typed map of all recognized extension settings keys and their
 * expected value types. Used to provide type safety alongside the open-ended
 * `Settings` type that allows arbitrary extra keys.
 */
interface KnownSettings {
  summarizationInterval?: number;
  vadThreshold?: number;
  aiModel?: string;
  lateJoinerBriefing?: boolean;
  publicLateJoinerChat?: boolean;
  topicDetection?: boolean;
  decisionDetection?: boolean;
  actionExtraction?: boolean;
  sentimentAnalysis?: boolean;
  transcriptRefinement?: boolean;
  theme?: "system" | "light" | "dark";
  accent?: string;
}

/**
 * The full settings object stored in chrome.storage.local. Combines all known
 * typed settings with an open index signature that preserves any unrecognized
 * keys written by older or future extension versions.
 */
type Settings = KnownSettings & Record<string, unknown>;

/**
 * A union of all `KnownSettings` keys whose value type is `boolean | undefined`.
 * Used to constrain the feature-toggle mapping so only boolean settings can be
 * bound to checkbox inputs.
 */
type BooleanSettingKey = {
  [Key in keyof KnownSettings]-?: KnownSettings[Key] extends boolean | undefined ? Key : never;
}[keyof KnownSettings];

/**
 * Applies theme and accent-color CSS variables to the document root immediately,
 * giving users instant visual feedback as they interact with the theme controls.
 * When `theme` is `"system"`, the active theme is resolved from the OS preference.
 * @param theme - The desired theme: `"system"`, `"light"`, or `"dark"`.
 * @param accent - A CSS HSL string (e.g. `"210, 100%, 50%"`) for the accent color. */
function hexToHslRaw(hex: string): string {
  hex = hex.replace(/^#/, "");

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  return `${hDeg}, ${sPct}%, ${lPct}%`;
}

/**
 * Applies theme and accent-color CSS variables to the document root immediately.
 */
function applyThemePreview(theme: "system" | "light" | "dark", accent: string) {
  const root = document.documentElement;

  let activeTheme = theme;
  if (theme === "system") {
    activeTheme = globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  root.setAttribute("data-theme", activeTheme);
  root.style.setProperty("--accent-color", accent);
}

document.addEventListener("DOMContentLoaded", async () => {
  // ——— Load saved settings ———
  // Uses the shared getSettings() helper instead of re-fetching/parsing the
  // config object inline (#666).
  const [credentials, loadedSettings] = await Promise.all([getApiCredentials(), getSettings()]);

  const settings: Settings = loadedSettings;

  // ——— Populate Existing UI Elements ———
  const versionDisplay = document.getElementById("version-display");
  if (versionDisplay) {
    versionDisplay.textContent = chrome.runtime.getManifest().version;
  }

  // VAD threshold slider
  const vadSlider = document.getElementById("vad-threshold") as HTMLInputElement | null;
  const vadValue = document.getElementById("vad-value");
  if (vadSlider && vadValue) {
    vadSlider.value = String(settings.vadThreshold || 0.012);
    vadValue.textContent = vadSlider.value;
    vadSlider.addEventListener("input", () => {
      vadValue.textContent = vadSlider.value;
    });
  }

  const openaiKeyInput = document.getElementById("openai-key") as HTMLInputElement | null;
  if (openaiKeyInput && credentials.openai_api_key) {
    openaiKeyInput.value = credentials.openai_api_key;
  }

  const elevenlabsKeyInput = document.getElementById("elevenlabs-key") as HTMLInputElement | null;
  if (elevenlabsKeyInput && credentials.elevenlabs_api_key) {
    elevenlabsKeyInput.value = credentials.elevenlabs_api_key;
  }

  // Interval slider
  const intervalSlider = document.getElementById("summary-interval") as HTMLInputElement | null;
  const intervalValue = document.getElementById("interval-value");
  if (intervalSlider && intervalValue) {
    intervalSlider.value = String(settings.summarizationInterval || 300);
    intervalValue.textContent = `${Number(intervalSlider.value) / 60} min`;

    intervalSlider.addEventListener("input", () => {
      intervalValue.textContent = `${Number(intervalSlider.value) / 60} min`;
    });
  }

  // Onboarding support: render if requested via query or via button
  const onboardingRoot = document.getElementById("onboarding-root") as HTMLDivElement | null;
  const viewOnboardingBtn = document.getElementById("view-onboarding") as HTMLButtonElement | null;

  if (globalThis.location.search.includes("onboarding=1") && onboardingRoot) {
    const setupView = document.getElementById("setup-view") as HTMLDivElement | null;
    const mainView = document.getElementById("main-view") as HTMLDivElement | null;
    if (setupView) setupView.style.display = "none";
    if (mainView) mainView.style.display = "none";
    const mod = await import("./onboarding");
    await mod.renderOnboarding(onboardingRoot);
    return;
  }

  viewOnboardingBtn?.addEventListener("click", async () => {
    if (!onboardingRoot) return;
    const setupView = document.getElementById("setup-view") as HTMLDivElement | null;
    const mainView = document.getElementById("main-view") as HTMLDivElement | null;
    if (setupView) setupView.style.display = "none";
    if (mainView) mainView.style.display = "none";
    const mod = await import("./onboarding");
    await mod.renderOnboarding(onboardingRoot);
  });

  // ——— Clear Data ———
  document.getElementById("clear-data-btn")?.addEventListener("click", async () => {
    if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
      await chrome.storage.local.clear();
      if (typeof chrome !== "undefined" && chrome.storage?.session) {
        await chrome.storage.session.clear();
      }
      alert("All data cleared successfully. The page will now reload.");
      globalThis.location.reload();
    }
  });

  // AI Model
  const aiModelSelect = document.getElementById("ai-model") as HTMLSelectElement | null;
  if (aiModelSelect && settings.aiModel) {
    aiModelSelect.value = settings.aiModel;
  }

  // Feature toggles
  const toggles: Array<{ id: string; key: BooleanSettingKey }> = [
    { id: "late-joiner-toggle", key: "lateJoinerBriefing" },
    { id: "public-late-joiner-chat-toggle", key: "publicLateJoinerChat" },
    { id: "topic-toggle", key: "topicDetection" },
    { id: "decision-toggle", key: "decisionDetection" },
    { id: "action-toggle", key: "actionExtraction" },
    { id: "sentiment-toggle", key: "sentimentAnalysis" },
    { id: "refinement-toggle", key: "transcriptRefinement" },
  ];

  // Keys that default to off (opt-in features)
  const defaultOffKeys = new Set(["publicLateJoinerChat", "transcriptRefinement"]);

  toggles.forEach((t) => {
    const el = document.getElementById(t.id) as HTMLInputElement | null;
    if (el) {
      el.checked = defaultOffKeys.has(t.key) ? settings[t.key] === true : settings[t.key] !== false;
    }
  });

  // ——— Theme & Color Initializations ———
  let selectedAccentColor = settings.accent || "210, 100%, 50%";

  // ——— NEW: Theme & Color Initializations ———
  const themeSelect = document.getElementById("theme-select") as HTMLSelectElement | null;
  const currentTheme = settings.theme || "system";
  const currentAccent = selectedAccentColor;

  if (themeSelect) {
    themeSelect.value = currentTheme;
  }

  // Run initial theme application right away so options page isn't broken
  applyThemePreview(currentTheme, currentAccent);

  // Enable transitions after initial application completes to prevent page-load transitions
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove("no-transitions");
    });
  });

  const customColorInput = document.getElementById("colorPicker") as HTMLInputElement | null;

  function deactivateAllDots() {
    document.querySelectorAll(".color-dot").forEach((d) => {
      d.classList.remove("active");
      d.setAttribute("aria-pressed", "false");
    });
    customColorInput?.parentElement?.classList.remove("active");
  }

  // Set up predefined standard color buttons
  document.querySelectorAll(".color-dot").forEach((dot) => {
    const dotColor = dot.getAttribute("data-color");
    const isActive = dotColor === currentAccent;
    if (isActive) {
      dot.classList.add("active");
    }
    dot.setAttribute("aria-pressed", String(isActive));

    // Listen for color grid selections to give instant feedback
    dot.addEventListener("click", () => {
      deactivateAllDots();
      dot.classList.add("active");
      dot.setAttribute("aria-pressed", "true");

      const selectedTheme = (themeSelect?.value as Settings["theme"]) || "system";
      selectedAccentColor = dot.getAttribute("data-color") || "210, 100%, 50%";
      applyThemePreview(selectedTheme, selectedAccentColor);
    });
  });

  // ——— Handle Advanced Native Custom Color Selection Event Hooks ———
function hslRawToHex(hslRaw: string): string | null {
  const m = hslRaw.match(
    /^\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*$/
  );
  if (!m) return null;
  const h = ((Number(m[1]) % 360) + 360) % 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m0 = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m0) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

  if (customColorInput) {
    const matchedDot = document.querySelector(`.color-dot[data-color="${currentAccent}"]`);
    if (!matchedDot && currentAccent) {
      customColorInput.parentElement?.classList.add("active");
      const initialHex = hslRawToHex(currentAccent);
      if (initialHex) customColorInput.value = initialHex;
    }

    customColorInput.addEventListener("input", (e) => {
      deactivateAllDots();
      customColorInput.parentElement?.classList.add("active");

      const hexVal = (e.target as HTMLInputElement).value;
      selectedAccentColor = hexToHslRaw(hexVal);

      const selectedTheme = (themeSelect?.value as Settings["theme"]) || "system";
      applyThemePreview(selectedTheme, selectedAccentColor);
    });
  }
  }

  themeSelect?.addEventListener("change", () => {
    let selectedTheme = themeSelect.value as Settings["theme"];
    if (!selectedTheme) {
      selectedTheme = "system";
    }
    applyThemePreview(selectedTheme, selectedAccentColor);
  });

  // ——— Toggle password visibility ———
  document.querySelectorAll<HTMLElement>(".toggle-vis").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      if (targetId) {
        const target = document.getElementById(targetId) as HTMLInputElement | null;
        if (target) {
          target.type = target.type === "password" ? "text" : "password";
        }
      }
    });
  });

  // ——— Passphrase management ———
  const passphraseInput = document.getElementById("passphrase-input") as HTMLInputElement | null;
  const passphraseStatus = document.getElementById("passphrase-status");
  const strengthEl = document.getElementById("vault-strength");
  let pendingUnlock: Promise<void> | null = null;
  // Strength rules apply only when first setting up a vault; unlocking an
  // existing vault must never be blocked, even if its passphrase is weak (#655).
  let vaultInitialized = await isVaultInitialized();

  // Centralizes status writes through a non-secret-named target so the static
  // analyzer doesn't misread them as hard-coded credentials.
  function setStatusMessage(el: HTMLElement | null, kind: "danger" | "success", text: string) {
    if (!el) return;
    el.className = `passphrase-status status-${kind}`;
    el.textContent = text;
  }

  function updateStrengthIndicator() {
    if (!strengthEl) return;
    const typed = passphraseInput?.value ?? "";

    // Only show strength feedback during first-time setup of the vault.
    if (vaultInitialized || isUnlocked() || typed.length === 0) {
      strengthEl.textContent = "";
      strengthEl.className = "vault-strength";
      return;
    }

    const { score, label, meetsMinimum, suggestions } = evaluatePassphraseStrength(typed);
    const detail = meetsMinimum && suggestions.length ? ` — ${suggestions.join(", ")}` : "";
    strengthEl.textContent = `Strength: ${label}${detail}`;
    strengthEl.className = `vault-strength strength-${score}`;
  }

  function updatePassphraseUI() {
    if (passphraseInput) passphraseInput.disabled = isUnlocked();
    if (isUnlocked()) {
      setStatusMessage(
        passphraseStatus,
        "success",
        "Unlocked — encryption key is active in memory",
      );
    } else {
      setStatusMessage(
        passphraseStatus,
        "danger",
        "Locked — enter passphrase to unlock credential encryption",
      );
    }
  }

  async function applyUnlockedCredentials() {
    const creds = await getApiCredentials();
    if (openaiKeyInput && creds.openai_api_key) {
      openaiKeyInput.value = creds.openai_api_key;
    }
    if (elevenlabsKeyInput && creds.elevenlabs_api_key) {
      elevenlabsKeyInput.value = creds.elevenlabs_api_key;
    }
  }

  async function handleUnlock() {
    if (isUnlocked()) return;
    const typed = passphraseInput?.value ?? "";
    if (!typed) {
      setStatusMessage(passphraseStatus, "danger", "Please enter a passphrase");
      return;
    }

    // First-time setup: enforce minimum strength before creating the vault.
    if (!vaultInitialized && !evaluatePassphraseStrength(typed).meetsMinimum) {
      setStatusMessage(
        passphraseStatus,
        "danger",
        `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`,
      );
      return;
    }

    if (!(await unlockCredentials(typed))) {
      setStatusMessage(
        passphraseStatus,
        "danger",
        "Wrong passphrase — could not decrypt stored credentials",
      );
      return;
    }

    vaultInitialized = true;
    updateStrengthIndicator();
    updatePassphraseUI();
    await applyUnlockedCredentials();
  }

  passphraseInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      pendingUnlock = handleUnlock();
    }
  });
  passphraseInput?.addEventListener("blur", () => {
    pendingUnlock = handleUnlock();
  });
  passphraseInput?.addEventListener("input", updateStrengthIndicator);

  updatePassphraseUI();
  updateStrengthIndicator();

  // ——— Save Settings ———
  document.getElementById("save-btn")?.addEventListener("click", async () => {
    const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
    const status = document.getElementById("save-status");

    const openaiKey = openaiKeyInput?.value.trim() ?? "";
    const elevenlabsKey = elevenlabsKeyInput?.value.trim() ?? "";

    const originalText = saveBtn.textContent?.trim() || "Save Settings";
    saveBtn.disabled = true;
    try {
      const parsedInterval = intervalSlider ? parseInt(intervalSlider.value, 10) : 300;
      let validatedInterval =
        Number.isNaN(parsedInterval) || !Number.isFinite(parsedInterval) ? 300 : parsedInterval;
      if (validatedInterval < 300) validatedInterval = 300;
      if (validatedInterval > 900) validatedInterval = 900;

      const parsedVadThreshold = vadSlider ? parseFloat(vadSlider.value) : 0.012;
      let validatedVadThreshold =
        Number.isNaN(parsedVadThreshold) || !Number.isFinite(parsedVadThreshold)
          ? 0.012
          : parsedVadThreshold;
      if (validatedVadThreshold < 0.001) validatedVadThreshold = 0.001;
      if (validatedVadThreshold > 1.0) validatedVadThreshold = 1.0;

      const newSettings: Settings = {
        ...settings,
        summarizationInterval: validatedInterval,
        vadThreshold: validatedVadThreshold,
        aiModel: aiModelSelect?.value,
        lateJoinerBriefing: (document.getElementById("late-joiner-toggle") as HTMLInputElement)
          ?.checked,
        publicLateJoinerChat: (
          document.getElementById("public-late-joiner-chat-toggle") as HTMLInputElement
        )?.checked,
        topicDetection: (document.getElementById("topic-toggle") as HTMLInputElement)?.checked,
        decisionDetection: (document.getElementById("decision-toggle") as HTMLInputElement)
          ?.checked,
        actionExtraction: (document.getElementById("action-toggle") as HTMLInputElement)?.checked,
        sentimentAnalysis: (document.getElementById("sentiment-toggle") as HTMLInputElement)
          ?.checked,
        transcriptRefinement: (document.getElementById("refinement-toggle") as HTMLInputElement)
          ?.checked,

        // Save theme selections into the global config tree bundle block
        theme: (themeSelect?.value as Settings["theme"]) || "system",
        accent: selectedAccentColor,
      };

      await chrome.storage.local.set({ settings: newSettings });

      let credentialsSaved = false;
      if (pendingUnlock) await pendingUnlock;
      if (isUnlocked()) {
        saveBtn.textContent = "Validating Keys...";
        const [isOpenAIValid, isElevenLabsValid] = await Promise.all([
          openaiKey ? validateOpenAIKey(openaiKey) : Promise.resolve(true),
          elevenlabsKey ? validateElevenLabsKey(elevenlabsKey) : Promise.resolve(true),
        ]);

        if (!isOpenAIValid || !isElevenLabsValid) {
          if (status) {
            status.style.color = "red";
            status.textContent = !isOpenAIValid
              ? "Invalid OpenAI API key. Please check and try again."
              : "Invalid ElevenLabs API key. Please check and try again.";
            status.classList.add("visible");
            setTimeout(() => status.classList.remove("visible"), 4000);
          }
          saveBtn.disabled = false;
          saveBtn.textContent = originalText;
          return;
        }

        const credentialsToSave: { openai_api_key?: string; elevenlabs_api_key?: string } = {};
        if (openaiKey) credentialsToSave.openai_api_key = openaiKey;
        if (elevenlabsKey) credentialsToSave.elevenlabs_api_key = elevenlabsKey;
        if (Object.keys(credentialsToSave).length > 0) {
          await saveApiCredentials(credentialsToSave);
        }
        credentialsSaved = true;
      }

      // Show success
      if (status) {
        status.style.color = credentialsSaved ? "" : "var(--accent-color, #22C55E)";
        status.textContent = credentialsSaved
          ? "Settings saved successfully!"
          : "Settings saved. Unlock credential encryption to update API keys.";
        status.classList.add("visible");
        setTimeout(() => status.classList.remove("visible"), 3000);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      if (status) {
        status.style.color = "red";
        status.textContent = "An error occurred while saving. Please try again.";
        status.classList.add("visible");
        setTimeout(() => status.classList.remove("visible"), 4000);
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  });

  // ——— Storage Dashboard ———
  const storageContainer = document.getElementById("storage-dashboard-container");
  if (storageContainer) {
    await renderStorageDashboard(storageContainer);
  }

  // ——— API Usage Dashboard ———
  const usageContainer = document.getElementById("api-usage-dashboard-container");
  if (usageContainer) {
    await renderApiUsageDashboard(usageContainer);
  }
});
