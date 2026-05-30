// MV3 service worker for Late Meet

import { State } from "./types";
import { audioFileExtensionForMimeType, isChunkViable } from "./audioProcessing";
import {
  deleteSavedMeetingSession,
  discardPendingMeetingSession,
  getSavedMeetingSessions,
  isStorageQuotaError,
  persistMeetingSession,
  persistPendingMeetingSession,
  savePendingMeetingSession,
  StoredSession,
} from "./sessionStorage";
import { AudioChunkQueue, AudioChunkQueueItem } from "./audioChunkQueue";
import { normalizeActiveSpeakerName, resolveTranscriptSpeaker } from "./speakerAttribution";
import { getOpenAiApiKey, getElevenLabsApiKey } from "./utils/credentials";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const OFFSCREEN_DOCUMENT_PATH = "src/offscreen.html";
const OFFSCREEN_DOCUMENT_URL = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
const MAX_PROMPT_LENGTH = 2000;
const TRANSCRIPT_WINDOW_SIZE = 25;
const SUMMARIZATION_MAX_TOKENS = 1200;
const JOINER_MESSAGE_MAX_TOKENS = 120;
const ELEVENLABS_STT_MODEL = "scribe_v2";
const MAX_PENDING_AUDIO_CHUNKS = 8;
// Delay late-joiner auto messages until 10s to avoid lobby/join churn spam.
const MIN_MEETING_DURATION_FOR_WELCOME = 10;

// ---------------------------------------------------------------------------
// API Transaction Manager
// ---------------------------------------------------------------------------
// Provides a serialized, resilient request queue with:
//   • Exponential backoff:  delay = BASE_DELAY_MS * 2^attempt
//   • Randomized jitter:    ±JITTER_FRACTION of the computed delay
//   • Offline pause/resume: queue halts when navigator.onLine is false and
//     flushes automatically when the browser comes back online.
//   • MV3-safe retries:     retrying tasks are held in a separate Map so they
//     survive the shift() that removes them from the FIFO queue, and alarm-
//     based scheduling avoids lost timers on service-worker suspension.
// ---------------------------------------------------------------------------

type ApiTask<T> = () => Promise<T>;

interface QueueEntry<T> {
  /** Unique id used as the chrome.alarms alarm name for retry scheduling. */
  id: string;
  task: ApiTask<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  attempt: number;
  label: string; // for debug logging
}

class ApiTransactionManager {
  private static readonly MAX_RETRIES = 5;
  private static readonly BASE_DELAY_MS = 1_000;
  private static readonly JITTER_FRACTION = 0.3; // ±30 % of computed delay
  private static readonly RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

  private queue: QueueEntry<any>[] = [];

  /**
   * Tasks that have been dequeued but are waiting for their retry alarm to
   * fire live here so findRetryEntry() can locate them later.
   */
  private retryingTasks = new Map<string, QueueEntry<any>>();

  private processing = false;
  private paused = false;

  constructor() {
    // Pause the queue while the extension context is offline.
    self.addEventListener("offline", () => {
      if (!this.paused) {
        console.warn("[LateMeet][Queue] Network offline — queue paused");
        this.paused = true;
      }
    });

    // Resume (and immediately flush) when connectivity returns.
    self.addEventListener("online", () => {
      if (this.paused) {
        console.info("[LateMeet][Queue] Network back online — resuming queue");
        this.paused = false;
        this.drain();
      }
    });

    // Re-enqueue any task whose alarm has fired (MV3-safe retry scheduling).
    chrome.alarms.onAlarm.addListener((alarm) => {
      const entry = this.retryingTasks.get(alarm.name);
      if (!entry) {
        // Not our alarm — ignore.
        return;
      }
      this.retryingTasks.delete(alarm.name);
      // Place the entry back at the front of the queue so it executes next.
      this.queue.unshift(entry);
      this.drain();
    });
  }

