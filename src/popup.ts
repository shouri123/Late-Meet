import { State } from "./types";
import { initTheme } from "./theme.js";
import {
  getApiCredentials,
  saveApiCredentials,
  unlockCredentials,
  isUnlocked,
} from "./utils/credentials";
import { validateOpenAIKey } from "./utils/api.js";
import { resolveManualMeetTab } from "./meetingTabs";
import { startPopupAudioCapture } from "./popupCapture";

initTheme();

document.addEventListener("DOMContentLoaded", async () => {
  const setupView = document.getElementById("setup-view") as HTMLDivElement;
  const mainView = document.getElementById("main-view") as HTMLDivElement;
  const meetingSection = document.getElementById("meeting-section") as HTMLDivElement;
  const noMeetingSection = document.getElementById("no-meeting-section") as HTMLDivElement;
  const sessionModal = document.getElementById("session-modal") as HTMLDivElement;
  const sessionModalError = document.getElementById(
    "session-modal-error",
  ) as HTMLParagraphElement | null;

  let lastState: State | null = null;

  // ——— Passphrase management ———
  const passphraseInput = document.getElementById("passphrase-input") as HTMLInputElement | null;
  const passphraseStatus = document.getElementById("passphrase-status");
  let pendingUnlock: Promise<boolean> | null = null;

  function updatePassphraseStatus() {
    if (!passphraseStatus) return;
    if (isUnlocked()) {
      passphraseStatus.style.color = "#22C55E";
      passphraseStatus.textContent = "Unlocked — encryption key is active";
    } else {
      passphraseStatus.style.color = "#EF4444";
      passphraseStatus.textContent = "Locked — enter passphrase to unlock encryption";
    }
  }

  async function handlePassphraseUnlock(): Promise<boolean> {
    if (isUnlocked()) return true;
    const passphrase = passphraseInput?.value ?? "";
    if (!passphrase) {
      if (passphraseStatus) passphraseStatus.textContent = "Please enter a passphrase";
      return false;
    }
    const success = await unlockCredentials(passphrase);
    if (success) {
      updatePassphraseStatus();
      const creds = await getApiCredentials();
      if (creds.openai_api_key || creds.elevenlabs_api_key) {
        setupView.style.display = "none";
        mainView.style.display = "block";
      }
      return true;
    }
    if (passphraseStatus) {
      passphraseStatus.style.color = "#EF4444";
      passphraseStatus.textContent = "Wrong passphrase — could not decrypt stored credentials";
    }
    return false;
  }

  passphraseInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") pendingUnlock = handlePassphraseUnlock();
  });
  passphraseInput?.addEventListener("blur", () => {
    pendingUnlock = handlePassphraseUnlock();
  });

  // ——— Check if API key is configured ———
  const config = await getApiCredentials();

  if (!config.openai_api_key && !config.elevenlabs_api_key) {
    setupView.style.display = "block";
    mainView.style.display = "none";
  } else {
    setupView.style.display = "none";
    mainView.style.display = "block";
  }

  updatePassphraseStatus();

  // ——— Setup: Save Key ———
  document.getElementById("save-keys")?.addEventListener("click", async () => {
    const apiKeyInput = document.getElementById("api-key-input") as HTMLInputElement;
    const apiKey = apiKeyInput.value.trim();
    const saveBtn = document.getElementById("save-keys") as HTMLButtonElement;

    if (!isUnlocked()) {
      if (pendingUnlock) await pendingUnlock;
      if (!isUnlocked()) {
        const unlocked = await handlePassphraseUnlock();
        if (!unlocked) return;
      }
    }

    if (!apiKey) {
      shakeElement(apiKeyInput);
      return;
    }
    //Validation.
    const originalText = "Save Key";
    saveBtn.disabled = true;
    saveBtn.textContent = "Validating...";

    const isValid = await validateOpenAIKey(apiKey);
    if (!isValid) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
      shakeElement(apiKeyInput);
      //Helpful error message.
      let errorEl = document.getElementById("api-key-error");
      if (!errorEl) {
        errorEl = document.createElement("div");
        errorEl.id = "api-key-error";
        errorEl.style.color = "#EF4444";
        errorEl.style.fontSize = "11px";
        errorEl.style.marginTop = "6px";
        errorEl.style.textAlign = "left";
        apiKeyInput.parentNode?.appendChild(errorEl);
      }
      errorEl.textContent = "Invalid API Key. Please verify and try again.";
      return;
    }
    //Cleaning up.
    const errorEl = document.getElementById("api-key-error");
    if (errorEl) {
      errorEl.remove();
    }

    // Since the popup only has one input currently, we'll save it as openai_api_key
    // Users can configure ElevenLabs in the options page.

    await saveApiCredentials({ openai_api_key: apiKey });
    setupView.style.display = "none";
    mainView.style.display = "block";
  });

  // ——— Toggle API Key Visibility ———
  document.getElementById("toggle-key")?.addEventListener("click", () => {
    const input = document.getElementById("api-key-input") as HTMLInputElement;
    input.type = input.type === "password" ? "text" : "password";
  });

  // ——— Settings ———
  document.getElementById("settings-btn")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  // ——— Open Dashboard ———
  document.getElementById("open-dashboard")?.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId !== undefined) {
        chrome.sidePanel.open({ tabId });
      }
    });
  });

  // ——— Start Copilot (Audio Capture with User Gesture) ———
  const copilotBtn = document.getElementById("start-copilot-btn") as HTMLButtonElement | null;

  function getPopupMediaStreamId(tabId: number): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || "Unknown tab capture error"));
          return;
        }

        resolve(streamId || "");
      });
    });
  }

  async function requestPopupMicrophonePermission(): Promise<boolean> {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      console.warn("[LateMeet] Microphone permission not granted — recording tab audio only");
      return false;
    }
  }

  async function handleStopAudio(btn?: HTMLButtonElement | null) {
    if (!lastState?.audioActive) return;

    try {
      if (btn) btn.disabled = true;
      await chrome.runtime.sendMessage({ type: "MANUAL_STOP_AUDIO" });
    } catch (err) {
      console.error("[LateMeet] Failed to stop audio:", err);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function handleStartAudio(btn: HTMLButtonElement) {
    const textEl = btn.querySelector(".copilot-btn-text");
    const originalText = textEl?.textContent || "Start";

    if (lastState?.audioActive) {
      console.log("[LateMeet] Audio already active, skipping capture request.");
      return;
    }

    try {
      // Show loading state
      btn.disabled = true;
      if (textEl) textEl.textContent = "Starting...";
      btn.classList.add("loading");

      const { meetingId, microphoneEnabled } = await startPopupAudioCapture({
        resolveMeetTab: resolveManualMeetTab,
        getMediaStreamId: getPopupMediaStreamId,
        requestMicrophonePermission: requestPopupMicrophonePermission,
        startAudioCapture: (payload) =>
          chrome.runtime.sendMessage({
            type: "MANUAL_START_AUDIO",
            ...payload,
          }),
      });

      if (!microphoneEnabled) {
        console.warn("[LateMeet] Started without microphone input — tab audio only");
      }

      // Clear loading state before setting active state
      btn.disabled = false;
      btn.classList.remove("loading");
      setCopilotActive(true);
      // Immediately show meeting section and start timer
      if (meetingSection) meetingSection.style.display = "block";
      if (noMeetingSection) noMeetingSection.style.display = "none";
      if (meetingId) {
        const meetingIdEl = document.getElementById("meeting-id");
        if (meetingIdEl) meetingIdEl.textContent = meetingId;
      }
      const badge = document.getElementById("status-badge");
      if (badge) {
        badge.className = "status-badge active";
        const statusText = badge.querySelector(".status-text");
        if (statusText) statusText.textContent = "Recording...";
      }
      startDurationTimer(Date.now());
    } catch (err: any) {
      if ((err.message || "").includes("active stream")) {
        setCopilotActive(true);
        return;
      }

      handleStartAudioError(err);
    }

    function handleStartAudioError(err: any) {
      console.error("Failed to start audio capture:", err);
      btn.disabled = false;
      btn.classList.remove("loading");
      if (textEl) {
        textEl.textContent =
          err.message?.length > 40 ? "Error — Check Console" : err.message || "Unknown error";
        setTimeout(() => {
          if (textEl) textEl.textContent = originalText;
        }, 3000);
      }
    }
  }

  copilotBtn?.addEventListener("click", () => handleStartAudio(copilotBtn));
  document.getElementById("meeting-start-audio-btn")?.addEventListener("click", (e) => {
    const btn = e.currentTarget as HTMLButtonElement | null;
    if (!btn) return;
    if (lastState?.audioActive) {
      handleStopAudio(btn);
      return;
    }
    handleStartAudio(btn);
  });

  function setCopilotActive(active: boolean) {
    if (!copilotBtn) return;
    const miniBtn = document.getElementById("meeting-start-audio-btn");
    const iconEl = copilotBtn.querySelector(".copilot-btn-icon");
    const textEl = copilotBtn.querySelector(".copilot-btn-text");

    const getMiniBtnLabelNode = () => {
      if (!miniBtn) return null;
      return (
        Array.from(miniBtn.childNodes)
          .reverse()
          .find((n) => n.nodeType === Node.TEXT_NODE && String(n.textContent || "").trim()) || null
      );
    };

    if (active) {
      copilotBtn.classList.remove("loading");
      copilotBtn.classList.add("active");
      if (textEl) textEl.textContent = "Recording...";
      if (iconEl)
        iconEl.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      copilotBtn.disabled = true;
      if (miniBtn) {
        miniBtn.style.display = "flex";
        miniBtn.classList.add("active");
        miniBtn.title = "Stop audio capture";
        const labelNode = getMiniBtnLabelNode();
        if (labelNode) labelNode.textContent = " Stop Audio";
      }
    } else {
      copilotBtn.classList.remove("active");
      if (textEl) textEl.textContent = "Start Copilot";
      if (iconEl)
        iconEl.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
      copilotBtn.disabled = false;
      if (miniBtn) {
        miniBtn.style.display = "flex";
        miniBtn.classList.remove("active");
        miniBtn.title = "Start audio capture";
        const labelNode = getMiniBtnLabelNode();
        if (labelNode) labelNode.textContent = " Start Audio";
      }
    }
  }

  // ——— Session Save/Discard Modal ———
  let previouslyFocusedElement: HTMLElement | null = null;

  function trapFocus(e: KeyboardEvent) {
    if (e.key !== "Tab") return;
    const focusableEls = sessionModal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusableEls.length === 0) return;
    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  }

  function handleModalKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      hideSessionModal();
    }
    trapFocus(e);
  }

  function showSessionModal() {
    const saveBtn = document.getElementById("save-session-btn") as HTMLButtonElement | null;
    const discardBtn = document.getElementById("discard-session-btn") as HTMLButtonElement | null;
    if (sessionModalError) {
      sessionModalError.hidden = true;
      sessionModalError.textContent = "";
    }
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Session";
      saveBtn.classList.remove("loading");
    }
    if (discardBtn) {
      discardBtn.disabled = false;
      discardBtn.textContent = "Discard";
      discardBtn.classList.remove("loading");
    }
    previouslyFocusedElement = document.activeElement as HTMLElement | null;
    sessionModal.style.display = "flex";
    requestAnimationFrame(() => {
      sessionModal.classList.add("visible");
      // Move focus into the modal
      (saveBtn || discardBtn)?.focus();
    });
    sessionModal.addEventListener("keydown", handleModalKeydown);
  }

  function hideSessionModal() {
    sessionModal.classList.remove("visible");
    sessionModal.removeEventListener("keydown", handleModalKeydown);
    setTimeout(() => {
      sessionModal.style.display = "none";
      // Return focus to the previously focused element
      previouslyFocusedElement?.focus();
      previouslyFocusedElement = null;
    }, 300);
  }

  // Backdrop click to dismiss
  sessionModal.querySelector(".session-modal-backdrop")?.addEventListener("click", () => {
    hideSessionModal();
  });

  document.getElementById("save-session-btn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const discardBtn = document.getElementById("discard-session-btn") as HTMLButtonElement | null;
    const originalText = btn.textContent || "Save Session";

    btn.disabled = true;
    btn.textContent = "Saving...";
    btn.classList.add("loading");
    if (sessionModalError) {
      sessionModalError.hidden = true;
      sessionModalError.textContent = "";
    }
    if (discardBtn) {
      discardBtn.disabled = true;
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: "SAVE_SESSION" });
      if (!response?.success) {
        throw new Error(response?.error || "Failed to save session");
      }
      hideSessionModal();
    } catch (err) {
      console.error("[LateMeet] Failed to save session:", err);
      if (sessionModalError) {
        sessionModalError.hidden = false;
        sessionModalError.textContent =
          err instanceof Error
            ? err.message
            : "Unable to save this session. Export it from the dashboard before closing Chrome.";
      }
      // Restore states on error
      btn.disabled = false;
      btn.textContent = originalText;
      btn.classList.remove("loading");
      if (discardBtn) {
        discardBtn.disabled = false;
      }
    }
  });

  document.getElementById("discard-session-btn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    const saveBtn = document.getElementById("save-session-btn") as HTMLButtonElement | null;
    const originalText = btn.textContent || "Discard";

    btn.disabled = true;
    btn.textContent = "Discarding...";
    btn.classList.add("loading");
    if (saveBtn) {
      saveBtn.disabled = true;
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: "DISCARD_SESSION" });
      if (!response?.success) {
        throw new Error(response?.error || "Failed to discard session");
      }
      hideSessionModal();
    } catch (err) {
      console.error("[LateMeet] Failed to discard session:", err);
      // Restore states on error
      btn.disabled = false;
      btn.textContent = originalText;
      btn.classList.remove("loading");
      if (saveBtn) {
        saveBtn.disabled = false;
      }
    }
  });

  // ——— Check for pending session on load ———
  const { pendingSession } = (await chrome.storage.local.get("pendingSession")) as {
    pendingSession?: State;
  };
  if (pendingSession && !pendingSession.isActive) {
    showSessionModal();
  }

  // ——— Get Initial state load ———
  try {
    lastState = await chrome.runtime.sendMessage({ type: "GET_STATE" });
    if (lastState) updateUI(lastState);
  } catch {
    /* background script might be idle */
  }

  // ——— Listen for State Updates ———
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "STATE_UPDATE") {
      lastState = message.state;
      updateUI(message.state);
    }
    if (message.type === "SESSION_ENDED") {
      showSessionModal();
    }
  });

  // ——— Duration Timer ———
  let durationInterval: number | NodeJS.Timeout | null = null;

  function startDurationTimer(startTime: number) {
    if (durationInterval) return;

    durationInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const timerEl = document.getElementById("meeting-duration");
      if (timerEl) timerEl.textContent = formatDuration(elapsed);
    }, 1000);
  }

  // ——— Update UI ———
  function updateUI(state: State) {
    if (state.isActive) {
      if (meetingSection) meetingSection.style.display = "block";
      if (noMeetingSection) noMeetingSection.style.display = "none";

      const badge = document.getElementById("status-badge");
      if (badge) {
        badge.className = "status-badge active";
        const statusText = badge.querySelector(".status-text");
        if (statusText)
          statusText.textContent = state.audioActive ? "Recording..." : "Meeting active";
      }

      const meetingIdEl = document.getElementById("meeting-id");
      if (meetingIdEl) meetingIdEl.textContent = state.meetingId || "—";

      if (state.startTime) startDurationTimer(state.startTime);

      const summaryEl = document.getElementById("summary-text");
      if (summaryEl) summaryEl.textContent = state.summary || "Waiting for conversation...";

      const topicEl = document.getElementById("current-topic");
      if (topicEl) topicEl.textContent = state.currentTopic || "Detecting...";

      const participantsCountEl = document.getElementById("participant-count");
      if (participantsCountEl)
        participantsCountEl.textContent = String(state.participants?.length || 0);

      const decisionCountEl = document.getElementById("decision-count");
      if (decisionCountEl) decisionCountEl.textContent = String(state.decisions?.length || 0);

      const actionCountEl = document.getElementById("action-count");
      if (actionCountEl) actionCountEl.textContent = String(state.actionItems?.length || 0);

      const sentimentEl = document.getElementById("sentiment-icon");
      if (sentimentEl) sentimentEl.textContent = getSentimentEmoji(state.sentiment);

      setCopilotActive(state.audioActive || false);

      const topicsList = document.getElementById("topics-list");
      if (topicsList) {
        if (state.topics && state.topics.length > 0) {
          topicsList.innerHTML = state.topics
            .map(
              (t) => `
            <div class="topic-item">
              <div class="topic-dot ${sanitizeTopicStatus(t.status)}"></div>
              <span class="topic-name">${escapeHtml(t.name || "")}</span>
              <span class="topic-status ${sanitizeTopicStatus(t.status)}">${escapeHtml(t.status || "active")}</span>
            </div>
          `,
            )
            .join("");
        } else {
          topicsList.innerHTML = '<div class="empty-state">No topics detected yet</div>';
        }
      }

      const lateSection = document.getElementById("late-joiners-section");
      const lateList = document.getElementById("late-joiners-list");
      if (lateSection && lateList) {
        if (state.lateJoiners && state.lateJoiners.length > 0) {
          lateSection.style.display = "block";
          lateList.innerHTML = state.lateJoiners
            .map(
              (name) => `
            <div class="late-joiner-item">
              <span class="joiner-icon">🚪</span>
              <span class="joiner-name">${escapeHtml(name || "")}</span>
              <span style="color: #64748B; font-size: 10px;">briefed ✓</span>
            </div>
          `,
            )
            .join("");
        } else {
          lateSection.style.display = "none";
          lateList.innerHTML = "";
        }
      }
    } else {
      if (meetingSection) meetingSection.style.display = "none";
      if (noMeetingSection) noMeetingSection.style.display = "block";

      const badge = document.getElementById("status-badge");
      if (badge) {
        badge.className = "status-badge inactive";
        const statusText = badge.querySelector(".status-text");
        if (statusText) statusText.textContent = "No active meeting";
      }

      if (durationInterval) {
        clearInterval(durationInterval as any);
        durationInterval = null;
      }
    }
  }

  // ——— Helpers ———
  function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function getSentimentEmoji(sentiment: string) {
    const map: Record<string, string> = {
      positive: "😊",
      negative: "😟",
      neutral: "😐",
      mixed: "🤔",
    };
    return map[sentiment] || "—";
  }

  function sanitizeTopicStatus(status: string) {
    return status === "completed" ? "completed" : "active";
  }

  function escapeHtml(value: string | null | undefined) {
    const div = document.createElement("div");
    div.textContent = String(value || "");
    return div.innerHTML;
  }

  function shakeElement(el: HTMLElement | null) {
    if (!el) return;
    el.style.borderColor = "#EF4444";
    el.style.animation = "shake 0.4s ease";
    setTimeout(() => {
      el.style.borderColor = "";
      el.style.animation = "";
    }, 400);
  }
});
