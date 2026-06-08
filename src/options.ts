import {
  getApiCredentials,
  saveApiCredentials,
  unlockCredentials,
  isUnlocked,
} from "./utils/credentials";
import { validateOpenAIKey, validateElevenLabsKey } from "./utils/api.js";
import { renderStorageDashboard } from "./storageDashboard";

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
 * @param accent - A CSS HSL string (e.g. `"210, 100%, 50%"`) for the accent color.
 */
function applyThemePreview(theme: "system" | "light" | "dark", accent: string) {
  const root = document.documentElement;

  let activeTheme = theme;
  if (theme === "system") {
    activeTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  root.setAttribute("data-theme", activeTheme);
  root.style.setProperty("--accent-color", accent);
}

document.addEventListener("DOMContentLoaded", async () => {
  // ——— Load saved settings ———
  const [credentials, config] = await Promise.all([
    getApiCredentials(),
    chrome.storage.local.get("settings") as Promise<{ settings?: Settings }>,
  ]);

  const settings: Settings = config.settings || {};

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
    intervalSlider.value = String(settings.summarizationInterval || 30);
    intervalValue.textContent = `${intervalSlider.value}s`;
    intervalSlider.addEventListener("input", () => {
      intervalValue.textContent = `${intervalSlider.value}s`;
    });
  }

  // Onboarding support: render if requested via query or via button
  const onboardingRoot = document.getElementById("onboarding-root") as HTMLDivElement | null;
  const viewOnboardingBtn = document.getElementById("view-onboarding") as HTMLButtonElement | null;

  if (window.location.search.includes("onboarding=1") && onboardingRoot) {
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

  // Set the active styling on the matching color dot button
  document.querySelectorAll(".color-dot").forEach((dot) => {
    const dotColor = dot.getAttribute("data-color");
    const isActive = dotColor === currentAccent;
    if (isActive) {
      dot.classList.add("active");
    }
    dot.setAttribute("aria-pressed", String(isActive));

    // Listen for color grid selections to give instant feedback
    dot.addEventListener("click", () => {
      document.querySelectorAll(".color-dot").forEach((d) => {
        d.classList.remove("active");
        d.setAttribute("aria-pressed", "false");
      });
      dot.classList.add("active");
      dot.setAttribute("aria-pressed", "true");

      const selectedTheme = (themeSelect?.value as Settings["theme"]) || "system";
      selectedAccentColor = dot.getAttribute("data-color") || "210, 100%, 50%";
      applyThemePreview(selectedTheme, selectedAccentColor);
    });
  });

  // Listen for dropdown theme changes to give instant feedback
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
  let pendingUnlock: Promise<void> | null = null;

  function updatePassphraseUI() {
    if (isUnlocked()) {
      if (passphraseInput) passphraseInput.disabled = true;
      if (passphraseStatus) {
        passphraseStatus.className = "passphrase-status status-success";
        passphraseStatus.textContent = "Unlocked — encryption key is active in memory";
      }
    } else {
      if (passphraseInput) passphraseInput.disabled = false;
      if (passphraseStatus) {
        passphraseStatus.className = "passphrase-status status-danger";
        passphraseStatus.textContent = "Locked — enter passphrase to unlock credential encryption";
      }
    }
  }

  async function handleUnlock() {
    if (isUnlocked()) return;
    const passphrase = passphraseInput?.value ?? "";
    if (!passphrase) {
      if (passphraseStatus) {
        passphraseStatus.className = "passphrase-status status-danger";
        passphraseStatus.textContent = "Please enter a passphrase";
      }
      return;
    }
    const success = await unlockCredentials(passphrase);
    if (success) {
      updatePassphraseUI();
      // Reload API keys now that we can decrypt
      const creds = await getApiCredentials();
      if (openaiKeyInput && creds.openai_api_key) {
        openaiKeyInput.value = creds.openai_api_key;
      }
      if (elevenlabsKeyInput && creds.elevenlabs_api_key) {
        elevenlabsKeyInput.value = creds.elevenlabs_api_key;
      }
    } else if (passphraseStatus) {
      passphraseStatus.className = "passphrase-status status-danger";
      passphraseStatus.textContent = "Wrong passphrase — could not decrypt stored credentials";
    }
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

  updatePassphraseUI();

  // ——— Save ———
  document.getElementById("save-btn")?.addEventListener("click", async () => {
    const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
    const status = document.getElementById("save-status");

    const openaiKey =
      (document.getElementById("openai-key") as HTMLInputElement | null)?.value.trim() ?? "";
    const elevenlabsKey =
      (document.getElementById("elevenlabs-key") as HTMLInputElement | null)?.value.trim() ?? "";

    const originalText = saveBtn.textContent?.trim() || "Save Settings";
    if (pendingUnlock) await pendingUnlock;
    if (!isUnlocked()) {
      if (status) {
        status.style.color = "red";
        status.textContent =
          "Enter your passphrase above to unlock encryption before saving API keys.";
        status.classList.add("visible");
        setTimeout(() => status.classList.remove("visible"), 4000);
      }
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Validating Keys...";
    try {
      const [isOpenAIValid, isElevenLabsValid] = await Promise.all([
        openaiKey ? validateOpenAIKey(openaiKey) : Promise.resolve(true),
        elevenlabsKey ? validateElevenLabsKey(elevenlabsKey) : Promise.resolve(true),
      ]);

      if (!isOpenAIValid || !isElevenLabsValid) {
        if (status) {
          status.style.color = "red";
          status.textContent = !isOpenAIValid
            ? "Invalid OpenAI API Key. Please verify and try again."
            : "Invalid ElevenLabs API Key. Please verify and try again.";
          status.classList.add("visible");
          setTimeout(() => status.classList.remove("visible"), 4000);
        }
        return;
      }

      const parsedInterval = intervalSlider ? parseInt(intervalSlider.value, 10) : 30;
      let validatedInterval =
        Number.isNaN(parsedInterval) || !Number.isFinite(parsedInterval) ? 30 : parsedInterval;
      if (validatedInterval < 10) validatedInterval = 10;
      if (validatedInterval > 300) validatedInterval = 300;

      const parsedVadThreshold = vadSlider ? parseFloat(vadSlider.value) : 0.012;
      let validatedVadThreshold =
        Number.isNaN(parsedVadThreshold) || !Number.isFinite(parsedVadThreshold)
          ? 0.012
          : parsedVadThreshold;
      if (validatedVadThreshold < 0.001) validatedVadThreshold = 0.001;
      if (validatedVadThreshold > 1.0) validatedVadThreshold = 1.0;

      const newSettings: Settings = {
        ...settings, // Retain existing unmapped fields
        summarizationInterval: validatedInterval,
        vadThreshold: validatedVadThreshold,
        aiModel: (document.getElementById("ai-model") as HTMLSelectElement)?.value,
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

      await Promise.all([
        chrome.storage.local.set({ settings: newSettings }),
        saveApiCredentials({ openai_api_key: openaiKey, elevenlabs_api_key: elevenlabsKey }),
      ]);

      // Show success
      if (status) {
        status.style.color = "";
        status.textContent = "Settings saved successfully!";
        status.classList.add("visible");

        setTimeout(() => {
          status.classList.remove("visible");
        }, 3000);
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
});