  /** Enqueue a fetch task and return a Promise that resolves with its result. */
  enqueue<T>(label: string, task: ApiTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = `atm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.queue.push({ id, task, resolve, reject, attempt: 0, label });
      this.drain();
    });
  }

  private drain() {
    if (this.processing || this.paused || this.queue.length === 0) return;
    this.processing = true;
    this.processNext();
  }

  private async processNext() {
    if (this.paused || this.queue.length === 0) {
      this.processing = false;
      return;
    }

    // Peek — do not dequeue until the task succeeds or exhausts retries.
    const entry = this.queue[0];

    try {
      const result = await entry.task();
      this.queue.shift(); // success — remove from queue
      entry.resolve(result);
    } catch (err) {
      const isRetryable = this.shouldRetry(err, entry.attempt);

      if (isRetryable && entry.attempt < ApiTransactionManager.MAX_RETRIES) {
        const delay = this.backoffDelay(entry.attempt);
        entry.attempt += 1;
        console.warn(
          `[LateMeet][Queue] "${entry.label}" failed (attempt ${entry.attempt}), ` +
            `retrying in ${delay}ms…`,
          err,
        );

        // Remove from the head of the FIFO queue so other tasks can proceed
        // while we wait for the retry alarm, but keep the entry alive in the
        // retryingTasks map so the alarm handler can find and re-enqueue it.
        this.queue.shift();
        this.retryingTasks.set(entry.id, entry);

        // chrome.alarms is the MV3-safe alternative to setTimeout: it fires
        // even if the service worker is suspended and woken up between now and
        // the scheduled time.
        chrome.alarms.create(entry.id, { when: Date.now() + delay });

        // Let the drain loop continue with the next queued task rather than
        // blocking the whole queue on this retry delay.
        this.processNext();
        return;
      } else {
        this.queue.shift(); // non-retryable or exhausted — discard
        console.error(
          `[LateMeet][Queue] "${entry.label}" permanently failed after ` +
            `${entry.attempt + 1} attempt(s).`,
          err,
        );
        entry.reject(err);
      }
    }

    // Continue with the next item.
    this.processNext();
  }

  private shouldRetry(err: unknown, attempt: number): boolean {
    if (attempt >= ApiTransactionManager.MAX_RETRIES) return false;
    // Treat network errors (TypeError: failed to fetch) as retryable.
    if (err instanceof TypeError) return true;
    // Honour HTTP status codes embedded in thrown Error messages.
    if (err instanceof Error) {
      for (const status of ApiTransactionManager.RETRYABLE_STATUSES) {
        if (new RegExp(`\\b${status}\\b`).test(err.message)) return true;
      }
    }
    return false;
  }

  private backoffDelay(attempt: number): number {
    const base = ApiTransactionManager.BASE_DELAY_MS * Math.pow(2, attempt);
    const jitter = base * ApiTransactionManager.JITTER_FRACTION * (Math.random() * 2 - 1);
    return Math.max(100, Math.round(base + jitter));
  }
}

/** Singleton queue shared by all fetch helpers in this service worker. */
const apiQueue = new ApiTransactionManager();

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

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
  unresolvedDiscussions: [],
  contradictions: [],
  questionsRaised: [],
  participants: [],
  initialParticipants: [],
  lateJoiners: [],
  timeline: [],
  transcript: [],
  audioActive: false,
  currentSpeaker: null,
  targetTabId: null,
  lastSummarizedAt: 0,
  participantCount: 0,
};

let selfParticipantName: string | null = null;

// ---------------------------------------------------------------------------
// Transient Late-Joiner Processing State
// ---------------------------------------------------------------------------
// Tracks which late joiners are currently being processed for welcome messages.
// This is NOT persisted or shared with UI — it's purely for preventing duplicate
// welcome message sends during the maybeWelcomeJoiners() workflow.
// Entries are added when processing begins and removed when it completes (see finally block).
// This state is discarded on service worker suspension and not restored.
const pendingJoinersInFlight = new Set<string>();

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
  state.unresolvedDiscussions = [];
  state.contradictions = [];
  state.questionsRaised = [];
  state.participants = [];
  state.initialParticipants = [];
  state.lateJoiners = [];
  state.timeline = [];
  state.transcript = [];
  state.audioActive = false;
  state.currentSpeaker = null;
  state.targetTabId = null;
  state.lastSummarizedAt = 0;
  pendingJoinersInFlight.clear();
  audioChunkQueue.clear();
  state.participantCount = 0;
  selfParticipantName = null;
}

function addTimeline(event: string) {
  state.timeline.push({
    event,
    timestamp: Date.now(),
    elapsed: state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0,
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
    unresolvedDiscussions: state.unresolvedDiscussions,
    contradictions: state.contradictions,
    questionsRaised: state.questionsRaised,
    participants: state.participants,
    initialParticipants: state.initialParticipants,
    lateJoiners: state.lateJoiners,
    timeline: state.timeline,
    transcript: state.transcript,
    audioActive: state.audioActive,
    currentSpeaker: state.currentSpeaker,
    participantCount: state.participantCount,
  };
}

async function broadcastStateUpdate() {
  const snapshotData = snapshot();
  try {
    // To popup/dashboard
    await chrome.runtime.sendMessage({ type: "STATE_UPDATE", state: snapshotData });
  } catch {
    /* ignore */
  }

  try {
    // To content scripts (floating button)
    const tabs = await chrome.tabs.query({ url: "https://meet.google.com/*" });
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        chrome.tabs
          .sendMessage(tab.id, { type: "STATE_UPDATE", state: snapshotData })
          .catch(() => {});
      }
    }
  } catch {
    /* ignore */
  }
}

async function getApiKey() {
  return getOpenAiApiKey();
}

interface Settings {
  summarizationInterval?: number;
  aiModel?: string;
  vadThreshold?: number;
  lateJoinerBriefing?: boolean;
  topicDetection?: boolean;
  decisionDetection?: boolean;
  actionExtraction?: boolean;
  sentimentAnalysis?: boolean;
}

async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get("settings");
  return result.settings || {};
}

function isFeatureEnabled(settings: Settings, key: keyof Settings): boolean {
  return settings[key] !== false;
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

  // createDocument resolves when the document is created, but the offscreen JS
  // still needs a moment to execute and register its chrome.runtime.onMessage
  // listener. Without this delay the first OFFSCREEN_START_CAPTURE is lost.
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

function getTranscriptionPrompt() {
  const recentTexts = state.transcript
    .slice(-3)
    .map((e) => e.text)
    .join(" ");
  if (!recentTexts) return "";
  // Provide last ~200 characters to Whisper to help with context/names
  return recentTexts.slice(-200);
}

async function transcribeChunk(base64Audio: string, mimeType = "audio/webm", prompt = "") {
  const elevenlabsKey = await getElevenLabsApiKey();

  const bytes = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });

  if (!isChunkViable(blob)) {
    console.warn("[LateMeet] Audio chunk too small to transcribe, skipping:", blob.size, "bytes");
    return null;
  }

  if (elevenlabsKey) {
    try {
      const normalizedMime = mimeType.split(";")[0].trim();
      const extension = audioFileExtensionForMimeType(normalizedMime);

      const formData = new FormData();
      formData.append("file", blob, `audio.${extension}`);
      formData.append("model_id", ELEVENLABS_STT_MODEL);

      const transcript = await apiQueue.enqueue("elevenlabs-stt", async () => {
        const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": elevenlabsKey },
          body: formData,
        });

        if (!response.ok) {
          const text = await response.text();
          console.error("[LateMeet] ElevenLabs API rejected chunk", {
            status: response.status,
            statusText: response.statusText,
            response: text,
            mimeType,
            size: blob.size,
          });
          throw new Error(`ElevenLabs STT error ${response.status}: ${text}`);
        }

        const data = await response.json();
        const result = (data.text || "").trim();
        if (!result) throw new Error("Empty ElevenLabs transcript");
        return result;
      });

      return transcript;
    } catch (err) {
      console.warn("[LateMeet] ElevenLabs transcription failed, falling back to Whisper:", err);
      // Fall through to Whisper below.
    }
  }

  // Fallback to Whisper.
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const normalizedMime = mimeType.split(";")[0].trim();
  const extension = audioFileExtensionForMimeType(normalizedMime);

  const formData = new FormData();
  formData.append("file", blob, `audio.${extension}`);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  if (prompt) {
    formData.append("prompt", prompt);
  }

  return apiQueue.enqueue("whisper-stt", async () => {
    const response = await fetch(OPENAI_WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Whisper API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    return (data.text || "").trim();
  });
}

async function refineTranscription(rawText: string) {
  if (!rawText || rawText.length < 5) return rawText;

  // Skip refinement for very short or likely-noise transcriptions
  const words = rawText.trim().split(/\s+/);
  if (words.length < 3) return rawText;

  const apiKey = await getApiKey();
  if (!apiKey) return rawText;

  const systemPrompt = `You are an expert AI transcription editor. 
Your task is to correct errors, remove filler words (um, uh, like), and improve the clarity of the provided meeting transcript segment while strictly preserving the speaker's original meaning and intent.
Return ONLY the corrected transcript text. If the input is unclear, inaudible, or empty, return the exact input unchanged. Never add commentary, apologies, or meta-responses.`;

  try {
    return await apiQueue.enqueue("refine-transcription", async () => {
      const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: rawText },
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Refinement API error ${response.status}: ${text}`);
      }

      const data = await response.json();
      const refined = data?.choices?.[0]?.message?.content?.trim() || rawText;

      // Guard against AI hallucination / apology responses
      const lowerRefined = refined.toLowerCase();
      if (
        lowerRefined.startsWith("i'm sorry") ||
        lowerRefined.startsWith("i apologize") ||
        lowerRefined.startsWith("sorry,") ||
        lowerRefined.includes("no text provided") ||
        lowerRefined.includes("please provide") ||
        lowerRefined.includes("i cannot") ||
        lowerRefined.includes("there is no")
      ) {
        return rawText;
      }

      return refined;
    });
  } catch (err) {
    console.error("[LateMeet] Refinement failed:", err);
    return rawText;
  }
}

