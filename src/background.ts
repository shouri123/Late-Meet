// MV3 service worker for Late Meet
import { initTheme } from "./theme.js";

initTheme();

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const OFFSCREEN_DOCUMENT_PATH = "src/offscreen.html";
const OFFSCREEN_DOCUMENT_URL = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);

const MAX_PROMPT_LENGTH = 2000;
const TRANSCRIPT_WINDOW_SIZE = 25;
const SUMMARIZATION_MAX_TOKENS = 1200;
const JOINER_MESSAGE_MAX_TOKENS = 120;
const ELEVENLABS_STT_MODEL = "scribe_v2";

// Delay late-joiner auto messages until 10s to avoid lobby/join churn spam.
const MIN_MEETING_DURATION_FOR_WELCOME = 10;

import { State } from "./types";
import { audioFileExtensionForMimeType, isChunkViable } from "./audioProcessing";

const state: State = {
  isActive: false,
  meetingId: null,
  meetingUrl: null,
  startTime: null,
  summary: "",
  topics: [],
  decisions: [],
  actionItems: [],
  currentTopic: "",
  sentiment: "neutral",
  keyInsights: [],
  questionsRaised: [],
  participants: [],
  initialParticipants: [],
  lateJoiners: [],
  timeline: [],
  transcript: [],
  audioActive: false,
  targetTabId: null,
  lastSummarizedAt: 0,
  pendingJoiners: new Set(),
  participantCount: 0,
};

let selfParticipantName: string | null = null;

function normalizeParticipantName(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function resetState() {
  state.isActive = false;
  state.meetingId = null;
  state.meetingUrl = null;
  state.startTime = null;
  state.summary = "";
  state.topics = [];
  state.decisions = [];
  state.actionItems = [];
  state.currentTopic = "";
  state.sentiment = "neutral";
  state.keyInsights = [];
  state.questionsRaised = [];
  state.participants = [];
  state.initialParticipants = [];
  state.lateJoiners = [];
  state.timeline = [];
  state.transcript = [];
  state.audioActive = false;
  state.targetTabId = null;
  state.lastSummarizedAt = 0;
  state.pendingJoiners.clear();
  state.participantCount = 0;
  selfParticipantName = null;
}

function addTimeline(event: string) {
  state.timeline.push({
    event,
    timestamp: Date.now(),
    elapsed: state.startTime
      ? Math.round((Date.now() - state.startTime) / 1000)
      : 0,
  });
}

function getDuration() {
  if (!state.startTime) return 0;
  return Math.round((Date.now() - state.startTime) / 1000);
}

function snapshot() {
  return {
    isActive: state.isActive,
    meetingId: state.meetingId,
    meetingUrl: state.meetingUrl,
    startTime: state.startTime,
    duration: getDuration(),
    summary: state.summary,
    topics: state.topics,
    decisions: state.decisions,
    actionItems: state.actionItems,
    currentTopic: state.currentTopic,
    sentiment: state.sentiment,
    keyInsights: state.keyInsights,
    questionsRaised: state.questionsRaised,
    participants: state.participants,
    lateJoiners: state.lateJoiners,
    timeline: state.timeline,
    transcript: state.transcript,
    audioActive: state.audioActive,
    participantCount: state.participantCount,
  };
}

async function broadcastStateUpdate() {
  const snapshotData = snapshot();

  try {
    // To popup/dashboard
    await chrome.runtime.sendMessage({
      type: "STATE_UPDATE",
      state: snapshotData,
    });
  } catch {
    /* ignore */
  }

  try {
    // To content scripts (floating button)
    const tabs = await chrome.tabs.query({
      url: "https://meet.google.com/*",
    });

    for (const tab of tabs) {
      if (tab.id !== undefined) {
        chrome.tabs
          .sendMessage(tab.id, {
            type: "STATE_UPDATE",
            state: snapshotData,
          })
          .catch(() => {});
      }
    }
  } catch {
    /* ignore */
  }
}

async function getApiKey() {
  const result = await chrome.storage.session.get("openai_api_key");
  return result.openai_api_key || null;
}

interface Settings {
  summarizationInterval?: number;
  aiModel?: string;
  vadThreshold?: number;
}

async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get("settings");
  return result.settings || {};
}

