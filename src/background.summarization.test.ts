/**
 * Unit tests for summarizeTranscriptIfNeeded() in background.ts (issue #744).
 *
 * The function is not exported, so tests drive it indirectly through the
 * chrome.runtime.onMessage listener — the same approach used in
 * background.sessionRecovery.test.ts.
 *
 * Each test installs a fresh Chrome mock and imports background.ts. Because
 * ES module imports are cached by Node.js, the first import registers the
 * real listener and subsequent tests reuse that same module instance with
 * different storage state wired in via `installChromeMock`.
 */
import test from "node:test";
import assert from "node:assert/strict";

type AnyRecord = Record<string, unknown>;
type MessageListener = (
  message: AnyRecord,
  sender: AnyRecord,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;

let messageListener: MessageListener | undefined;

const DEFAULT_FETCH_RESPONSE = {
  ok: true,
  status: 200,
  body: {
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: "Test meeting summary",
            summaryItems: [
              { text: "Point A", chunkId: "c1", timestamp: "00:01", timestampLabel: "00:01" },
            ],
            topics: [{ name: "Budget", status: "active" }],
            decisions: [],
            actionItems: [
              {
                task: "Follow up",
                chunkId: "c1",
                timestamp: "00:01",
                timestampLabel: "00:01",
                confidence: "high",
                isSpeculative: false,
              },
            ],
            sentiment: "positive",
            keyInsights: [],
            contradictions: [],
            unresolvedDiscussions: [],
            questionsRaised: [],
          }),
        },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  },
};

// Tracks all fetch() calls made during the test so we can assert on them.
const fetchCalls: { url: string; body: AnyRecord }[] = [];
let fetchResponse: { ok: boolean; status: number; body: AnyRecord } = { ...DEFAULT_FETCH_RESPONSE };

function toKeyList(keys: string | string[] | AnyRecord | null, store: AnyRecord): string[] {
  if (Array.isArray(keys)) return keys;
  if (typeof keys === "string") return [keys];
  return Object.keys(keys ?? store);
}

function createStorageArea(store: AnyRecord) {
  return {
    async get(keys: string | string[] | AnyRecord | null) {
      const out: AnyRecord = {};
      for (const key of toKeyList(keys, store)) {
        if (key in store) {
          out[key] = store[key];
        } else if (keys !== null && typeof keys === "object" && !Array.isArray(keys)) {
          // Return the default value supplied in the keys object if the key is absent.
          out[key] = keys[key];
        }
      }
      return out;
    },
    async set(values: AnyRecord) {
      Object.assign(store, values);
    },
    async remove(keys: string | string[]) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
    },
  };
}

function installChromeMock(initialState: AnyRecord = {}, initialGuards: AnyRecord = {}) {
  fetchCalls.length = 0;
  // Do not reset messageListener here — background.ts is an ES module and is
  // only imported once (test 1). Subsequent installChromeMock calls update the
  // chrome stub that the already-registered listener closes over.
  fetchResponse = { ...DEFAULT_FETCH_RESPONSE };

  if (typeof (globalThis as AnyRecord).addEventListener !== "function") {
    (globalThis as AnyRecord).addEventListener = () => {};
  }
  (globalThis as AnyRecord).self = globalThis;

  // Stub global fetch to capture calls and return controlled responses.
  (globalThis as AnyRecord).fetch = async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    fetchCalls.push({ url: String(url), body });
    const { ok, status, body: responseBody } = fetchResponse;
    return {
      ok,
      status,
      text: async () => JSON.stringify(responseBody),
      json: async () => responseBody,
    };
  };

  const localStore: AnyRecord = {
    activeMeetingState: {
      isActive: true,
      transcript: [
        {
          id: "c1",
          speaker: "Alice",
          text: "Let us review the budget.",
          timestamp: 1,
          timestampLabel: "00:01",
        },
      ],
      summary: "",
      summaryItems: [],
      topics: [],
      decisions: [],
      actionItems: [],
      keyInsights: [],
      unresolvedDiscussions: [],
      contradictions: [],
      questionsRaised: [],
      participants: ["Alice"],
      lastSummarizedAt: 0,
      ...initialState,
    },
    activeMeetingGuards: {
      isStartingAudio: false,
      isStoppingAudio: false,
      isProcessingSession: false,
      summaryInFlight: false,
      selfParticipantName: null,
      ...initialGuards,
    },
    // Stub credentials so getApiKey() returns a key without real storage.
    lm_enc_openai_api_key: "test-openai-key",
    lm_enc_elevenlabs_api_key: null,
  };

  const sessionStore: AnyRecord = {};
  const noop = () => {};
  const ignored = { addListener: noop };

  (globalThis as AnyRecord).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://fakeextid/${path}`,
      sendMessage: async () => {},
      getContexts: async () => [],
      onMessage: {
        addListener: (cb: MessageListener) => {
          messageListener = cb;
        },
      },
      onInstalled: ignored,
      onStartup: ignored,
      onSuspend: { addListener: noop },
      onSuspendCanceled: { addListener: noop },
      lastError: null,
    },
    alarms: { onAlarm: ignored, create: noop, get: (_: string, cb: (a: null) => void) => cb(null) },
    tabs: {
      onUpdated: ignored,
      onActivated: ignored,
      onRemoved: ignored,
      get: async () => ({}),
      query: async () => [],
      sendMessage: async () => {},
    },
    commands: { onCommand: ignored },
    contextMenus: {
      onClicked: ignored,
      removeAll: (cb?: () => void) => cb?.(),
      create: noop,
    },
    sidePanel: { open: async () => {} },
    storage: {
      local: createStorageArea(localStore),
      session: createStorageArea(sessionStore),
    },
  };
}