// ---------------------------------------------------------------------------
// Single-flight guard for summarization
// ---------------------------------------------------------------------------
let summaryInFlight = false;

async function summarizeTranscriptIfNeeded() {
  if (!state.isActive || state.transcript.length === 0) return;

  // Bail out immediately if another summarization is already running.
  if (summaryInFlight) return;

  const settings = await getSettings();
  const requestedInterval = Number(settings.summarizationInterval);
  const intervalSeconds =
    Number.isFinite(requestedInterval) && requestedInterval > 0 ? requestedInterval : 30;
  const lastSum = state.lastSummarizedAt || 0;
  const elapsed = Math.floor((Date.now() - lastSum) / 1000);
  if (lastSum > 0 && elapsed < intervalSeconds) return;

  const apiKey = await getApiKey();
  if (!apiKey) return;

  const transcriptWindow = state.transcript
    .slice(-TRANSCRIPT_WINDOW_SIZE)
    .map((e) => `${sanitizePromptText(e.speaker)}: ${sanitizePromptText(e.text)}`)
    .join("\n");
  if (!transcriptWindow.trim()) return;

  // Claim the in-flight slot *after* all cheap pre-checks pass.
  summaryInFlight = true;

  try {
    const topicDetectionEnabled = isFeatureEnabled(settings, "topicDetection");
    const decisionDetectionEnabled = isFeatureEnabled(settings, "decisionDetection");
    const actionExtractionEnabled = isFeatureEnabled(settings, "actionExtraction");
    const sentimentAnalysisEnabled = isFeatureEnabled(settings, "sentimentAnalysis");

    const outputFields = [
      '"summary": "Updated meeting summary..."',
      ...(topicDetectionEnabled
        ? [
            '"topics": [{"name": "Topic", "status": "active|completed|unresolved"}]',
            '"currentTopic": "Identifying the current main topic"',
            '"unresolvedDiscussions": ["unresolved topic 1", ...]',
          ]
        : []),
      ...(decisionDetectionEnabled
        ? ['"decisions": [{"text": "Decision 1", "classification": "finalized|tentative"}]']
        : []),
      ...(actionExtractionEnabled
        ? [
            '"actionItems": [{"task": "Action 1", "confidence": "high|medium|low", "isSpeculative": false}]',
          ]
        : []),
      ...(sentimentAnalysisEnabled ? ['"sentiment": "positive|neutral|negative|mixed"'] : []),
      '"keyInsights": [{"text": "Insight 1", "confidenceScore": 85}, ...]',
      '"contradictions": [{"issue": "Contradiction 1", "persists": true}]',
      '"questionsRaised": ["Question 1", ...]',
    ];

    const systemPrompt = `You are a World-Class Meeting Intelligence Engine. 
Your goal is to extract high-fidelity insights from meeting transcripts and apply Conversational Confidence Collapse Detection.

OUTPUT GUIDELINES:
- Provide a concise yet professional summary (business grade).
- Extract only the fields requested by the user prompt.
${topicDetectionEnabled ? "- Identify distinct topics and their statuses (active/completed/unresolved)." : ""}
${decisionDetectionEnabled ? "- Precisely capture decisions. Classify as 'tentative' if there are hedging phrases (maybe, probably), otherwise 'finalized'." : ""}
${actionExtractionEnabled ? "- Precisely capture action items. Rate confidence (high/medium/low). Prevent speculative statements from appearing as confirmed by setting isSpeculative to true." : ""}
${sentimentAnalysisEnabled ? "- Detect the prevailing sentiment and emotional dynamics." : ""}
- Extract "Key Insights" with a confidenceScore (0-100) based on linguistic certainty.
- Track contradiction persistence if someone disagrees or contradicts a previous point.
- Track specific questions raised that remain unanswered.

You must return ONLY a JSON object.`;

    const userPrompt = `Analyze the following meeting transcript segment.
Integrate this new data with the previous context.

PREVIOUS CONTEXT (Summary): 
${state.summary || "Initial session"}

RECENT TRANSCRIPT:
${transcriptWindow}

Return a JSON object with these exact keys:
{
  ${outputFields.join(",\n  ")}
}`;

    const content = await apiQueue.enqueue("summarize-transcript", async () => {
      const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: settings.aiModel || "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
          max_tokens: SUMMARIZATION_MAX_TOKENS,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Chat API error ${response.status}: ${text}`);
      }

      const data = await response.json();
      const result = data?.choices?.[0]?.message?.content;
      if (!result) throw new Error("Empty summarization response");
      return result;
    });

    if (!content) return;

    const parsed = JSON.parse(content);

    state.summary = parsed.summary || state.summary;

    if (topicDetectionEnabled) {
      state.topics = Array.isArray(parsed.topics) ? parsed.topics : state.topics;
      state.currentTopic = parsed.currentTopic || state.currentTopic;
    } else {
      state.topics = [];
      state.currentTopic = "";
    }

    if (decisionDetectionEnabled) {
      state.decisions = Array.isArray(parsed.decisions) ? parsed.decisions : state.decisions;
    } else {
      state.decisions = [];
    }

    if (actionExtractionEnabled) {
      state.actionItems = Array.isArray(parsed.actionItems)
        ? parsed.actionItems
        : state.actionItems;
    } else {
      state.actionItems = [];
    }

    if (sentimentAnalysisEnabled) {
      state.sentiment = parsed.sentiment || state.sentiment;
    } else {
      state.sentiment = "neutral";
    }

    state.keyInsights = Array.isArray(parsed.keyInsights) ? parsed.keyInsights : state.keyInsights;
    state.unresolvedDiscussions = Array.isArray(parsed.unresolvedDiscussions)
      ? parsed.unresolvedDiscussions
      : state.unresolvedDiscussions;
    state.contradictions = Array.isArray(parsed.contradictions)
      ? parsed.contradictions
      : state.contradictions;
    state.questionsRaised = Array.isArray(parsed.questionsRaised)
      ? parsed.questionsRaised
      : state.questionsRaised;

    state.lastSummarizedAt = Date.now();
  } catch (err) {
    console.warn("[LateMeet] Summarization failed (non-fatal):", err);
  } finally {
    summaryInFlight = false;
  }
}

interface QueuedAudioChunk {
  audioBase64: string;
  mimeType: string;
  approxBytes: number;
  receivedAt: number;
  speaker: string;
}

async function processQueuedAudioChunk({ id, item }: AudioChunkQueueItem<QueuedAudioChunk>) {
  if (!state.isActive) {
    console.warn(`[LateMeet] queued audio chunk ${id} ignored because session is inactive`);
    return;
  }

  console.log(
    `[LateMeet] processing queued chunk ${id} — ~${item.approxBytes} bytes  mimeType=${item.mimeType}`,
  );

  const prompt = getTranscriptionPrompt();
  const rawText = await transcribeChunk(item.audioBase64, item.mimeType, prompt);

  if (!rawText) {
    console.warn(`[LateMeet] STT returned empty for queued chunk ${id}`);
    return;
  }

  console.log(`[LateMeet] transcript received for chunk ${id} — ${rawText.length} chars`);
  const refinedText = await refineTranscription(rawText);
  console.log(`[LateMeet] transcript refined for chunk ${id} — ${refinedText.length} chars`);

  state.transcript.push({
    speaker: resolveTranscriptSpeaker(item.speaker || state.currentSpeaker),
    text: refinedText,
    timestamp: item.receivedAt,
  });

  await summarizeTranscriptIfNeeded();
  await broadcastStateUpdate();
}

const audioChunkQueue = new AudioChunkQueue<QueuedAudioChunk>({
  maxPending: MAX_PENDING_AUDIO_CHUNKS,
  process: processQueuedAudioChunk,
  onError: async (err, { id }) => {
    console.error(`[LateMeet] queued chunk ${id} processing failed:`, err);
    addTimeline(`Audio chunk ${id} processing failed`);
    await broadcastStateUpdate();
  },
});

function detectNewJoiners(currentList: string[]) {
  if (state.participants.length === 0 && state.initialParticipants.length === 0) {
    state.initialParticipants = [...currentList];
    state.participants = [...currentList];
    state.participantCount = currentList.length > 0 ? currentList.length : 1;
    return [];
  }

  const hasPlaceholderOnly =
    (state.initialParticipants.length === 0 ||
      (state.initialParticipants.length === 1 && state.initialParticipants[0] === "You")) &&
    state.participants.length === 1 &&
    state.participants[0] === "You";

  if (hasPlaceholderOnly) {
    const next = Array.isArray(currentList) ? currentList : [];
    if (next.length > 0 && !(next.length === 1 && next[0] === "You")) {
      state.initialParticipants = [...next];
      state.participants = [...next];
      state.participantCount = next.length;
      return [];
    }
  }

  const normalizedSelf = normalizeParticipantName(selfParticipantName);
  const next = Array.isArray(currentList) ? currentList : [];
  const newJoiners = next.filter(
    (p) =>
      !state.participants.includes(p) &&
      !state.initialParticipants.includes(p) &&
      (!normalizedSelf || normalizeParticipantName(p) !== normalizedSelf),
  );

  if (newJoiners.length > 0) {
    state.lateJoiners.push(...newJoiners);
    if (state.participantCount !== undefined) {
      state.participantCount += newJoiners.length;
    }
  }

  state.participants = [...next];
  return newJoiners;
}

async function generateLateJoinerMessage(joinerName: string) {
  const safeJoinerName = sanitizePromptText(joinerName);
  const context = {
    duration: getDuration(),
    currentTopic: state.currentTopic,
    topics: state.topics,
    decisions: state.decisions,
  };

  const fallback = `Hi ${joinerName}, welcome to the meeting! We are currently discussing ${context.currentTopic || "project updates"}.`;

  try {
    const apiKey = await getApiKey();
    if (!apiKey) return fallback;

    const prompt = `A participant named ${safeJoinerName} joined late. Meeting duration: ${Math.round(context.duration / 60)} minutes. Current topic: ${sanitizePromptText(context.currentTopic || "project updates")}. Share a warm, concise catch-up message with key context and any confirmed decisions/action items.`;

    return await apiQueue.enqueue("late-joiner-message", async () => {
      const response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.5,
          max_tokens: JOINER_MESSAGE_MAX_TOKENS,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Late joiner API error ${response.status}: ${text}`);
      }

      const data = await response.json();
      return data?.choices?.[0]?.message?.content?.trim() || fallback;
    });
  } catch {
    return fallback;
  }
}