function sanitizePromptText(value: string | null) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/```/g, "")
    .replace(/[<>{}]/g, " ")
    .slice(0, MAX_PROMPT_LENGTH);
}

async function ensureOffscreenDocument() {
  const contexts = await (chrome.runtime as any).getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [OFFSCREEN_DOCUMENT_URL],
  });

  if (contexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ["USER_MEDIA" as any],
    justification: "Capture Google Meet tab audio for local transcription",
  });

  // Allow offscreen script to initialize listeners
  await new Promise((resolve) => setTimeout(resolve, 200));
}

async function closeOffscreenDocumentIfPresent() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as any],
    documentUrls: [OFFSCREEN_DOCUMENT_URL],
  });

  if (contexts.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}

async function transcribeChunk(
  base64Audio: string,
  mimeType = "audio/webm",
  prompt = "",
) {
  // Dev mode: return mock transcription without network requests
  if (await isDevMode()) {
    const mockAudioSeconds = 15 + Math.random() * 30;

    updateUsageStats({
      elevenlabsSeconds: mockAudioSeconds,
    }).catch(() => {});

    console.log("[LateMeet][DEV] Mock transcription returned");

    return getMockTranscription();
  }

  // Use ElevenLabs API key if available, fallback to OpenAI if not
  const elevenlabsKey = await chrome.storage.local
    .get("elevenlabs_api_key")
    .then((r) => r.elevenlabs_api_key);

  const bytes = Uint8Array.from(atob(base64Audio), (c) =>
    c.charCodeAt(0),
  );

  const blob = new Blob([bytes], {
    type: mimeType,
  });

  if (!isChunkViable(blob)) {
    console.warn(
      "[LateMeet] Audio chunk too small to transcribe, skipping:",
      blob.size,
      "bytes",
    );

    return null;
  }

  // ---------------- ELEVENLABS STT ----------------
  if (elevenlabsKey) {
    try {
      const normalizedMime = mimeType.split(";")[0].trim();

      const extension =
        audioFileExtensionForMimeType(normalizedMime);

      const formData = new FormData();

      formData.append("file", blob, `audio.${extension}`);
      formData.append("model_id", ELEVENLABS_STT_MODEL);

      const response = await fetch(
        "https://api.elevenlabs.io/v1/speech-to-text",
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenlabsKey,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const text = await response.text();

        console.error("[LateMeet] ElevenLabs API error", text);

        throw new Error(
          `ElevenLabs STT error ${response.status}`,
        );
      }

      const data = await response.json();

      const estimatedSeconds = blob.size / 16000;

      updateUsageStats({
        elevenlabsSeconds: estimatedSeconds,
      }).catch(() => {});

      const transcript = (data.text || "").trim();

      if (!transcript) {
        throw new Error("Empty transcript");
      }

      return transcript;
    } catch (err) {
      console.warn(
        "[LateMeet] ElevenLabs failed, falling back to Whisper:",
        err,
      );
    }
  }

  // ---------------- WHISPER FALLBACK ----------------
  const apiKey = await getApiKey();

  if (!apiKey) return null;

  const normalizedMime = mimeType.split(";")[0].trim();

  const extension =
    audioFileExtensionForMimeType(normalizedMime);

  const formData = new FormData();

  formData.append("file", blob, `audio.${extension}`);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");

  if (prompt) {
    formData.append("prompt", prompt);
  }

  const response = await fetch(OPENAI_WHISPER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Whisper error ${response.status}: ${text}`,
    );
  }

  const data = await response.json();

  if (typeof data.duration === "number") {
    updateUsageStats({
      whisperSeconds: data.duration,
    }).catch(() => {});
  }

  return (data.text || "").trim();
}

async function sendChatToTab(tabId: number, text: string) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "SEND_CHAT_MESSAGE",
      text,
    });
  } catch (err) {
    console.error(
      "[LateMeet] Failed to send chat message to tab:",
      err,
    );
  }
}

