interface Settings {
  summarizationInterval?: number;
  vadThreshold?: number;
  aiModel?: string;
  lateJoinerBriefing?: boolean;
  topicDetection?: boolean;
  decisionDetection?: boolean;
  actionExtraction?: boolean;
  sentimentAnalysis?: boolean;
  theme?: "system" | "light" | "dark";
  accent?: string;
  [key: string]: any;
}

// Utility to apply style visual changes instantly to the page
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
  const config = (await chrome.storage.local.get([
    "openai_api_key",
    "elevenlabs_api_key",
    "settings",
  ])) as { openai_api_key?: string; elevenlabs_api_key?: string; settings?: Settings };

  const settings: Settings = config.settings || {};

  // ——— Populate Existing UI Elements ———

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
  if (openaiKeyInput && config.openai_api_key) {
    openaiKeyInput.value = config.openai_api_key;
  }

  const elevenlabsKeyInput = document.getElementById("elevenlabs-key") as HTMLInputElement | null;
  if (elevenlabsKeyInput && config.elevenlabs_api_key) {
    elevenlabsKeyInput.value = config.elevenlabs_api_key;
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

  // AI Model
  const aiModelSelect = document.getElementById("ai-model") as HTMLSelectElement | null;
  if (aiModelSelect && settings.aiModel) {
    aiModelSelect.value = settings.aiModel;
  }

  // Feature toggles
  const toggles = [
    { id: "late-joiner-toggle", key: "lateJoinerBriefing" },
    { id: "topic-toggle", key: "topicDetection" },
    { id: "decision-toggle", key: "decisionDetection" },
    { id: "action-toggle", key: "actionExtraction" },
    { id: "sentiment-toggle", key: "sentimentAnalysis" },
  ];

  toggles.forEach((t) => {
    const el = document.getElementById(t.id) as HTMLInputElement | null;
    if (el) {
      el.checked = settings[t.key] !== false;
    }
  });

  // ——— NEW: Theme & Color Initializations ———
  const themeSelect = document.getElementById("theme-select") as HTMLSelectElement | null;
  const currentTheme = settings.theme || "system";
  const currentAccent = settings.accent || "210, 100%, 50%";

  if (themeSelect) {
    themeSelect.value = currentTheme;
  }

  // Run initial theme application right away so options page isn't broken
  applyThemePreview(currentTheme, currentAccent);

  // Set the active styling on the matching color dot button
  document.querySelectorAll(".color-dot").forEach((dot) => {
    const dotColor = dot.getAttribute("data-color");
    if (dotColor === currentAccent) {
      dot.classList.add("active");
    }

    // Listen for color grid selections to give instant feedback
    dot.addEventListener("click", () => {
      document.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("active"));
      dot.classList.add("active");

      const selectedTheme = (themeSelect?.value as Settings["theme"]) || "system";
      const selectedAccent =
        dot.getAttribute("data-color") || settings.accent || currentAccent || "210, 100%, 50%";
      applyThemePreview(selectedTheme, selectedAccent);
    });
  });

  // Listen for dropdown theme changes to give instant feedback
  themeSelect?.addEventListener("change", () => {
    let selectedTheme = themeSelect.value as Settings["theme"];
    if (!selectedTheme) {
      selectedTheme = "system";
    }
    const activeDot = document.querySelector(".color-dot.active");
    const selectedAccent = activeDot?.getAttribute("data-color") || "210, 100%, 50%";
    applyThemePreview(selectedTheme, selectedAccent);
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

  // ——— Save ———
  document.getElementById("save-btn")?.addEventListener("click", async () => {
    const openaiKey = (document.getElementById("openai-key") as HTMLInputElement)?.value.trim();
    const elevenlabsKey = (
      document.getElementById("elevenlabs-key") as HTMLInputElement
    )?.value.trim();

    const parsedInterval = intervalSlider ? parseInt(intervalSlider.value, 10) : 30;
    const validatedInterval =
      Number.isNaN(parsedInterval) || !Number.isFinite(parsedInterval) ? 30 : parsedInterval;

    const parsedVadThreshold = vadSlider ? parseFloat(vadSlider.value) : 0.012;
    const validatedVadThreshold =
      Number.isNaN(parsedVadThreshold) || !Number.isFinite(parsedVadThreshold)
        ? 0.012
        : parsedVadThreshold;

    // Grab the active selected color dot element from the document view
    const activeColorDot = document.querySelector(".color-dot.active");

    const newSettings: Settings = {
      summarizationInterval: validatedInterval,
      vadThreshold: validatedVadThreshold,
      aiModel: (document.getElementById("ai-model") as HTMLSelectElement)?.value,
      lateJoinerBriefing: (document.getElementById("late-joiner-toggle") as HTMLInputElement)
        ?.checked,
      topicDetection: (document.getElementById("topic-toggle") as HTMLInputElement)?.checked,
      decisionDetection: (document.getElementById("decision-toggle") as HTMLInputElement)?.checked,
      actionExtraction: (document.getElementById("action-toggle") as HTMLInputElement)?.checked,
      sentimentAnalysis: (document.getElementById("sentiment-toggle") as HTMLInputElement)?.checked,

      // Save theme selections into the global config tree bundle block
      theme: (themeSelect?.value as Settings["theme"]) || "system",
      accent:
        activeColorDot?.getAttribute("data-color") ||
        settings.accent ||
        currentAccent ||
        "210, 100%, 50%",
    };

    const saveData: { settings: Settings; openai_api_key?: string; elevenlabs_api_key?: string } = {
      settings: newSettings,
    };

    if (openaiKey) saveData.openai_api_key = openaiKey;
    if (elevenlabsKey) saveData.elevenlabs_api_key = elevenlabsKey;

    await chrome.storage.local.set(saveData);

    // Show success
    const status = document.getElementById("save-status");
    if (status) {
      status.textContent = "✓ Settings saved successfully!";
      status.classList.add("visible");

      setTimeout(() => {
        status.classList.remove("visible");
      }, 3000);
    }
  });
});