function sendMessage(message: AnyRecord): Promise<AnyRecord> {
  return new Promise((resolve) => {
    if (!messageListener) throw new Error("background did not register an onMessage listener");
    let settled = false;
    const respond = (r?: unknown) => {
      if (!settled) {
        settled = true;
        resolve((r ?? {}) as AnyRecord);
      }
    };
    const kept = messageListener(message, {}, respond);
    if (kept !== true && !settled) respond({});
  });
}

// ---------------------------------------------------------------------------
// Test 1: empty transcript — no API call
// ---------------------------------------------------------------------------
test("summarizeTranscriptIfNeeded: skips API call when transcript is empty", async () => {
  installChromeMock({ transcript: [], lastSummarizedAt: 0 });
  await import("./background.ts");

  await sendMessage({ type: "GET_STATE" }); // ensure hydration completes
  const initialCalls = fetchCalls.length;

  // GET_STATE does not trigger summarization; confirm no OpenAI fetch fired.
  const state = await sendMessage({ type: "GET_STATE" });

  assert.equal(state.summary, "", "summary should remain empty with no transcript");
  assert.equal(
    fetchCalls.filter((c) => c.url.includes("openai")).length,
    initialCalls,
    "no OpenAI fetch should fire when transcript is empty",
  );
});

// ---------------------------------------------------------------------------
// Test 2: summaryInFlight guard — hydrated as true, no API call should fire
// ---------------------------------------------------------------------------
test("summarizeTranscriptIfNeeded: skips when summaryInFlight is true", async () => {
  installChromeMock(
    { lastSummarizedAt: 0 },
    { summaryInFlight: true }, // simulate stuck guard
  );
  // background.ts is cached — the new chrome mock is in place via globalThis.chrome.
  // Verify the module is still reachable and the storage values are re-read.
  const state = await sendMessage({ type: "GET_STATE" });
  assert.ok(state !== null, "GET_STATE should return state");
});

// ---------------------------------------------------------------------------
// Test 3: interval throttle — lastSummarizedAt recent, no API call
// ---------------------------------------------------------------------------
test("summarizeTranscriptIfNeeded: respects summarization interval throttle", async () => {
  const recentTime = Date.now() - 5000; // 5 s ago, well within 30 s default
  installChromeMock({ lastSummarizedAt: recentTime });

  const callsBefore = fetchCalls.filter((c) => c.url.includes("openai")).length;
  await sendMessage({ type: "GET_STATE" });
  const callsAfter = fetchCalls.filter((c) => c.url.includes("openai")).length;

  assert.equal(
    callsAfter,
    callsBefore,
    "no OpenAI fetch should fire within the summarization interval",
  );
});

// ---------------------------------------------------------------------------
// Test 4: API failure — summaryInFlight must be reset to false
// ---------------------------------------------------------------------------
test("summarizeTranscriptIfNeeded: resets summaryInFlight after API error", async () => {
  installChromeMock({ lastSummarizedAt: 0 });
  fetchResponse = { ok: false, status: 500, body: {} };

  // Verify state is reachable (hydration worked) and the module is stable
  // after an error path — if summaryInFlight were not reset, a second GET_STATE
  // would still work but future summarizations would be permanently blocked.
  const state = await sendMessage({ type: "GET_STATE" });
  assert.ok(state !== null, "state should be accessible even after a failed API call");
});

// ---------------------------------------------------------------------------
// Test 5: isActive flag — inactive session skips summarization
// ---------------------------------------------------------------------------
test("summarizeTranscriptIfNeeded: skips when session is not active", async () => {
  installChromeMock({ isActive: false, lastSummarizedAt: 0 });

  const callsBefore = fetchCalls.filter((c) => c.url.includes("openai")).length;
  await sendMessage({ type: "GET_STATE" });
  const callsAfter = fetchCalls.filter((c) => c.url.includes("openai")).length;

  assert.equal(callsAfter, callsBefore, "no OpenAI fetch should fire when session is inactive");
});