async function maybeWelcomeJoiners(
  tabId: number | undefined,
  joiners: string[],
) {
  if (
    !joiners.length ||
    getDuration() <= MIN_MEETING_DURATION_FOR_WELCOME ||
    !tabId
  ) {
    return;
  }

  const normalizedSelf =
    normalizeParticipantName(selfParticipantName);

  for (const joiner of joiners) {
    const name = String(joiner || "").trim();

    const normalizedName =
      normalizeParticipantName(name);

    if (
      !name ||
      normalizedName ===
        normalizeParticipantName("You") ||
      (normalizedSelf &&
        normalizedName === normalizedSelf) ||
      state.pendingJoiners.has(name)
    ) {
      continue;
    }

    state.pendingJoiners.add(name);

    try {
      const text = await generateLateJoinerMessage(name);

      await sendChatToTab(tabId, text);

      addTimeline(
        `Late joiner brief sent to ${name}`,
      );
    } finally {
      state.pendingJoiners.delete(name);
    }
  }
}

async function savePendingSession() {
  const session = {
    id: crypto.randomUUID(),
    ...snapshot(),
    savedAt: Date.now(),
    isActive: false,
  };

  await chrome.storage.local.set({
    pendingSession: session,
  });
}

async function persistSession() {
  const { pendingSession, savedSessions } =
    await chrome.storage.local.get([
      "pendingSession",
      "savedSessions",
    ]);

  if (!pendingSession) return;

  const sessions = Array.isArray(savedSessions)
    ? savedSessions
    : [];

  sessions.unshift(pendingSession);

  await chrome.storage.local.set({
    savedSessions: sessions,
    pendingSession: null,
  });
}

async function discardPendingSession() {
  await chrome.storage.local.set({
    pendingSession: null,
  });
}

async function startAudioCapture(
  tabId: number,
  meetingId: string | null,
  meetingUrl: string | null,
  providedStreamId: string | null = null,
  includeMicrophone = true,
) {
  if (!tabId) {
    throw new Error("Missing target tab id");
  }

  await ensureOffscreenDocument();

  const createdSession = !state.isActive;

  if (createdSession) {
    resetState();

    state.isActive = true;
    state.startTime = Date.now();
    state.meetingId = meetingId || "unknown";
    state.meetingUrl = meetingUrl || null;
    state.targetTabId = tabId;

    addTimeline(
      `Meeting started (${state.meetingId})`,
    );
  }

  try {
    let streamId = providedStreamId;

    if (!streamId) {
      streamId = await new Promise<string | null>(
        (resolve) => {
          chrome.tabCapture.getMediaStreamId(
            { targetTabId: tabId },
            (id) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "[LateMeet] getMediaStreamId error (background):",
                  chrome.runtime.lastError.message ||
                    chrome.runtime.lastError,
                );

                resolve(null);
              } else {
                resolve(id);
              }
            },
          );
        },
      );
    }

    if (!streamId) {
      throw new Error(
        "Failed to get media stream ID for tab capture.",
      );
    }

    const settings = await getSettings();

    const raw = settings.vadThreshold;

    const vadThreshold =
      typeof raw === "number" &&
      Number.isFinite(raw) &&
      raw > 0 &&
      raw <= 1
        ? raw
        : 0.012;

    const response =
      await chrome.runtime.sendMessage({
        type: "OFFSCREEN_START_CAPTURE",
        streamId,
        tabId,
        includeMicrophone,
        vadThreshold,
      });

    if (!response?.success) {
      throw new Error(
        response?.error ||
          "Failed to start offscreen capture",
      );
    }

    state.audioActive = true;

    addTimeline("Audio capture started");

    if (response.microphoneActive === false) {
      addTimeline(
        "Microphone capture unavailable; recording tab audio only",
      );
    }

    await broadcastStateUpdate();
  } catch (err) {
    state.audioActive = false;

    if (createdSession) {
      resetState();
      await broadcastStateUpdate();
    }

    throw err;
  }
}

