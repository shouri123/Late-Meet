import { getApiCredentials, saveApiCredentials } from "./utils/credentials";
import { validateOpenAIKey, validateElevenLabsKey } from "./utils/api";

export async function renderOnboarding(container: HTMLElement) {
  container.hidden = false;
  container.innerHTML = `
    <div class="onboard">
      <div class="onboard-card" role="dialog" aria-modal="true" aria-label="Late Meet Onboarding">
        <div id="onboard-content"></div>
        <div class="onboard-footer">
          <button id="onboard-skip" class="btn">Skip</button>
          <div class="onboard-nav">
            <button id="onboard-back" class="btn" disabled>Back</button>
            <button id="onboard-next" class="btn btn-primary">Next</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const content = container.querySelector<HTMLDivElement>("#onboard-content")!;
  const backBtn = container.querySelector<HTMLButtonElement>("#onboard-back")!;
  const nextBtn = container.querySelector<HTMLButtonElement>("#onboard-next")!;
  const skipBtn = container.querySelector<HTMLButtonElement>("#onboard-skip")!;

  const steps = [
    {
      id: "welcome",
      title: "Welcome to Late Meet",
      html: `
        <h2>Welcome to Late Meet</h2>
        <p>Catch up instantly when joining meetings late. Local-first, privacy-focused, and easy to use.</p>
      `,
    },
    {
      id: "how-it-works",
      title: "How it works",
      html: `
        <h2>How it works</h2>
        <ol>
          <li>Join Google Meet</li>
          <li>Start the Copilot to capture audio</li>
          <li>Get real-time transcripts and summaries</li>
          <li>Use "Catch Me Up" to get a quick briefing</li>
        </ol>
      `,
    },
    {
      id: "api-keys",
      title: "API Keys",
      html: `
        <h2>API Keys</h2>
        <p>Provide your OpenAI API key to enable summarization features. ElevenLabs is optional for TTS.</p>
        <div class="form-group">
          <label for="onb-openai">OpenAI API Key</label>
          <input id="onb-openai" class="form-input" placeholder="sk-xxxx" />
          <button id="onb-validate-openai" class="btn">Validate</button>
          <div id="onb-openai-status" class="form-note"></div>
        </div>
        <div class="form-group">
          <label for="onb-eleven">ElevenLabs API Key (optional)</label>
          <input id="onb-eleven" class="form-input" placeholder="xxxxx" />
          <button id="onb-validate-eleven" class="btn">Validate</button>
          <div id="onb-eleven-status" class="form-note"></div>
        </div>
      `,
    },
    {
      id: "permissions",
      title: "Permissions",
      html: `
        <h2>Permissions</h2>
        <p>Late Meet requires permission to capture tab audio and store data locally. All data stays on your device.</p>
        <ul>
          <li>Tab capture: available</li>
          <li>Local storage: available</li>
        </ul>
      `,
    },
    {
      id: "quick-start",
      title: "Quick Start",
      html: `
        <h2>Quick Start</h2>
        <ol>
          <li>Join a Google Meet</li>
          <li>Open the Late Meet popup and start Copilot</li>
          <li>Use "Catch Me Up" for shortings</li>
        </ol>
      `,
    },
    {
      id: "complete",
      title: "All set!",
      html: `
        <h2>You're ready</h2>
        <p>You're all set. Open the dashboard to get started.</p>
        <div class="onboard-actions">
          <button id="onb-open-dashboard" class="btn btn-primary">Open Dashboard</button>
          <button id="onb-finish" class="btn">Finish</button>
        </div>
      `,
    },
  ];

  let index = 0;

  function renderStep() {
    const step = steps[index];
    content.innerHTML = step.html;
    backBtn.disabled = index === 0;
    nextBtn.textContent = index === steps.length - 1 ? "Finish" : "Next";

    // Wire validate/save controls if API step
    if (step.id === "api-keys") {
      const openaiInput = container.querySelector<HTMLInputElement>("#onb-openai")!;
      const elevenInput = container.querySelector<HTMLInputElement>("#onb-eleven")!;
      const openaiStatus = container.querySelector<HTMLDivElement>("#onb-openai-status")!;
      const elevenStatus = container.querySelector<HTMLDivElement>("#onb-eleven-status")!;
      const valOpenBtn = container.querySelector<HTMLButtonElement>("#onb-validate-openai")!;
      const valElevenBtn = container.querySelector<HTMLButtonElement>("#onb-validate-eleven")!;

      (async () => {
        const creds = await getApiCredentials();
        if (creds.openai_api_key) openaiInput.value = creds.openai_api_key;
        if (creds.elevenlabs_api_key) elevenInput.value = creds.elevenlabs_api_key;
      })();

      valOpenBtn.addEventListener("click", async () => {
        openaiStatus.textContent = "Validating...";
        const key = openaiInput.value.trim();
        try {
          const ok = await validateOpenAIKey(key);
          if (ok) {
            openaiStatus.textContent = "Valid OpenAI key — saved.";
            await saveApiCredentials({ openai_api_key: key });
          } else {
            openaiStatus.textContent = "Invalid OpenAI key.";
          }
        } catch (err) {
          openaiStatus.textContent = "Validation error.";
        }
      });

      valElevenBtn.addEventListener("click", async () => {
        elevenStatus.textContent = "Validating...";
        const key = elevenInput.value.trim();
        try {
          const ok = await validateElevenLabsKey(key);
          if (ok) {
            elevenStatus.textContent = "Valid ElevenLabs key — saved.";
            await saveApiCredentials({ elevenlabs_api_key: key });
          } else {
            elevenStatus.textContent = "Invalid ElevenLabs key.";
          }
        } catch (err) {
          elevenStatus.textContent = "Validation error.";
        }
      });
    }

    if (step.id === "complete") {
      const openBtn = container.querySelector<HTMLButtonElement>("#onb-open-dashboard");
      const finishBtn = container.querySelector<HTMLButtonElement>("#onb-finish");
      openBtn?.addEventListener("click", async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tabs[0]?.id;
        if (typeof tabId === "number") {
          await chrome.sidePanel.open({ tabId });
        } else {
          console.warn("Unable to determine current tab id for sidePanel.open");
        }
      });
      finishBtn?.addEventListener("click", async () => {
        await chrome.storage.local.set({ onboardingCompleted: true });
        container.hidden = true;
        location.href = "src/options.html";
      });
    }
  }

  backBtn.addEventListener("click", () => {
    if (index > 0) {
      index -= 1;
      renderStep();
    }
  });

  nextBtn.addEventListener("click", async () => {
    if (index < steps.length - 1) {
      index += 1;
      renderStep();
    } else {
      // Finish
      await chrome.storage.local.set({ onboardingCompleted: true });
      container.hidden = true;
      location.href = "src/options.html";
    }
  });

  skipBtn.addEventListener("click", async () => {
    if (confirm("Skip the onboarding? You can always view it later in Settings.")) {
      await chrome.storage.local.set({ onboardingCompleted: true });
      container.hidden = true;
      location.href = "src/options.html";
    }
  });

  renderStep();
}