async function sendChatToTab(tabId: number, text: string) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "SEND_CHAT_MESSAGE",
      text,
    });
  } catch (err) {
    console.error("[LateMeet] Failed to send chat message to tab:", err);
  }
}

async function maybeWelcomeJoiners(tabId: number | undefined, joiners: string[]) {
  if (!joiners.length || getDuration() <= MIN_MEETING_DURATION_FOR_WELCOME || !tabId) {
    return;
  }

  const settings = await getSettings();
  if (!isFeatureEnabled(settings, "lateJoinerBriefing")) {
    return;
  }

  const normalizedSelf = normalizeParticipantName(selfParticipantName);

  for (const joiner of joiners) {
    const name = String(joiner || "").trim();
    const normalizedName = normalizeParticipantName(name);

    // Ignore invalid/self placeholder participants
    if (
      !name ||
      normalizedName === normalizeParticipantName("You") ||
      (normalizedSelf && normalizedName === normalizedSelf)
    ) {
      continue;
    }

    // Prevent duplicate welcome messages for case-only variants
    // (e.g. "Alice" vs "alice")
    if (pendingJoinersInFlight.has(normalizedName)) {
      continue;
    }

    pendingJoinersInFlight.add(normalizedName);

    try {
      const text = await generateLateJoinerMessage(name);
      await sendChatToTab(tabId, text);
    } catch (err) {
      console.error("[LateMeet] Failed to welcome joiner:", err);
    } finally {
      pendingJoinersInFlight.delete(normalizedName);
    }
  }
}