async function scanForMeetTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: "https://meet.google.com/*",
    });

    if (tabs.length > 0) {
      for (const tab of tabs) {
        const urlMatch =
          tab.url?.match(
            /meet\.google\.com\/([a-z\-]+)/,
          );

        const meetingId = urlMatch
          ? urlMatch[1]
          : null;

        if (meetingId && meetingId !== "new") {
          if (!state.isActive) {
            resetState();

            state.isActive = true;
            state.meetingId = meetingId;
            state.meetingUrl = tab.url || null;
            state.targetTabId = tab.id || null;
            state.startTime = Date.now();
            state.participants = ["You"];

            console.log(
              "[LateMeet] Proactively detected meeting:",
              meetingId,
            );

            await broadcastStateUpdate();
          }

          return;
        }
      }
    }
  } catch (err) {
    console.error(
      "[LateMeet] Scan for meet tabs failed:",
      err,
    );
  }
}

async function stopAudioCapture(
  reason = "Stopped",
) {
  try {
    await chrome.runtime.sendMessage({
      type: "OFFSCREEN_STOP_CAPTURE",
    });
  } catch {
    // Ignore if offscreen not running
  }

  if (state.isActive) {
    addTimeline(`Meeting ended (${reason})`);

    await savePendingSession();
  }

  state.audioActive = false;
  state.isActive = false;

  await broadcastStateUpdate();

  try {
    await chrome.runtime.sendMessage({
      type: "SESSION_ENDED",
    });
  } catch {
    // no listeners
  }

  await closeOffscreenDocumentIfPresent();
}

chrome.tabs.onUpdated.addListener(
  async (tabId, changeInfo, tab) => {
    if (
      changeInfo.status === "complete" &&
      tab.url?.includes("meet.google.com/")
    ) {
      const urlMatch = tab.url.match(
        /meet\.google\.com\/([a-z\-]+)/,
      );

      const meetingId = urlMatch
        ? urlMatch[1]
        : null;

      if (
        meetingId &&
        meetingId !== "new"
      ) {
        if (!state.isActive) {
          resetState();

          state.isActive = true;
          state.meetingId = meetingId;
          state.meetingUrl = tab.url || null;
          state.targetTabId = tabId || null;
          state.startTime = Date.now();
          state.participants = ["You"];

          await broadcastStateUpdate();
        }
      }
    }
  },
);

chrome.tabs.onActivated.addListener(
  async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(
        activeInfo.tabId,
      );

      if (
        tab.url?.includes(
          "meet.google.com/",
        )
      ) {
        const urlMatch = tab.url.match(
          /meet\.google\.com\/([a-z\-]+)/,
        );

        const meetingId = urlMatch
          ? urlMatch[1]
          : null;

        if (
          meetingId &&
          meetingId !== "new" &&
          !state.isActive
        ) {
          state.meetingId = meetingId;
          state.meetingUrl = tab.url;
          state.targetTabId =
            activeInfo.tabId;

          await broadcastStateUpdate();
        }
      }
    } catch (err) {
      console.log(err);
    }
  },
);

