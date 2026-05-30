import { State, Topic, TranscriptEntry, TimelineEvent, Decision, ActionItem } from "./types";
import { initTheme } from "./theme.js";
import { resolveManualMeetTab } from "./meetingTabs";
import { startDashboardAudioCapture } from "./dashboardCapture";

initTheme();

// ——— Action Item Status Persistence ———
const actionStatuses = new Map<string, boolean>();
let currentMeetingId = "unknown";

function resolveActionKey(item: ActionItem | unknown): string {
  if (item && typeof item === "object" && "task" in (item as object)) {
    const task = (item as { task?: unknown }).task;
    return String(task ?? "").trim();
  }
  return String(item ?? "").trim();
}

function buildActionStatusKey(meetingId: string, task: string): string {
  return `${meetingId}::${task}`;
}

function normalizeActionItem(input: unknown): ActionItem | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<ActionItem> & { confidence?: unknown; isSpeculative?: unknown };
  const task = String(raw.task ?? "").trim();

  if (!task) return null;

  return {
    task,
    owner: String(raw.owner ?? "").trim() || undefined,
    deadline: String(raw.deadline ?? "").trim() || undefined,
    confidence: typeof raw.confidence === "number" ? raw.confidence : undefined,
    isSpeculative: typeof raw.isSpeculative === "boolean" ? raw.isSpeculative : undefined,
  } as ActionItem;
}

async function loadActionStatuses() {
  try {
    const result = await chrome.storage.local.get("actionItemStatuses");
    const stored = result.actionItemStatuses;
    if (stored && typeof stored === "object") {
      for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
        actionStatuses.set(k, Boolean(v));
      }
    }
  } catch (err) {
    console.error("[Dashboard] Failed to load action statuses:", err);
  }
}