async function savePendingSession() {
  const session: StoredSession = {
    id: crypto.randomUUID(),
    ...snapshot(),
    savedAt: Date.now(),
    isActive: false,
  };

  inMemoryPendingSession = session;

  try {
    await savePendingMeetingSession(chrome.storage.local, session);
  } catch (err) {
    console.error("[LateMeet] Failed to save pending session:", err);
    if (isStorageQuotaError(err)) {
      console.error(
        "[LateMeet] Storage quota reached while saving pending session. Keep this extension active and export the session before closing Chrome.",
      );
    }
  }
}

let isProcessingSession = false;
let inMemoryPendingSession: StoredSession | null = null;

async function persistSession() {
  if (isProcessingSession) {
    console.log("[LateMeet] Already processing session, ignoring duplicate save request.");
    return;
  }
  isProcessingSession = true;
  try {
    let session: StoredSession;
    try {
      session = await persistPendingMeetingSession(chrome.storage.local);
    } catch (err) {
      if (!inMemoryPendingSession) throw err;
      session = await persistMeetingSession(chrome.storage.local, inMemoryPendingSession);
    }
    inMemoryPendingSession = null;
    console.log("[LateMeet] Session successfully saved:", session.id);
  } catch (err) {
    console.error("[LateMeet] Error persisting session:", err);
    throw err;
  } finally {
    isProcessingSession = false;
  }
}