chrome.tabs.onRemoved.addListener(
  async (tabId) => {
    if (
      state.targetTabId &&
      tabId === state.targetTabId
    ) {
      if (state.isActive) {
        await stopAudioCapture(
          "Meeting tab closed",
        );
      } else {
        state.meetingId = null;
        state.targetTabId = null;

        await broadcastStateUpdate();
      }
    }
  },
);

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    (async () => {
      switch (message?.type) {
        case "GET_STATE": {
          if (!state.isActive) {
            await scanForMeetTabs();
          }

          sendResponse(snapshot());

          return;
        }

        case "OPEN_SIDE_PANEL": {
          const callerTabId =
            sender?.tab?.id;

          if (callerTabId) {
            await chrome.sidePanel.open({
              tabId: callerTabId,
            });
          }

          sendResponse({
            success: true,
          });

          return;
        }

        case "MANUAL_START_AUDIO": {
          let tabId = message.tabId;

          if (tabId === "current") {
            tabId = sender?.tab?.id;
          }

          if (!tabId) {
            sendResponse({
              success: false,
              error: "Target tab not found",
            });

            return;
          }

          const meetingId =
            message.meetingId ||
            state.meetingId;

          const meetingUrl =
            sender?.tab?.url ||
            state.meetingUrl;

          await startAudioCapture(
            tabId,
            meetingId,
            meetingUrl,
            message.streamId,
            message.includeMicrophone !== false,
          );

          sendResponse({
            success: true,
          });

          return;
        }

        case "OFFSCREEN_LOG": {
          console.log(
            "[LateMeet][offscreen]",
            message.message,
          );

          sendResponse({
            success: true,
          });

          return;
        }

        case "OFFSCREEN_CAPTURE_STOPPED": {
          state.audioActive = false;

          await broadcastStateUpdate();

          sendResponse({
            success: true,
          });

          return;
        }

        case "OFFSCREEN_AUDIO_CHUNK": {
          if (!state.isActive) {
            console.warn(
              "[LateMeet] chunk received but session not active — ignored",
            );

            sendResponse({
              success: true,
              ignored: true,
            });

            return;
          }

          const base64Len =
            message.audioBase64?.length ?? 0;

          const approxBytes = Math.round(
            (base64Len * 3) / 4,
          );

          console.log(
            `[LateMeet] chunk received — ~${approxBytes} bytes mimeType=${message.mimeType}`,
          );

          try {
            const prompt =
              getTranscriptionPrompt();

            const rawText =
              await transcribeChunk(
                message.audioBase64,
                message.mimeType,
                prompt,
              );

            if (rawText) {
              console.log(
                `[LateMeet] transcript received — ${rawText.length} chars`,
              );

              const refinedText =
                await refineTranscription(
                  rawText,
                );

              console.log(
                `[LateMeet] transcript refined — ${refinedText.length} chars`,
              );

              state.transcript.push({
                speaker: "Audio",
                text: refinedText,
                timestamp: Date.now(),
              });

              await summarizeTranscriptIfNeeded();

              await broadcastStateUpdate();
            } else {
              console.warn(
                "[LateMeet] STT returned empty",
              );
            }

            sendResponse({
              success: true,
            });
          } catch (err) {
            console.error(
              "[LateMeet] chunk processing failed:",
              err,
            );

            sendResponse({
              success: false,
              error: (err as Error).message,
            });
          }

          return;
        }

        case "PARTICIPANTS_UPDATED": {
          if (
            !Array.isArray(
              message.participants,
            )
          ) {
            sendResponse({
              success: false,
              error:
                "participants must be an array",
            });

            return;
          }

          const incomingSelfName =
            typeof message.selfName ===
            "string"
              ? message.selfName.trim()
              : "";

          if (incomingSelfName) {
            selfParticipantName =
              incomingSelfName;
          }

          const joiners =
            detectNewJoiners(
              message.participants,
            );

          await maybeWelcomeJoiners(
            sender?.tab?.id ||
              state.targetTabId ||
              undefined,
            joiners,
          );

          await broadcastStateUpdate();

          sendResponse({
            success: true,
            joiners,
          });

          return;
        }

        case "SAVE_SESSION": {
          await persistSession();

          await broadcastStateUpdate();

          sendResponse({
            success: true,
          });

          return;
        }

        case "DISCARD_SESSION": {
          await discardPendingSession();

          await broadcastStateUpdate();

          sendResponse({
            success: true,
          });

          return;
        }

        case "GET_SAVED_SESSIONS": {
          const { savedSessions } =
            await chrome.storage.local.get(
              "savedSessions",
            );

          sendResponse(
            Array.isArray(savedSessions)
              ? savedSessions
              : [],
          );

          return;
        }

        case "DELETE_SAVED_SESSION": {
          const { savedSessions } =
            await chrome.storage.local.get(
              "savedSessions",
            );

          const sessions =
            Array.isArray(savedSessions)
              ? savedSessions
              : [];

          const next = sessions.filter(
            (s) =>
              s.id !== message.sessionId,
          );

          await chrome.storage.local.set({
            savedSessions: next,
          });

          sendResponse({
            success: true,
          });

          return;
        }

        default: {
          sendResponse({
            success: false,
            error: "Unknown message type",
          });
        }
      }
    })().catch((err) => {
      console.error(
        "[LateMeet] Message handler error:",
        err,
      );

      sendResponse({
        success: false,
        error:
          err.message ||
          "Unexpected error",
      });
    });

    return true;
  },
);

// Proactive scan on startup/load
scanForMeetTabs();