import { State, Topic, TranscriptEntry, TimelineEvent, Decision, ActionItem } from "./types";
import { initTheme } from "./theme.js";

initTheme();

document.addEventListener("DOMContentLoaded", async () => {
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
  const tabs = document.querySelectorAll(".dash-tab");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      (tab as HTMLElement).classList.add("active");
      const tabId = (tab as HTMLElement).dataset.tab;
      if (tabId) {
        document.getElementById(`tab-${tabId}`)?.classList.add("active");
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
      // Reload sessions if on that tab
      const sessionsTab = document.querySelector('[data-tab="sessions"]');
      if (sessionsTab?.classList.contains("active")) {
        loadSavedSessions();
      }
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
  audioBtn?.addEventListener("click", async () => {
    if (lastState?.audioActive) {
      console.log("[Dashboard] Audio already active, skipping.");
      return;
    }

    try {
      audioBtn.disabled = true;
      audioBtn.textContent = "Starting...";

      // Request mic permission from this user-facing page while the gesture is still live.
      // Chrome grants the permission to the extension origin so the offscreen doc inherits it.
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micStream.getTracks().forEach((t) => t.stop());
      } catch {
        console.warn("[Dashboard] Mic permission not granted — waveform will use tab audio only");
      }

      chrome.tabs.query({ url: "https://meet.google.com/*" }, (meetTabs) => {
        if (meetTabs.length === 0) {
          handleDashboardAudioError(new Error("No Google Meet tab found"));
          return;
        }
        const meetTab = meetTabs[0];
        const urlMatch = meetTab.url?.match(/meet\.google\.com\/([a-z\-]+)/);
        const meetingId = urlMatch ? urlMatch[1] : null;

        // --- Get Media Stream ID in foreground (dashboard) to ensure user gesture propagation ---
        chrome.tabCapture.getMediaStreamId({ targetTabId: meetTab.id }, async (streamId) => {
          if (chrome.runtime.lastError) {
            const err = chrome.runtime.lastError.message || "Unknown error";
            console.error("[Dashboard] getMediaStreamId error:", err);
            if (err.includes("active stream")) {
              setAudioBtnActive(true);
              return;
            } else {
              handleDashboardAudioError(
                new Error('Capture permission denied. Try clicking "Start Audio" again.'),
              );
              return;
            }
          }

          if (!streamId) {
            handleDashboardAudioError(
              new Error('Capture permission denied. Try clicking "Start Audio" again.'),
            );
            return;
          }

          try {
            const response = await chrome.runtime.sendMessage({
              type: "MANUAL_START_AUDIO",
              tabId: meetTab.id,
              meetingId: meetingId,
              streamId: streamId,
              includeMicrophone: true,
            });

            if (response && response.success) {
              setAudioBtnActive(true);
              // Start timer immediately
              startTimer(Date.now());
              const statusText = document.getElementById("dash-status-text");
              const statusDot = document.querySelector(".dash-status-dot");
              if (statusText) statusText.textContent = `Meeting active — ${meetingId || "unknown"}`;
              if (statusDot) statusDot.classList.add("active");
            } else {
              throw new Error(response?.error || "Failed to start audio");
            }
          } catch (err: any) {
            handleDashboardAudioError(err);
          }
        });
      });
    } catch (err: any) {
      handleDashboardAudioError(err);
    }

    function handleDashboardAudioError(err: any) {
      console.error("[Dashboard] Failed to start audio:", err);
      if (audioBtn) {
        audioBtn.disabled = false;
        audioBtn.textContent =
          (err.message || String(err)).length > 30 ? "Error — Retry" : err.message || "Error";
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
      audioBtn.style.display = "none";
      audioBtn.classList.add("active");
    } else {
      audioBtn.style.display = "flex";
      audioBtn.classList.remove("active");
      audioBtn.disabled = false;
      audioBtn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-right: 6px;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg> Start Audio';
    }
  }

  // ——— Duration Timer ———
  let timerInterval: number | NodeJS.Timeout | null = null;

  function startTimer(startTime: number) {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const timerEl = document.getElementById("dash-timer");
      if (timerEl) timerEl.textContent = formatDuration(elapsed);
    }, 1000);
  }

  // ——— Update Dashboard ———
  function updateDashboard(state: State) {
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
        clearInterval(timerInterval as any);
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

    // Topics Tab
    updateTopics(state.topics);

    // Decisions Tab
    updateDecisions(state.decisions);

    // Actions Tab
    updateActions(state.actionItems);

    // People Tab
    updatePeople(state.participants, state.lateJoiners);

    // Timeline Tab
    updateTimeline(state.timeline);

    // Transcript Tab
    updateTranscript(state.transcript);
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
  function updateInsights(insights: string[]) {
    const list = document.getElementById("dash-insights-list");
    if (!list) return;
    if (!insights || insights.length === 0) {
      list.innerHTML =
        '<li class="empty-msg">Insights will appear as the conversation progresses</li>';
      return;
    }
    list.innerHTML = insights.map((i) => `<li>${escapeHtml(i || "")}</li>`).join("");
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
        <div class="decision-text">${escapeHtml(d.text || "")}</div>
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
    container.innerHTML = actions
      .map(
        (a) => `
      <div class="action-item">
        <div class="action-check"></div>
        <div class="action-info">
          <div class="action-task">${escapeHtml(a.task || "")}</div>
          ${a.owner ? `<span class="action-owner"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-right:2px"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>${escapeHtml(a.owner)}</span>` : ""}
          ${a.deadline ? `<div class="action-deadline"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" style="margin-right:2px"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></svg>${escapeHtml(a.deadline)}</div>` : ""}
        </div>
      </div>
    `,
      )
      .join("");
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
    const container = document.getElementById("dash-transcript-list");
    if (!container) return;
    if (!transcript || transcript.length === 0) {
      container.innerHTML =
        '<div class="empty-msg">No transcript yet. Start audio to begin capturing speech.</div>';
      return;
    }

    const startTime = transcript[0]?.timestamp || Date.now();

    container.innerHTML = transcript
      .map((entry) => {
        const timestamp = entry.timestamp || Date.now();
        const elapsed = Math.round((timestamp - startTime) / 1000);
        const timeStr = formatDuration(elapsed);
        const speaker = escapeHtml(entry.speaker || "Unknown");
        const initials = speaker
          .split(" ")
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

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  // ——— Export Helpers ———
  function generateMarkdown(state: State): string {
    let markdown = `# Meeting Summary\n\n`;
    markdown += `**Date:** ${new Date().toLocaleDateString()}\n`;
    markdown += `**Duration:** ${formatDuration(state.duration || 0)}\n`;
    markdown += `**Participants:** ${state.participants?.join(", ") || "N/A"}\n\n`;
    markdown += `## Summary\n${state.summary || "N/A"}\n\n`;
    if (state.topics?.length) {
      markdown += `## Topics\n`;
      state.topics.forEach((t: Topic) => (markdown += `- ${t.name} (${t.status})\n`));
      markdown += "\n";
    }
    if (state.decisions?.length) {
      markdown += `## Decisions\n`;
      state.decisions.forEach(
        (d: Decision) => (markdown += `- ${d.text}${d.by ? ` — ${d.by}` : ""}\n`),
      );
      markdown += "\n";
    }
    if (state.actionItems?.length) {
      markdown += `## Action Items\n`;
      state.actionItems.forEach((a: ActionItem) => {
        markdown += `- [ ] ${a.task}`;
        if (a.owner) markdown += ` → ${a.owner}`;
        if (a.deadline) markdown += ` (due: ${a.deadline})`;
        markdown += "\n";
      });
    }
    return markdown;
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

  document.getElementById("export-md-btn")?.addEventListener("click", async () => {
    try {
      const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      if (!state) throw new Error("No meeting data available");
      const markdown = generateMarkdown(state);
      const filename = `meeting-summary-${new Date().toISOString().slice(0, 10)}.md`;
      downloadFile(markdown, filename, "text/markdown");
      showToast("Downloaded as .md file", "success");
    } catch (err) {
      showToast("Failed to export: " + (err instanceof Error ? err.message : String(err)), "error");
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
        summary: state.summary || "",
        participants: state.participants || [],
        topics: state.topics || [],
        decisions: state.decisions || [],
        actionItems: state.actionItems || [],
        transcript: state.transcript || [],
        timeline: state.timeline || [],
      };
      const filename = `meeting-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadFile(JSON.stringify(sessionData, null, 2), filename, "application/json");
      showToast("Downloaded as .json backup", "success");
    } catch (err) {
      showToast("Failed to export: " + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      exportDropdown?.setAttribute("hidden", "");
      exportBtn?.setAttribute("aria-expanded", "false");
    }
  });

  document.getElementById("export-clipboard-btn")?.addEventListener("click", async () => {
    try {
      const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      if (!state) return;
      const markdown = generateMarkdown(state);
      await navigator.clipboard.writeText(markdown);
      showToast("Copied to clipboard", "success");
    } catch {
      showToast("Failed to copy to clipboard", "error");
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
    return status === "completed" ? "completed" : "active";
  }

  function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // ——— Saved Sessions Tab ———
  async function loadSavedSessions() {
    try {
      const sessions: State[] = await chrome.runtime.sendMessage({ type: "GET_SAVED_SESSIONS" });
      const container = document.getElementById("dash-sessions-list");
      if (!container) return;
      if (!sessions || sessions.length === 0) {
        container.innerHTML =
          '<div class="empty-msg">No saved sessions yet. Sessions are saved when you end a meeting and click "Save".</div>';
        return;
      }

      container.innerHTML = sessions
        .map((s: State) => {
          const date = new Date((s as any).savedAt || s.startTime || Date.now()).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric", year: "numeric" },
          );
          const time = new Date((s as any).savedAt || s.startTime || Date.now()).toLocaleTimeString(
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
                <div class="session-item-id">${escapeHtml(s.meetingId || "Unknown Meeting")}</div>
              </div>
              <div class="session-item-meta">
                <span>${formatDuration(s.duration || 0)}</span>
              </div>
            </div>
            <div class="session-item-summary">${escapeHtml(s.summary || "No summary available")}</div>
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
            const session = sessions.find((s: State) => (s as any).id === sessionId);
            if (session) exportSessionMarkdown(session);
          });
        });

      container.querySelectorAll<HTMLButtonElement>(".session-download-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const sessionId = btn.dataset.sessionId;
          const session = sessions.find((s: State) => (s as any).id === sessionId);
          if (session) downloadSessionMarkdown(session);
        });
      });

      // Wire up delete buttons
      container.querySelectorAll<HTMLButtonElement>(".session-delete-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const sessionId = btn.dataset.sessionId;
          if (sessionId) {
            await chrome.runtime.sendMessage({ type: "DELETE_SAVED_SESSION", sessionId });
            loadSavedSessions();
          }
        });
      });
    } catch (err) {
      console.error("[Dashboard] Failed to load sessions:", err);
    }
  }

  function generateSessionMarkdown(session: State): string {
    let md = `# Meeting Summary\n\n`;
    md += `**Date:** ${new Date((session as any).savedAt || session.startTime).toLocaleString()}\n`;
    md += `**Duration:** ${formatDuration(session.duration || 0)}\n`;
    md += `**Meeting ID:** ${session.meetingId || "N/A"}\n`;
    md += `**Participants:** ${session.participants?.join(", ") || "N/A"}\n\n`;
    md += `## Summary\n${session.summary || "N/A"}\n\n`;

    if (session.topics?.length) {
      md += `## Topics\n`;
      session.topics.forEach((t: Topic) => (md += `- ${t.name} (${t.status})\n`));
      md += "\n";
    }
    if (session.decisions?.length) {
      md += `## Decisions\n`;
      session.decisions.forEach(
        (d: Decision) => (md += `- ${d.text}${d.by ? ` — ${d.by}` : ""}\n`),
      );
      md += "\n";
    }
    if (session.actionItems?.length) {
      md += `## Action Items\n`;
      session.actionItems.forEach((a: ActionItem) => {
        md += `- [ ] ${a.task}`;
        if (a.owner) md += ` → ${a.owner}`;
        if (a.deadline) md += ` (due: ${a.deadline})`;
        md += "\n";
      });
    }
    return md;
  }

  function exportSessionMarkdown(session: State) {
    const md = generateSessionMarkdown(session);

    navigator.clipboard
      .writeText(md)
      .then(() => {
        showToast("Session exported to clipboard", "success");
      })
      .catch((err) => {
        showToast(
          "Failed to export session: " + (err instanceof Error ? err.message : String(err)),
          "error",
        );
      });
  }

  function downloadSessionMarkdown(session: State) {
    const md = generateSessionMarkdown(session);

    const filename = `meeting-summary-${new Date((session as any).savedAt || session.startTime).toISOString().slice(0, 10)}.md`;
    downloadFile(md, filename, "text/markdown");
    showToast("Downloaded as .md file", "success");
  }

  // Load sessions on tab switch
  document.querySelector('[data-tab="sessions"]')?.addEventListener("click", loadSavedSessions);

  // ——— Usage Stats Tab ———
  document.querySelector('[data-tab="usage"]')?.addEventListener("click", loadUsageStats);

  // Auto-refresh usage widget when storage changes (e.g. background writes new stats)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      if (changes.usageStats) {
        loadUsageStats();
      }
      if (changes.dev_mode) {
        const simCard = document.getElementById("dev-simulate-card");
        if (simCard) {
          simCard.style.display = changes.dev_mode.newValue ? "block" : "none";
        }
      }
    }
  });

  // Load usage stats on initial open
  loadUsageStats();

  // Check dev_mode on initial open to toggle Dev Tools card visibility
  chrome.storage.local.get("dev_mode", (result) => {
    const simCard = document.getElementById("dev-simulate-card");
    if (simCard) {
      simCard.style.display = result.dev_mode ? "block" : "none";
    }
  });

  function sanitizeUsageStats(stats: any): Record<
    string,
    {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      audioSeconds: number;
      estimatedCost: number;
    }
  > {
    const sanitized: Record<string, any> = {};
    if (!stats || typeof stats !== "object") return sanitized;
    for (const [key, val] of Object.entries(stats)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      if (val && typeof val === "object") {
        const v = val as any;
        sanitized[key] = {
          promptTokens: Number(v.promptTokens) || 0,
          completionTokens: Number(v.completionTokens) || 0,
          totalTokens: Number(v.totalTokens) || 0,
          audioSeconds: Number(v.audioSeconds) || 0,
          estimatedCost: Number(v.estimatedCost) || 0,
        };
      }
    }
    return sanitized;
  }

  async function loadUsageStats() {
    try {
      const rawStats = await chrome.runtime.sendMessage({ type: "GET_USAGE_STATS" });
      const usageStats = sanitizeUsageStats(rawStats);

      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const today = `${year}-${month}-${day}`;
      const todayStats = usageStats[today] ?? {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        audioSeconds: 0,
        estimatedCost: 0,
      };

      // Update date badge
      const dateBadge = document.getElementById("usage-date-badge");
      if (dateBadge) dateBadge.textContent = today;

      // Update hero cost
      const costEl = document.getElementById("usage-cost-value");
      if (costEl) costEl.textContent = todayStats.estimatedCost.toFixed(4);

      // Update stat cells
      const totalEl = document.getElementById("usage-total-tokens");
      if (totalEl) totalEl.textContent = todayStats.totalTokens.toLocaleString();

      const promptEl = document.getElementById("usage-prompt-tokens");
      if (promptEl) promptEl.textContent = todayStats.promptTokens.toLocaleString();

      const completionEl = document.getElementById("usage-completion-tokens");
      if (completionEl) completionEl.textContent = todayStats.completionTokens.toLocaleString();

      const audioEl = document.getElementById("usage-audio-seconds");
      if (audioEl) audioEl.textContent = `${Math.round(todayStats.audioSeconds)}s`;

      // Render history
      renderUsageHistory(usageStats);
    } catch {
      /* background might be idle on first load */
    }
  }

  function renderUsageHistory(
    usageStats: Record<
      string,
      {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        audioSeconds: number;
        estimatedCost: number;
      }
    >,
  ) {
    const container = document.getElementById("usage-history-list");
    if (!container) return;

    const entries = Object.entries(usageStats || {}).sort((a, b) => b[0].localeCompare(a[0]));

    if (entries.length === 0) {
      container.innerHTML =
        '<div class="empty-msg">No usage data yet. Stats will appear after your first API call.</div>';
      return;
    }

    container.innerHTML = entries
      .map(
        ([date, s]) => `
      <div class="usage-history-row">
        <div class="usage-history-date">${escapeHtml(date)}</div>
        <div class="usage-history-details">
          <span class="usage-history-chip">🔡 ${s.totalTokens.toLocaleString()} tokens</span>
          <span class="usage-history-chip">🎙 ${Math.round(s.audioSeconds)}s audio</span>
          <span class="usage-history-cost">$${s.estimatedCost.toFixed(4)}</span>
        </div>
      </div>
    `,
      )
      .join("");
  }

  // ——— Dev: Simulate API Call Button ———
  const simBtn = document.getElementById("dev-simulate-btn");
  const simStatus = document.getElementById("dev-simulate-status");
  let simCount = 0;

  simBtn?.addEventListener("click", async () => {
    simBtn.setAttribute("disabled", "true");
    if (simStatus) simStatus.textContent = "Sending DEV_SIMULATE_CHUNK...";

    try {
      const response = await chrome.runtime.sendMessage({ type: "DEV_SIMULATE_CHUNK" });
      if (simStatus) {
        if (response?.success) {
          simCount++;
          simStatus.textContent = `✓ Chunk #${simCount} simulated — "${response.mockText?.slice(0, 60)}..."`;
        } else {
          simStatus.textContent = `✗ Failed: ${response?.error || "unknown"}`;
        }
      }
      // Refresh usage stats immediately
      loadUsageStats();
    } catch (err: any) {
      if (simStatus) simStatus.textContent = `✗ Error: ${err.message || err}`;
    } finally {
      simBtn.removeAttribute("disabled");
    }
  });
});