async function discardPendingSession() {
  if (isProcessingSession) {
    console.log("[LateMeet] Already processing session, ignoring duplicate discard request.");
    return;
  }
  isProcessingSession = true;
  try {
    inMemoryPendingSession = null;
    await discardPendingMeetingSession(chrome.storage.local);
    console.log("[LateMeet] Pending session discarded.");
  } catch (err) {
    console.error("[LateMeet] Error discarding session:", err);
    throw err;
  } finally {
    isProcessingSession = false;
  }
}

let isStartingAudio = false;

async function startAudioCapture(
  tabId: number,
  meetingId: string | null,
  meetingUrl: string | null,
  providedStreamId: string | null = null,
  includeMicrophone = true,
) {
  if (!tabId) throw new Error("Missing target tab id");
  if (state.audioActive) {
    console.log("[LateMeet] Audio already active, skipping start request.");
    return;
  }
  if (isStartingAudio) {
    console.log("[LateMeet] Audio start already in progress, skipping start request.");
    return;
  }
  isStartingAudio = true;

  const createdSession = !state.isActive;

  try {
    await ensureOffscreenDocument();

    if (createdSession) {
      resetState();
      state.isActive = true;
      state.startTime = Date.now();
      state.meetingId = meetingId || "unknown";
      state.meetingUrl = meetingUrl || null;
      state.targetTabId = tabId;
      addTimeline(`Meeting started (${state.meetingId})`);
    }

    let streamId = providedStreamId;

    if (!streamId) {
      streamId = await new Promise<string | null>((resolve) => {
        chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (id) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[LateMeet] getMediaStreamId error (background):",
              chrome.runtime.lastError.message || chrome.runtime.lastError,
            );
            resolve(null);
          } else {
            resolve(id);
          }
        });
      });
    }

    if (!streamId) {
      throw new Error(
        "Failed to get media stream ID for tab capture. Ensure you have given permission.",
      );
    }

    const settings = await getSettings();
    const raw = settings.vadThreshold;
    const vadThreshold =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : 0.012;
    const response = await chrome.runtime.sendMessage({
      type: "OFFSCREEN_START_CAPTURE",
      streamId,
      tabId,
      includeMicrophone,
      vadThreshold,
    });

    if (!response?.success) {
      throw new Error(response?.error || "Failed to start offscreen capture");
    }

    state.audioActive = true;
    addTimeline("Audio capture started");
    if (response.microphoneActive === false) {
      addTimeline("Microphone capture unavailable; recording tab audio only");
    }
    await broadcastStateUpdate();
  } catch (err) {
    state.audioActive = false;
    if (createdSession) {
      resetState();
      await broadcastStateUpdate();
    }
    throw err;
  } finally {
    isStartingAudio = false;
  }
}