async function persistActionStatuses() {
  try {
    const obj: Record<string, boolean> = {};
    actionStatuses.forEach((v, k) => {
      obj[k] = v;
    });
    await chrome.storage.local.set({ actionItemStatuses: obj });
  } catch (err) {
    console.error("[Dashboard] Failed to persist action statuses:", err);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // ——— Transcript Search DOM Elements (Queried early to prevent TDZ) ———
  const searchInput = document.getElementById("transcript-search-input") as HTMLInputElement | null;
  const searchCounter = document.getElementById(
    "transcript-search-counter",
  ) as HTMLSpanElement | null;
  const searchPrevBtn = document.getElementById("search-prev") as HTMLButtonElement | null;
  const searchNextBtn = document.getElementById("search-next") as HTMLButtonElement | null;
  const searchClearBtn = document.getElementById("search-clear") as HTMLButtonElement | null;
  const transcriptContainer = document.getElementById(
    "dash-transcript-list",
  ) as HTMLDivElement | null;

  await loadActionStatuses();
  // ——— Waveform Visualizer ———
  const WAVEFORM_N = 32;
  const WAVEFORM_H = 48;
  const WAVEFORM_SMOOTH = 0.55;

  const waveformCanvas = document.getElementById("waveform-canvas") as HTMLCanvasElement | null;
  const waveformStatusEl = document.getElementById("waveform-status");
  let waveformCtx: CanvasRenderingContext2D | null = null;
  let waveformCssW = 280;
  let smoothed = new Array(WAVEFORM_N).fill(0);

  function initWaveformCanvas() {
    if (!waveformCanvas) return;
    waveformCtx = waveformCanvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    waveformCssW = waveformCanvas.offsetWidth || 280;
    waveformCanvas.width = Math.round(waveformCssW * dpr);
    waveformCanvas.height = Math.round(WAVEFORM_H * dpr);
    if (waveformCtx) waveformCtx.scale(dpr, dpr);
    drawIdleWaveform();
  }

  function drawIdleWaveform() {
    if (!waveformCtx) return;
    const barGap = 2;
    const barW = (waveformCssW - barGap * (WAVEFORM_N - 1)) / WAVEFORM_N;
    const centerY = WAVEFORM_H / 2;
    waveformCtx.clearRect(0, 0, waveformCssW, WAVEFORM_H);
    for (let i = 0; i < WAVEFORM_N; i++) {
      const x = i * (barW + barGap);
      waveformCtx.fillStyle = "rgba(255,255,255,0.08)";
      waveformCtx.beginPath();
      waveformCtx.roundRect(x, centerY - 1, barW, 2, 1);
      waveformCtx.fill();
    }
  }

  function drawWaveform(buckets: number[]) {
    if (!waveformCtx) return;
    const barGap = 2;
    const barW = (waveformCssW - barGap * (WAVEFORM_N - 1)) / WAVEFORM_N;
    const centerY = WAVEFORM_H / 2;
    waveformCtx.clearRect(0, 0, waveformCssW, WAVEFORM_H);
    for (let i = 0; i < WAVEFORM_N; i++) {
      smoothed[i] = smoothed[i] * WAVEFORM_SMOOTH + buckets[i] * (1 - WAVEFORM_SMOOTH);
      const amp = smoothed[i];
      const barH = Math.max(2, amp * WAVEFORM_H * 0.9);
      const x = i * (barW + barGap);
      const y = centerY - barH / 2;
      const alpha = Math.min(1, 0.3 + amp * 2.4);
      waveformCtx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      waveformCtx.beginPath();
      waveformCtx.roundRect(x, y, barW, barH, barW / 2);
      waveformCtx.fill();
    }
  }

  initWaveformCanvas();

  // ——— Tab Switching ———
  const tabs = document.querySelectorAll(".dash-tabs .dash-tab");
  const panels = document.querySelectorAll(".tab-panel");
  const loadedTabs = new Set<string>(["overview"]);

  function showSkeletonForTab(tabId: string) {
    const containerMap: Record<string, string> = {
      topics: "dash-topics-full",
      decisions: "dash-decisions-list",
      actions: "dash-actions-list",
      people: "dash-participants-list",
      timeline: "dash-timeline",
      transcript: "dash-transcript-list",
      sessions: "dash-sessions-list",
    };
    const containerId = containerMap[tabId];
    if (!containerId) return;
    const container = document.getElementById(containerId);
    if (!container) return;

    if (tabId === "people" || tabId === "transcript" || tabId === "timeline") {
      container.innerHTML = Array(4)
        .fill(0)
        .map(
          () => `
        <div class="skeleton-row">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-text-block">
            <div class="skeleton-text"></div>
            <div class="skeleton-text short"></div>
          </div>
        </div>
      `,
        )
        .join("");
    } else {
      container.innerHTML = Array(4)
        .fill(0)
        .map(
          () => `
        <div class="skeleton-item"></div>
      `,
        )
        .join("");
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabId = (tab as HTMLElement).dataset.tab;
      if (!tabId) return;

      tabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
        t.setAttribute("tabindex", "-1");
      });
      panels.forEach((p) => p.classList.remove("active"));
      (tab as HTMLElement).classList.add("active");
      (tab as HTMLElement).setAttribute("aria-selected", "true");
      (tab as HTMLElement).setAttribute("tabindex", "0");

      const panel = document.getElementById(`tab-${tabId}`);
      if (panel) {
        panel.classList.add("active");
      }

      if (!loadedTabs.has(tabId)) {
        loadedTabs.add(tabId);
        showSkeletonForTab(tabId);
        setTimeout(() => {
          if (tabId === "topics") updateTopics(lastState?.topics || []);
          else if (tabId === "decisions") updateDecisions(lastState?.decisions || []);
          else if (tabId === "actions") updateActions(lastState?.actionItems || []);
          else if (tabId === "people")
            updatePeople(lastState?.participants || [], lastState?.lateJoiners || []);
          else if (tabId === "timeline") updateTimeline(lastState?.timeline || []);
          else if (tabId === "transcript") updateTranscript(lastState?.transcript || []);
          else if (tabId === "history" || tabId === "sessions") loadMeetingHistory();
        }, 150);
      }
    });

    tab.addEventListener("keydown", (e: Event) => {
      const kbEvent = e as KeyboardEvent;
      let newIndex = -1;
      const tabsArray = Array.from(tabs);
      const index = tabsArray.indexOf(tab);

      if (kbEvent.key === "ArrowRight") {
        newIndex = (index + 1) % tabsArray.length;
      } else if (kbEvent.key === "ArrowLeft") {
        newIndex = (index - 1 + tabsArray.length) % tabsArray.length;
      } else if (kbEvent.key === "Home") {
        newIndex = 0;
      } else if (kbEvent.key === "End") {
        newIndex = tabsArray.length - 1;
      }

      if (newIndex !== -1) {
        kbEvent.preventDefault();
        const newTab = tabsArray[newIndex] as HTMLElement;
        newTab.focus();
        newTab.click();
      }
    });
  });

  // ——— State Management ———
  let lastState: State | null = null;

  // ——— Initial State ———
  try {
    lastState = await chrome.runtime.sendMessage({ type: "GET_STATE" });
    if (lastState) updateDashboard(lastState);
  } catch {
    /* no meeting data yet */
  }

  // ——— Listen for State Updates ———
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "STATE_UPDATE") {
      lastState = message.state;
      updateDashboard(message.state);
      if (!message.state?.audioActive) {
        smoothed = new Array(WAVEFORM_N).fill(0);
        drawIdleWaveform();
        if (waveformStatusEl) {
          waveformStatusEl.textContent = "IDLE";
          waveformStatusEl.classList.remove("active");
        }
      }
    }
    if (message.type === "SESSION_ENDED") {
      // Dynamic load requested by human reviewer
      loadMeetingHistory();
      loadedTabs.delete("sessions");
    }
    if (message.type === "WAVEFORM_DATA" && Array.isArray(message.buckets)) {
      drawWaveform(message.buckets);
      if (waveformStatusEl && !waveformStatusEl.classList.contains("active")) {
        waveformStatusEl.textContent = "LIVE";
        waveformStatusEl.classList.add("active");
      }
    }
  });

  // ——— Start Audio Capture (User Gesture via tabCapture) ———
  const audioBtn = document.getElementById("dash-start-audio-btn") as HTMLButtonElement | null;

  function getDashboardMediaStreamId(tabId: number): Promise<string> {
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

  async function requestDashboardMicrophonePermission(): Promise<boolean> {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      console.warn("[Dashboard] Mic permission not granted — waveform will use tab audio only");
      return false;
    }
  }

  audioBtn?.addEventListener("click", async () => {
    if (lastState?.audioActive) {
      try {
        audioBtn.disabled = true;
        await chrome.runtime.sendMessage({ type: "MANUAL_STOP_AUDIO" });
      } catch (err) {
        console.error("[Dashboard] Failed to stop audio:", err);
      } finally {
        audioBtn.disabled = false;
      }
      return;
    }

    try {
      audioBtn.disabled = true;
      audioBtn.textContent = "Starting...";

      const { meetingId } = await startDashboardAudioCapture({
        resolveMeetTab: resolveManualMeetTab,
        getMediaStreamId: getDashboardMediaStreamId,
        requestMicrophonePermission: requestDashboardMicrophonePermission,
        startAudioCapture: (payload) =>
          chrome.runtime.sendMessage({
            type: "MANUAL_START_AUDIO",
            ...payload,
          }),
      });

      setAudioBtnActive(true);
      // Start timer immediately
      startTimer(Date.now());
      const statusText = document.getElementById("dash-status-text");
      const statusDot = document.querySelector(".dash-status-dot");
      if (statusText) statusText.textContent = `Meeting active — ${meetingId || "unknown"}`;
      if (statusDot) statusDot.classList.add("active");
    } catch (err) {
      const e = err as Error;
      if ((e.message || "").includes("active stream")) {
        setAudioBtnActive(true);
        return;
      }
      handleDashboardAudioError(e);
    }

    function handleDashboardAudioError(err: unknown) {
      const e = err as Error;
      console.error("[Dashboard] Failed to start audio:", e);
      if (audioBtn) {
        audioBtn.disabled = false;
        audioBtn.textContent =
          (e.message || String(e)).length > 30 ? "Error — Retry" : e.message || "Error";
        setTimeout(() => {
          if (audioBtn) {
            audioBtn.innerHTML =
              '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-right: 6px;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg> Start Audio';
          }
        }, 3000);
      }
    }
  });

  function setAudioBtnActive(active: boolean) {
    if (!audioBtn) return;
    if (active) {
      audioBtn.classList.add("active");
      audioBtn.disabled = false;
      audioBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-right: 6px;"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 12h6"></path></svg> Stop Audio';
    } else {
      audioBtn.classList.remove("active");
      audioBtn.disabled = false;
      audioBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-right: 6px;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg> Start Audio';
    }
  }

  // ——— Duration Timer ———
  let timerInterval: number | null = null;

  function startTimer(startTime: number) {
    if (timerInterval) return;
    timerInterval = window.setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const timerEl = document.getElementById("dash-timer");
      if (timerEl) timerEl.textContent = formatDuration(elapsed);
    }, 1000);
  }

  // ——— Update Dashboard ———
  function updateDashboard(state: State) {
    currentMeetingId = state.meetingId || "unknown";
    // Status
    const statusDot = document.querySelector(".dash-status-dot");
    const statusText = document.getElementById("dash-status-text");
    if (state.isActive) {
      if (statusDot) statusDot.classList.add("active");
      if (statusText) statusText.textContent = `Meeting active — ${state.meetingId || "unknown"}`;
      if (state.startTime) startTimer(state.startTime);
      setAudioBtnActive(state.audioActive || false);
    } else {
      if (statusDot) statusDot.classList.remove("active");
      if (statusText) statusText.textContent = "No active meeting";
      if (timerInterval) {
        window.clearInterval(timerInterval);
        timerInterval = null;
      }
    }

    // Summary
    const summaryEl = document.getElementById("dash-summary");
    if (summaryEl) summaryEl.textContent = state.summary || "Waiting for conversation to begin...";

    // Current Topic
    const topicEl = document.getElementById("dash-current-topic");
    if (topicEl) topicEl.textContent = state.currentTopic || "Detecting...";

    // Stats
    const topicCountEl = document.getElementById("dash-topic-count");
    if (topicCountEl) topicCountEl.textContent = String(state.topics?.length || 0);

    const decisionCountEl = document.getElementById("dash-decision-count");
    if (decisionCountEl) decisionCountEl.textContent = String(state.decisions?.length || 0);

    const actionCountEl = document.getElementById("dash-action-count");
    if (actionCountEl) actionCountEl.textContent = String(state.actionItems?.length || 0);

    const peopleCountEl = document.getElementById("dash-people-count");
    if (peopleCountEl) peopleCountEl.textContent = String(state.participants?.length || 0);

    // Sentiment
    updateSentiment(state.sentiment);

    // Key Insights
    updateInsights(state.keyInsights);

    updateUnresolvedDiscussions(state.unresolvedDiscussions);
    updateContradictions(state.contradictions);

    // Topics Tab
    if (loadedTabs.has("topics")) updateTopics(state.topics);

    // Decisions Tab
    if (loadedTabs.has("decisions")) updateDecisions(state.decisions);

    // Actions Tab
    if (loadedTabs.has("actions")) updateActions(state.actionItems);

    // People Tab
    if (loadedTabs.has("people")) updatePeople(state.participants, state.lateJoiners);

    // Timeline Tab
    if (loadedTabs.has("timeline")) updateTimeline(state.timeline);

    // Transcript Tab
    if (loadedTabs.has("transcript")) updateTranscript(state.transcript);
  }

  // ——— Sentiment ———
  function updateSentiment(sentiment: string) {
    const fill = document.getElementById("dash-sentiment-fill");
    const label = document.getElementById("dash-sentiment-label");
    const map: Record<string, { width: string; text: string; color: string }> = {
      positive: { width: "85%", text: "Positive 😊", color: "#34D399" },
      negative: { width: "20%", text: "Negative 😟", color: "#F87171" },
      neutral: { width: "50%", text: "Neutral 😐", color: "#94A3B8" },
      mixed: { width: "55%", text: "Mixed 🤔", color: "#FBBF24" },
    };
    const s = map[sentiment] || map.neutral;
    if (fill) fill.style.width = s.width;
    if (label) {
      label.textContent = s.text;
      label.style.color = s.color;
    }
  }

  // ——— Key Insights ———
  function updateInsights(insights: any[]) {
    const list = document.getElementById("dash-insights-list");
    if (!list) return;
    if (!insights || insights.length === 0) {
      list.innerHTML =
        '<li class="empty-msg">Insights will appear as the conversation progresses</li>';
      return;
    }
    list.innerHTML = insights
      .filter((i) => i != null)
      .map((i) => {
        const text = typeof i === "string" ? i : i.text || "";
        const rawScore =
          typeof i === "object" && i !== null
            ? (i as { confidenceScore?: unknown }).confidenceScore
            : undefined;
        const parsedScore = typeof rawScore === "number" ? rawScore : Number(rawScore);
        const safeScore = Number.isFinite(parsedScore)
          ? Math.max(0, Math.min(100, parsedScore))
          : null;
        const score =
          safeScore !== null
            ? ` <span style="font-size: 11px; color: #9ca3af;">(Conf: ${safeScore}%)</span>`
            : "";
        return `<li>${escapeHtml(text)}${score}</li>`;
      })
      .join("");
  }

  function updateUnresolvedDiscussions(discussions: string[]) {
    const list = document.getElementById("dash-unresolved-list");
    if (!list) return;
    if (!discussions || discussions.length === 0) {
      list.innerHTML = '<li class="empty-msg">No unresolved discussions yet</li>';
      return;
    }
    list.innerHTML = discussions.map((d) => `<li>${escapeHtml(d || "")}</li>`).join("");
  }

  function updateContradictions(contradictions: any[]) {
    const list = document.getElementById("dash-contradictions-list");
    if (!list) return;
    if (!contradictions || contradictions.length === 0) {
      list.innerHTML = '<li class="empty-msg">No contradictions detected</li>';
      return;
    }
    list.innerHTML = contradictions
      .filter((c) => c != null)
      .map((c) => {
        const issue = typeof c === "string" ? c : c.issue || "";
        const persists =
          typeof c === "object" && c.persists
            ? ` <span style="font-size: 11px; background: #FEE2E2; color: #DC2626; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Persists</span>`
            : "";
        return `<li>${escapeHtml(issue)}${persists}</li>`;
      })
      .join("");
  }

  // ——— Topics ———
  function updateTopics(topics: Topic[]) {
    const container = document.getElementById("dash-topics-full");
    if (!container) return;
    if (!topics || topics.length === 0) {
      container.innerHTML = '<div class="empty-msg">No topics detected yet</div>';
      return;
    }
    container.innerHTML = topics
      .map(
        (t) => `
      <div class="topic-full-item">
        <div class="topic-full-dot ${sanitizeTopicStatus(t.status)}"></div>
        <div class="topic-full-info">
          <div class="topic-full-name">${escapeHtml(t.name || "")}</div>
          <div class="topic-full-meta">${escapeHtml(t.duration || "")} ${t.startTime ? `• Started ${escapeHtml(t.startTime)}` : ""}</div>
        </div>
        <span class="topic-full-badge ${sanitizeTopicStatus(t.status)}">${escapeHtml(t.status || "active")}</span>
      </div>
    `,
      )
      .join("");
  }

  // ——— Decisions ———
  function updateDecisions(decisions: Decision[]) {
    const container = document.getElementById("dash-decisions-list");
    if (!container) return;
    if (!decisions || decisions.length === 0) {
      container.innerHTML = '<div class="empty-msg">No decisions detected yet</div>';
      return;
    }
    container.innerHTML = decisions
      .map(
        (d) => `
      <div class="decision-item">
        <div class="decision-text">${escapeHtml(d.text || "")} ${d.classification === "tentative" ? '<span style="font-size: 11px; background: #FEF3C7; color: #D97706; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Tentative</span>' : ""}</div>
        <div class="decision-meta">${d.by ? `By ${escapeHtml(d.by)}` : ""} ${d.timestamp ? `• ${escapeHtml(d.timestamp)}` : ""}</div>
      </div>
    `,
      )
      .join("");
  }

  // ——— Action Items ———
  function updateActions(actions: ActionItem[]) {
    const container = document.getElementById("dash-actions-list");
    if (!container) return;
    if (!actions || actions.length === 0) {
      container.innerHTML = '<div class="empty-msg">No action items detected yet</div>';
      return;
    }

    container.innerHTML = "";
    actions.forEach((a, idx) => {
      const normalized = normalizeActionItem(a);
      const task = normalized?.task ?? resolveActionKey(a);
      if (!task) return;
      const owner = normalized?.owner ?? "";
      const deadline = normalized?.deadline ?? "";
      const statusKey = buildActionStatusKey(currentMeetingId, task);
      const done = actionStatuses.get(statusKey) === true;
      const cbId = `action-cb-${idx}`;

      const wrapper = document.createElement("div");
      wrapper.className = "action-item" + (done ? " action-item--done" : "");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "action-checkbox";
      checkbox.id = cbId;
      checkbox.checked = done;
      checkbox.setAttribute("aria-label", "Mark task complete");
      checkbox.dataset.task = task;
      checkbox.dataset.meetingId = currentMeetingId;

      const label = document.createElement("label");
      label.className = "action-info";
      label.htmlFor = cbId;

      const taskDiv = document.createElement("div");
      taskDiv.className = "action-task" + (done ? " action-task--done" : "");
      taskDiv.textContent = task;
      if (a.isSpeculative) {
        const specSpan = document.createElement("span");
        specSpan.style.cssText =
          "font-size: 11px; background: #FEE2E2; color: #DC2626; padding: 2px 6px; border-radius: 4px; margin-left: 6px;";
        specSpan.textContent = "Speculative";
        taskDiv.appendChild(specSpan);
      }
      if (a.confidence && a.confidence !== "high") {
        const confSpan = document.createElement("span");
        confSpan.style.cssText =
          "font-size: 11px; background: #F3F4F6; color: #6B7280; padding: 2px 6px; border-radius: 4px; margin-left: 6px;";
        confSpan.textContent = `Conf: ${a.confidence}`;
        taskDiv.appendChild(confSpan);
      }
      label.appendChild(taskDiv);

      if (owner) {
        const ownerSpan = document.createElement("span");
        ownerSpan.className = "action-owner";
        ownerSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-right:2px"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        ownerSpan.appendChild(document.createTextNode(owner));
        label.appendChild(ownerSpan);
      }

      if (deadline) {
        const deadlineDiv = document.createElement("div");
        deadlineDiv.className = "action-deadline";
        deadlineDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-right:2px"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></svg>`;
        deadlineDiv.appendChild(document.createTextNode(deadline));
        label.appendChild(deadlineDiv);
      }

      checkbox.addEventListener("change", () => {
        const taskText = checkbox.dataset.task || "";
        const meetId = checkbox.dataset.meetingId || currentMeetingId;
        const key = buildActionStatusKey(meetId, taskText);
        const isDone = checkbox.checked;
        actionStatuses.set(key, isDone);
        void persistActionStatuses();
        wrapper.classList.toggle("action-item--done", isDone);
        taskDiv.classList.toggle("action-task--done", isDone);
      });

      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    });
  }

  // ——— People ———
  function updatePeople(participants: string[], lateJoiners: string[]) {
    const container = document.getElementById("dash-participants-list");
    if (!container) return;
    if (!participants || participants.length === 0) {
      container.innerHTML = '<div class="empty-msg">No participants detected</div>';
      return;
    }

    container.innerHTML = participants
      .map((name) => {
        const isLate = lateJoiners?.includes(name);
        const rawName = String(name || "");
        const safeName = escapeHtml(rawName);
        const initials = escapeHtml(
          rawName
            .split(" ")
            .filter(Boolean)
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2),
        );
        return `
        <div class="participant-item">
          <div class="participant-avatar">${initials}</div>
          <span class="participant-name">${safeName}</span>
          <span class="participant-tag ${isLate ? "late" : "original"}">
            ${isLate ? '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-right:2px"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" x2="3" y1="12" y2="12"></line></svg>Late' : "Original"}
          </span>
        </div>
      `;
      })
      .join("");

    // Late joiner section
    const lateCard = document.getElementById("late-joiners-card");
    const lateList = document.getElementById("dash-late-joiners");
    if (lateJoiners && lateJoiners.length > 0) {
      if (lateCard) lateCard.style.display = "block";
      if (lateList) {
        lateList.innerHTML = lateJoiners
          .map(
            (name) => `
          <div class="late-joiner-card-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="color: #A3A3A3;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" x2="3" y1="12" y2="12"></line></svg>
            <span style="font-weight: 500; color: #FAFAFA;">${escapeHtml(name || "")}</span>
            <span style="margin-left: auto; color: #737373; font-size: 11px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-right:2px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>Brief sent
            </span>
          </div>
        `,
          )
          .join("");
      }
    } else {
      if (lateCard) lateCard.style.display = "none";
    }
  }

  // ——— Timeline ———
  function updateTimeline(timeline: TimelineEvent[]) {
    const container = document.getElementById("dash-timeline");
    if (!container) return;
    if (!timeline || timeline.length === 0) {
      container.innerHTML =
        '<div class="empty-msg">Timeline will build as the meeting progresses</div>';
      return;
    }

    container.innerHTML = timeline
      .map((entry) => {
        const icon = getTimelineIcon(entry.event);
        return `
        <div class="timeline-item">
          <div class="timeline-marker">${icon}</div>
          <div class="timeline-info">
            <div class="timeline-event">${escapeHtml(entry.event || "")}</div>
            <div class="timeline-time">${formatDuration(entry.elapsed || 0)} elapsed</div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  function getTimelineIcon(event: string) {
    const label = String(event || "");
    const iconBase =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon">';
    if (label.includes("started"))
      return (
        iconBase +
        '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>'
      );
    if (label.includes("ended"))
      return (
        iconBase +
        '<rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 12h6"></path></svg>'
      );
    if (label.includes("joined"))
      return (
        iconBase +
        '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" x2="3" y1="12" y2="12"></line></svg>'
      );
    if (label.includes("Topic"))
      return (
        iconBase +
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>'
      );
    if (label.includes("Decision"))
      return (
        iconBase +
        '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
      );
    return (
      iconBase +
      '<line x1="12" x2="12" y1="20" y2="4"></line><line x1="6" x2="18" y1="20" y2="20"></line><line x1="14" x2="14" y1="4" y2="10"></line></svg>'
    );
  }

  // ——— Live Transcript ———
  function updateTranscript(transcript: TranscriptEntry[]) {
    if (!transcriptContainer) return;

    if (!transcript || transcript.length === 0) {
      transcriptContainer.innerHTML =
        '<div class="empty-msg">No transcript yet. Start audio to begin capturing speech.</div>';

      resetTranscriptSearchState();

      return;
    }

    const startTime = transcript[0]?.timestamp || Date.now();

    transcriptContainer.innerHTML = transcript
      .map((entry) => {
        const timestamp = entry.timestamp || Date.now();
        const elapsed = Math.round((timestamp - startTime) / 1000);
        const timeStr = formatDuration(elapsed);
        const speaker = escapeHtml(entry.speaker || "Unknown");
        const initials = speaker
          .split(" ")
          .filter(Boolean)
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        const isAudio = (entry.speaker || "") === "Audio";
        const text = escapeHtml(entry.text || "");

        return `
        <div class="transcript-entry ${isAudio ? "audio-source" : ""}">
          <div class="transcript-time">${timeStr}</div>
          <div class="transcript-avatar">${isAudio ? "🎙" : initials}</div>
          <div class="transcript-body">
            <div class="transcript-speaker">${speaker}</div>
            <div class="transcript-text">${text}</div>
          </div>
        </div>
      `;
      })
      .join("");

    if (searchInput?.value.trim()) {
      executeTranscriptSearch(true);
    } else {
      transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
      updateTranscriptSearchControls();
    }
  }

  // ——— Unified Export Helper (Handles both Live & History) ———
  function generateMarkdown(state: State): string {
    const dateVal = state.savedAt || state.startTime || Date.now();
    const date = new Date(dateVal).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let md = `# Meeting Summary — ${date}\n\n`;
    md += `**Meeting ID:** ${state.meetingId || "N/A"}\n`;

    // Safely extract duration even if the type strictness misses it
    const duration = (state as State & { duration?: number }).duration || 0;
    md += `**Duration:** ${formatDuration(duration)}\n`;
    md += `**Sentiment:** ${state.sentiment || "neutral"}\n\n`;

    md += `## Attendees\n`;
    if (state.participants?.length) {
      md += state.participants.map((p) => `- ${p}`).join("\n") + "\n\n";
    } else {
      md += `_No participants detected_\n\n`;
    }

    md += `## Summary\n`;
    md += `${state.summary || "_No summary available_"}\n\n`;

    md += `## Action Items\n`;
    if (state.actionItems?.length) {
      const sessionMeetingId = state.meetingId || "unknown";
      state.actionItems.forEach((a: ActionItem) => {
        const task = resolveActionKey(a);
        if (!task) return;
        const statusKey = buildActionStatusKey(sessionMeetingId, task);
        const done = actionStatuses.get(statusKey) === true;
        md += done ? `- [x] ${task}` : `- [ ] ${task}`;
        if (a.owner) md += ` — ${a.owner}`;
        if (a.deadline) md += ` (due: ${a.deadline})`;
        md += "\n";
      });
      md += "\n";
    } else {
      md += `_No action items_\n\n`;
    }

    md += `## Key Decisions\n`;
    if (state.decisions?.length) {
      state.decisions.forEach((d: Decision) => {
        md += `- ${d.text}${d.by ? ` — ${d.by}` : ""}\n`;
      });
      md += "\n";
    } else {
      md += `_No decisions recorded_\n\n`;
    }

    md += `## Topics Covered\n`;
    if (state.topics?.length) {
      state.topics.forEach((t: Topic) => {
        md += `- ${t.name} _(${t.status})_\n`;
      });
      md += "\n";
    } else {
      md += `_No topics detected_\n\n`;
    }

    md += `## Key Insights\n`;
    if (state.keyInsights?.length) {
      state.keyInsights
        ?.filter((i) => i != null)
        .forEach((i: any) => {
          const text = typeof i === "string" ? i : i.text;

          if (text) {
            md += `- ${text}\n`;
          }
        });
      md += "\n";
    } else {
      md += `_No insights available_\n\n`;
    }

    return md;
  }

  let exportToastTimer: number | null = null;

  function showToast(message: string, type: "success" | "error" = "success"): void {
    const toast = document.getElementById("export-toast") as HTMLDivElement;
    if (!toast) return;
    if (exportToastTimer) window.clearTimeout(exportToastTimer);
    toast.textContent = message;
    toast.className = `export-toast ${type} show`;
    exportToastTimer = window.setTimeout(() => {
      toast.className = "export-toast";
      exportToastTimer = null;
    }, 3000);
  }

  function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }

  // ——— Export Dropdown ———
  const exportBtn = document.getElementById("export-btn") as HTMLButtonElement;
  const exportDropdown = document.getElementById("export-dropdown") as HTMLDivElement;

  exportBtn?.addEventListener("click", () => {
    const isHidden = exportDropdown.hasAttribute("hidden");
    if (isHidden) {
      exportDropdown.removeAttribute("hidden");
      exportBtn.setAttribute("aria-expanded", "true");
    } else {
      exportDropdown.setAttribute("hidden", "");
      exportBtn.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("click", (e: MouseEvent) => {
    const wrapper = document.getElementById("export-wrapper");
    if (wrapper && !wrapper.contains(e.target as Node)) {
      exportDropdown?.setAttribute("hidden", "");
      exportBtn?.setAttribute("aria-expanded", "false");
    }
  });

  // --- MD EXPORT (LIVE DASHBOARD) ---
  document.getElementById("export-md-btn")?.addEventListener("click", async () => {
    try {
      const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      if (!state) throw new Error("No meeting data available");
      const markdown = generateMarkdown(state);
      const filename = `meeting-summary-${new Date().toISOString().slice(0, 10)}.md`;
      downloadFile(markdown, filename, "text/markdown");
      showToast("Downloaded as .md file", "success");
    } catch (err) {
      const e = err as Error;
      showToast("Failed to export: " + (e.message || String(e)), "error");
    } finally {
      exportDropdown?.setAttribute("hidden", "");
      exportBtn?.setAttribute("aria-expanded", "false");
    }
  });

  // --- TXT EXPORT (LIVE DASHBOARD) ---
  document.getElementById("export-txt-btn")?.addEventListener("click", async () => {
    try {
      const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      if (!state) throw new Error("No meeting data available");
      const textContent = generateMarkdown(state);
      const filename = `meeting-summary-${new Date().toISOString().slice(0, 10)}.txt`;
      downloadFile(textContent, filename, "text/plain");
      showToast("Downloaded as .txt file", "success");
    } catch (err) {
      const e = err as Error;
      showToast("Failed to export: " + (e.message || String(e)), "error");
    } finally {
      exportDropdown?.setAttribute("hidden", "");
      exportBtn?.setAttribute("aria-expanded", "false");
    }
  });

  document.getElementById("export-clipboard-btn")?.addEventListener("click", async () => {
    try {
      const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      if (!state) {
        showToast("No meeting data available", "error");
        return;
      }
      const markdown = generateMarkdown(state);
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(markdown);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = markdown;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      showToast("Copied to clipboard", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to copy to clipboard", "error");
    } finally {
      exportDropdown?.setAttribute("hidden", "");
      exportBtn?.setAttribute("aria-expanded", "false");
    }
  });

  document.getElementById("export-json-btn")?.addEventListener("click", async () => {
    try {
      const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      if (!state) throw new Error("No meeting data available");
      const sessionData = {
        exportedAt: new Date().toISOString(),
        meetingId: state.meetingId || "unknown",
        duration: (state as State & { duration?: number }).duration || 0,
        sentiment: state.sentiment || "neutral",
        summary: state.summary || "",
        participants: state.participants || [],
        topics: state.topics || [],
        decisions: state.decisions || [],
        actionItems: state.actionItems || [],
        keyInsights: state.keyInsights || [],
        timeline: state.timeline || [],
        transcript: state.transcript || [],
      };
      const filename = `meeting-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadFile(JSON.stringify(sessionData, null, 2), filename, "application/json");
      showToast("Downloaded as .json backup", "success");
    } catch (err) {
      const e = err as Error;
      showToast("Failed to export: " + (e.message || String(e)), "error");
    } finally {
      exportDropdown?.setAttribute("hidden", "");
      exportBtn?.setAttribute("aria-expanded", "false");
    }
  });

  // ——— Helpers ———
  function escapeHtml(str: string) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function sanitizeTopicStatus(status: string) {
    if (status === "completed") return "completed";
    if (status === "unresolved") return "unresolved";
    return "active";
  }

  function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // ——— Meeting History Tab ———
  let sessionToDelete: string | null = null;

  async function loadMeetingHistory() {
    try {
      const sessions: State[] = await chrome.runtime.sendMessage({ type: "GET_SAVED_SESSIONS" });
      const container = document.getElementById("dash-history-list");
      if (!container) return;
      if (!sessions || sessions.length === 0) {
        container.innerHTML =
          '<div class="empty-msg">No history exists yet. Sessions are saved when you end a meeting and click "Save".</div>';
        return;
      }

      container.innerHTML = sessions
        .map((s: State) => {
          const date = new Date(s.savedAt || s.startTime || Date.now()).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" },
          );
          const time = new Date(s.savedAt || s.startTime || Date.now()).toLocaleTimeString(
            "en-US",
            { hour: "2-digit", minute: "2-digit" },
          );
          const topicCount = s.topics?.length || 0;
          const decisionCount = s.decisions?.length || 0;
          const actionCount = s.actionItems?.length || 0;

          return `
          <div class="session-item" data-session-id="${s.id}">
            <div class="session-item-header">
              <div>
                <div class="session-item-date">${escapeHtml(date)} at ${escapeHtml(time)}</div>
                <div class="session-item-id" title="${escapeHtml(s.meetingUrl || "")}">${escapeHtml(s.meetingUrl || s.meetingId || "Unknown Meeting")}</div>
              </div>
              <div class="session-item-meta">
                <span>${formatDuration((s as State & { duration?: number }).duration || 0)}</span>
              </div>
            </div>
            <div class="session-item-summary" style="cursor: pointer;" title="Click to expand/collapse summary">${escapeHtml(s.summary || "No summary available")}</div>
            <div class="session-item-stats">
              <span>${topicCount} topics</span>
              <span>${decisionCount} decisions</span>
              <span>${actionCount} actions</span>
            </div>
            <div class="session-item-actions">
              <button class="session-export-btn" data-session-id="${s.id}" title="Export as Markdown">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>
                Export
              </button>
              <button class="session-export-btn session-download-btn" data-session-id="${s.id}" title="Download as Markdown File">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>
                Download
              </button>
              <button class="session-delete-btn" data-session-id="${s.id}" title="Delete session">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                Delete
              </button>
            </div>
          </div>
        `;
        })
        .join("");

      // Wire up export buttons
      container
        .querySelectorAll<HTMLButtonElement>(".session-export-btn:not(.session-download-btn)")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            const sessionId = btn.dataset.sessionId;
            const session = sessions.find((s: State) => (s.id ?? "") === sessionId);
            if (session) exportSessionMarkdown(session);
          });
        });

      container.querySelectorAll<HTMLButtonElement>(".session-download-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sessionId = btn.dataset.sessionId;
          const session = sessions.find((s: State) => (s.id ?? "") === sessionId);
          if (session) downloadSessionMarkdown(session);
        });
      });

      // Wire up delete buttons
      container.querySelectorAll<HTMLButtonElement>(".session-delete-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          sessionToDelete = btn.dataset.sessionId || null;
          if (sessionToDelete) {
            document.getElementById("delete-confirm-modal")?.classList.remove("hidden");
          }
        });
      });

      // Wire up summary expand/collapse
      container.querySelectorAll<HTMLDivElement>(".session-item-summary").forEach((summary) => {
        summary.addEventListener("click", () => {
          const item = summary.closest(".session-item");
          if (item) item.classList.toggle("expanded");
        });
      });
    } catch (err) {
      console.error("[Dashboard] Failed to load history:", err);
    }
  }

  // Modal logic
  document.getElementById("cancel-delete-btn")?.addEventListener("click", () => {
    sessionToDelete = null;
    document.getElementById("delete-confirm-modal")?.classList.add("hidden");
  });
  document.getElementById("confirm-delete-btn")?.addEventListener("click", async () => {
    if (sessionToDelete) {
      await chrome.runtime.sendMessage({
        type: "DELETE_SAVED_SESSION",
        sessionId: sessionToDelete,
      });
      sessionToDelete = null;
      document.getElementById("delete-confirm-modal")?.classList.add("hidden");
      loadMeetingHistory();
    }
  });

  // ——— HISTORY EXPORT ACTIONS (Now perfectly unified with the dynamic generator!) ———
  function exportSessionMarkdown(session: State) {
    const md = generateMarkdown(session);

    navigator.clipboard
      .writeText(md)
      .then(() => {
        showToast("Session exported to clipboard", "success");
      })
      .catch((err) => {
        const e = err as Error;
        showToast("Failed to export session: " + (e.message || String(e)), "error");
      });
  }

  function downloadSessionMarkdown(session: State) {
    const md = generateMarkdown(session);

    const dateVal = session.savedAt || session.startTime || Date.now();
    const filename = `meeting-summary-${new Date(dateVal).toISOString().slice(0, 10)}.md`;
    downloadFile(md, filename, "text/markdown");
    showToast("Downloaded as .md file", "success");
  }

  // ——— Transcript Search ———
  let searchMatches: HTMLElement[] = [];
  let currentMatchIndex = -1;
  let searchDebounceTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  function resetTranscriptSearchState(): void {
    searchMatches = [];
    currentMatchIndex = -1;

    if (searchCounter) {
      searchCounter.textContent = "0/0";
    }

    if (searchPrevBtn) {
      searchPrevBtn.disabled = true;
    }

    if (searchNextBtn) {
      searchNextBtn.disabled = true;
    }

    if (searchClearBtn) {
      searchClearBtn.disabled = !searchInput?.value.trim();
      searchClearBtn.classList.toggle("visible", Boolean(searchInput?.value.trim()));
    }
  }

  function unwrapTranscriptSearchMarks(): void {
    if (!transcriptContainer) return;

    transcriptContainer.querySelectorAll("mark.search-match").forEach((mark) => {
      const parent = mark.parentNode;

      if (!parent) return;

      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    });
  }

  function updateTranscriptSearchControls(): void {
    const hasQuery = Boolean(searchInput?.value.trim());
    const hasMatches = searchMatches.length > 0;

    if (searchCounter) {
      searchCounter.textContent = hasMatches
        ? `${currentMatchIndex + 1}/${searchMatches.length}`
        : "0/0";
    }

    if (searchPrevBtn) {
      searchPrevBtn.disabled = !hasMatches;
    }

    if (searchNextBtn) {
      searchNextBtn.disabled = !hasMatches;
    }

    if (searchClearBtn) {
      searchClearBtn.disabled = !hasQuery;
      searchClearBtn.classList.toggle("visible", hasQuery);
    }
  }

  function updateActiveSearchMatch(scrollToMatch = true): void {
    searchMatches.forEach((match, index) => {
      match.classList.toggle("active", index === currentMatchIndex);
    });

    updateTranscriptSearchControls();

    if (!scrollToMatch) return;

    const activeMatch = searchMatches[currentMatchIndex];

    activeMatch?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }

  function executeTranscriptSearch(preserveIndex = false): void {
    if (
      !searchInput ||
      !searchCounter ||
      !searchClearBtn ||
      !searchPrevBtn ||
      !searchNextBtn ||
      !transcriptContainer
    ) {
      return;
    }

    const query = searchInput.value.trim();
    const normalizedQuery = query.toLowerCase();
    const previousIndex = currentMatchIndex;

    unwrapTranscriptSearchMarks();

    searchMatches = [];
    currentMatchIndex = -1;

    if (!normalizedQuery) {
      updateTranscriptSearchControls();
      return;
    }

    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(transcriptContainer, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parentElement = node.parentElement;

        if (!parentElement) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parentElement.closest(".empty-msg")) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!parentElement.closest(".transcript-text")) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!node.nodeValue?.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node = walker.nextNode();

    while (node) {
      textNodes.push(node as Text);
      node = walker.nextNode();
    }

    textNodes.forEach((textNode) => {
      const textContent = textNode.nodeValue || "";
      const lowerTextContent = textContent.toLowerCase();

      let matchIndex = lowerTextContent.indexOf(normalizedQuery);
      let lastIndex = 0;

      if (matchIndex === -1) {
        return;
      }

      const fragment = document.createDocumentFragment();

      while (matchIndex !== -1) {
        if (matchIndex > lastIndex) {
          fragment.appendChild(document.createTextNode(textContent.slice(lastIndex, matchIndex)));
        }

        const mark = document.createElement("mark");
        mark.className = "search-match";
        mark.dataset.transcriptMatch = "true";
        mark.textContent = textContent.slice(matchIndex, matchIndex + query.length);

        fragment.appendChild(mark);
        searchMatches.push(mark);

        lastIndex = matchIndex + query.length;
        matchIndex = lowerTextContent.indexOf(normalizedQuery, lastIndex);
      }

      if (lastIndex < textContent.length) {
        fragment.appendChild(document.createTextNode(textContent.slice(lastIndex)));
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    });

    if (searchMatches.length === 0) {
      updateTranscriptSearchControls();
      return;
    }

    if (preserveIndex && previousIndex >= 0 && previousIndex < searchMatches.length) {
      currentMatchIndex = previousIndex;
    } else {
      currentMatchIndex = 0;
    }

    updateActiveSearchMatch(true);
  }

  function clearTranscriptSearch(): void {
    if (!searchInput || !transcriptContainer) return;

    searchInput.value = "";
    unwrapTranscriptSearchMarks();

    searchMatches = [];
    currentMatchIndex = -1;

    updateTranscriptSearchControls();

    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
    searchInput.focus();
  }

  function navigateTranscriptMatch(direction: 1 | -1): void {
    if (searchMatches.length === 0) return;

    currentMatchIndex =
      (currentMatchIndex + direction + searchMatches.length) % searchMatches.length;

    updateActiveSearchMatch(true);
  }

  searchInput?.addEventListener("input", () => {
    if (searchDebounceTimer) {
      globalThis.clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = globalThis.setTimeout(() => {
      executeTranscriptSearch(false);
    }, 150);
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      navigateTranscriptMatch(event.shiftKey ? -1 : 1);
    }

    if (event.key === "Escape") {
      event.preventDefault();
      clearTranscriptSearch();
    }
  });

  searchClearBtn?.addEventListener("click", clearTranscriptSearch);

  searchPrevBtn?.addEventListener("click", () => {
    navigateTranscriptMatch(-1);
  });

  searchNextBtn?.addEventListener("click", () => {
    navigateTranscriptMatch(1);
  });

  document.addEventListener("keydown", (event) => {
    const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f";

    if (!isSearchShortcut) return;

    const transcriptTab = document.querySelector('[data-tab="transcript"]') as HTMLElement | null;

    event.preventDefault();
    transcriptTab?.click();

    globalThis.setTimeout(() => {
      searchInput?.focus();
      searchInput?.select();
    }, 0);
  });

  updateTranscriptSearchControls();

  // Load sessions on tab switch
  document.querySelector('[data-tab="sessions"]')?.addEventListener("click", loadMeetingHistory);
  // Load history on tab switch
  document.querySelector('[data-tab="history"]')?.addEventListener("click", loadMeetingHistory);
});