async function scanForMeetTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://meet.google.com/*" });
    if (tabs.length > 0) {
      for (const tab of tabs) {
        const urlMatch = tab.url?.match(/meet\.google\.com\/([a-z\-]+)/);
        const meetingId = urlMatch ? urlMatch[1] : null;
        if (meetingId && meetingId !== "new") {
          if (!state.isActive) {
            resetState();
            state.isActive = true;
            state.meetingId = meetingId;
            state.meetingUrl = tab.url || null;
            state.targetTabId = tab.id || null;
            state.startTime = Date.now();
            state.participants = ["You"];
            console.log("[LateMeet] Proactively detected meeting:", meetingId);
            await broadcastStateUpdate();
          }
          return;
        }
      }
    }
  } catch (err) {
    console.error("[LateMeet] Scan for meet tabs failed:", err);
  }
}

let isStoppingAudio = false;

async function stopAudioCapture(reason = "Stopped") {
  if (isStoppingAudio) {
    console.log("[LateMeet] stop already in progress, skipping duplicate request.");
    return;
  }
  isStoppingAudio = true;
  try {
    try {
      await chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP_CAPTURE" });
    } catch {
      // Ignore if offscreen not running
    }

    if (state.audioActive) {
      addTimeline(`Meeting ended (${reason})`);
      await savePendingSession();
    }

    state.audioActive = false;
    state.isActive = false;

    await broadcastStateUpdate();

    try {
      await chrome.runtime.sendMessage({ type: "SESSION_ENDED" });
    } catch {
      // no listeners
    }

    await closeOffscreenDocumentIfPresent();
  } finally {
    isStoppingAudio = false;
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  try {
    const parsedUrl = new URL(tab.url);
    if (parsedUrl.hostname !== "meet.google.com") return;

    const pathMatch = /^\/([a-z-]+)/.exec(parsedUrl.pathname);
    const meetingId = pathMatch ? pathMatch[1] : null;

    if (meetingId && meetingId !== "new") {
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
  } catch {
    // invalid URL — ignore silently
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!tab.url) return;
    const parsedUrl = new URL(tab.url);
    if (parsedUrl.hostname !== "meet.google.com") return;

    const pathMatch = /^\/([a-z-]+)/.exec(parsedUrl.pathname);
    const meetingId = pathMatch ? pathMatch[1] : null;
    if (meetingId && meetingId !== "new" && !state.isActive) {
      state.meetingId = meetingId;
      state.meetingUrl = tab.url;
      state.targetTabId = activeInfo.tabId;
      await broadcastStateUpdate();
    }
  } catch (err) {
    console.debug("[LateMeet] tab activation handler failed:", err);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (state.targetTabId && tabId === state.targetTabId) {
    if (state.isActive) {
      await stopAudioCapture("Meeting tab closed");
    } else {
      state.meetingId = null;
      state.targetTabId = null;
      await broadcastStateUpdate();
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
        const callerTabId = sender?.tab?.id;
        if (callerTabId) {
          await chrome.sidePanel.open({ tabId: callerTabId });
        }
        sendResponse({ success: true });
        return;
      }

      case "MANUAL_START_AUDIO": {
        let tabId = message.tabId;
        if (tabId === "current") {
          tabId = sender?.tab?.id;
        }

        if (!tabId) {
          sendResponse({ success: false, error: "Target tab not found" });
          return;
        }

        const meetingId = message.meetingId || state.meetingId;
        const meetingUrl = sender?.tab?.url || state.meetingUrl;
        await startAudioCapture(
          tabId,
          meetingId,
          meetingUrl,
          message.streamId,
          message.includeMicrophone !== false,
        );
        sendResponse({ success: true });
        return;
      }

      case "MANUAL_STOP_AUDIO": {
        await stopAudioCapture("Manual stop");
        sendResponse({ success: true });
        return;
      }

      case "UNEXPECTED_TRACK_END": {
        await stopAudioCapture(message.reason || "Unexpected track end");
        sendResponse({ success: true });
        return;
      }

      case "OFFSCREEN_LOG": {
        console.log("[LateMeet][offscreen]", message.message);
        sendResponse({ success: true });
        return;
      }

      case "OFFSCREEN_CAPTURE_STOPPED": {
        state.audioActive = false;
        await broadcastStateUpdate();
        sendResponse({ success: true });
        return;
      }

      case "OFFSCREEN_AUDIO_CHUNK": {
        if (!state.isActive) {
          console.warn("[LateMeet] chunk received but session not active — ignored");
          sendResponse({ success: true, ignored: true });
          return;
        }

        if (typeof message.audioBase64 !== "string" || !message.audioBase64) {
          sendResponse({ success: false, error: "Missing audio chunk payload" });
          return;
        }

        const base64Len = message.audioBase64?.length ?? 0;
        const approxBytes = Math.round((base64Len * 3) / 4);
        console.log(
          `[LateMeet] chunk received — ~${approxBytes} bytes  mimeType=${message.mimeType}`,
        );

        const result = audioChunkQueue.enqueue({
          audioBase64: message.audioBase64,
          mimeType: typeof message.mimeType === "string" ? message.mimeType : "audio/webm",
          approxBytes,
          receivedAt: Date.now(),
          speaker: resolveTranscriptSpeaker(state.currentSpeaker),
        });

        if (!result.accepted) {
          console.warn("[LateMeet] audio chunk queue full — chunk rejected");
          sendResponse({
            success: false,
            queued: false,
            pending: result.pending,
            error: result.error,
          });
          return;
        }

        sendResponse({
          success: true,
          queued: true,
          chunkId: result.id,
          pending: result.pending,
        });
        return;
      }

      case "PARTICIPANTS_UPDATED": {
        if (!Array.isArray(message.participants)) {
          sendResponse({ success: false, error: "participants must be an array" });
          return;
        }

        const incomingSelfName =
          typeof message.selfName === "string" ? message.selfName.trim() : "";
        if (incomingSelfName) selfParticipantName = incomingSelfName;

        const joiners = detectNewJoiners(message.participants);
        await maybeWelcomeJoiners(sender?.tab?.id || state.targetTabId || undefined, joiners);
        await broadcastStateUpdate();
        sendResponse({ success: true, joiners });
        return;
      }

      case "ACTIVE_SPEAKER_CHANGED": {
        const speaker = normalizeActiveSpeakerName(message.name);

        if (!speaker) {
          sendResponse({ success: false, error: "Invalid active speaker name" });
          return;
        }

        state.currentSpeaker = speaker;
        await broadcastStateUpdate();
        sendResponse({ success: true, speaker });
        return;
      }

      case "SAVE_SESSION": {
        await persistSession();
        await broadcastStateUpdate();
        sendResponse({ success: true });
        return;
      }

      case "DISCARD_SESSION": {
        await discardPendingSession();
        await broadcastStateUpdate();
        sendResponse({ success: true });
        return;
      }

      case "GET_SAVED_SESSIONS": {
        const sessions = await getSavedMeetingSessions(chrome.storage.local);
        sendResponse(sessions);
        return;
      }

      case "DELETE_SAVED_SESSION": {
        await deleteSavedMeetingSession(chrome.storage.local, message.sessionId);
        sendResponse({ success: true });
        return;
      }

      default: {
        sendResponse({ success: false, error: "Unknown message type" });
      }
    }
  })().catch((err) => {
    console.error("[LateMeet] Message handler error:", err);
    sendResponse({ success: false, error: err.message || "Unexpected error" });
  });

  return true;
});

// Keyboard Shortcut Commands
chrome.commands.onCommand.addListener(async (command) => {
  try {
    if (command === "toggle-recording") {
      if (state.audioActive) {
        await stopAudioCapture("Keyboard shortcut stop");
        return;
      }

      await scanForMeetTabs();
      if (state.targetTabId) {
        await startAudioCapture(state.targetTabId, state.meetingId, state.meetingUrl);
      } else {
        console.warn("[LateMeet] No active Meet tab found for keyboard shortcut.");
      }
      return;
    }

    if (command === "open-side-panel") {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        await chrome.sidePanel.open({ tabId: activeTab.id });
      }
    }
  } catch (err) {
    console.error("[LateMeet] Keyboard command failed:", command, err);
  }
});

// Proactive scan on startup/load
scanForMeetTabs();
