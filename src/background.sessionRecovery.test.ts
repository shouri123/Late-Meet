/**
 * Integration tests for service-worker state recovery (issue #668).
 *
 * Simulates a service-worker restart by pre-seeding persisted state into
 * chrome.storage before `background.ts` is imported, then verifying that
 * `hydrateState()` (run on load and awaited by the message handler) restores all
 * meeting variables. State is read back through a real `GET_STATE` message via
 * the captured `chrome.runtime.onMessage` listener.
 *
 * Node's test runner isolates each test file in its own process, so this file
 * owns a single fresh import of the background module.
 */
import test from "node:test";
import assert from "node:assert/strict";

type AnyRecord = Record<string, unknown>;
type MessageListener = (
  message: AnyRecord,
  sender: AnyRecord,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;

// The state a previous service-worker instance is assumed to have persisted.
const SEEDED_STATE = {
  isActive: true,
  meetingId: "abc-defg-hij",
  meetingUrl: "https://meet.google.com/abc-defg-hij",
  startTime: 1_700_000_000_000,
  summary: "Recovered summary",
  summaryItems: [{ text: "Discussed roadmap", timestamp: "00:10" }],
  topics: [{ name: "Roadmap", status: "active" }],
  decisions: [{ text: "Ship the beta" }],
  actionItems: [{ task: "Email the team" }],
  currentTopic: "Roadmap",
  sentiment: "positive",
  keyInsights: [{ text: "Strong consensus", confidenceScore: 0.9 }],
  unresolvedDiscussions: ["Pricing tiers"],
  contradictions: [{ issue: "Scope vs. deadline", persists: true }],
  questionsRaised: ["When do we launch?"],
  participants: ["Alice", "Bob"],
  initialParticipants: ["Alice"],
  lateJoiners: ["Bob"],
  timeline: [{ event: "Meeting started", timestamp: 1_700_000_000_000, elapsed: 0 }],
  transcript: [{ speaker: "Alice", text: "Hello everyone", timestamp: 1 }],
  audioActive: true,
  targetTabId: 42,
  participantCount: 2,
};

const SEEDED_GUARDS = {
  isStartingAudio: false,
  isStoppingAudio: false,
  isProcessingSession: false,
  summaryInFlight: false,
  selfParticipantName: "Alice",
};

let messageListener: MessageListener | undefined;

/** Resolves a chrome.storage `get` argument to a flat list of keys. */
function toKeyList(keys: string | string[] | AnyRecord | null, store: AnyRecord): string[] {
  if (Array.isArray(keys)) return keys;
  if (typeof keys === "string") return [keys];
  return Object.keys(keys ?? store);
}

/** Minimal in-memory chrome.storage area backed by `store`. */
function createStorageArea(store: AnyRecord) {
  return {
    async get(keys: string | string[] | AnyRecord | null) {
      const out: AnyRecord = {};
      for (const key of toKeyList(keys, store)) if (key in store) out[key] = store[key];
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

function installChromeMock() {
  if (typeof (globalThis as AnyRecord).addEventListener !== "function") {
    (globalThis as AnyRecord).addEventListener = () => {};
  }
  (globalThis as AnyRecord).self = globalThis;

  // Persisted store as a prior SW instance would have left it.
  const localStore: AnyRecord = {
    activeMeetingState: structuredClone(SEEDED_STATE),
    activeMeetingGuards: structuredClone(SEEDED_GUARDS),
  };

  const noop = () => {};
  const ignored = { addListener: noop };

  (globalThis as AnyRecord).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://fakeextid/${path}`,
      sendMessage: async () => {},
      // A present offscreen context means a restored `audioActive` should be kept.
      getContexts: async () => [{ contextType: "OFFSCREEN_DOCUMENT" }],
      onMessage: {
        addListener: (cb: MessageListener) => {
          messageListener = cb;
        },
      },
      onInstalled: ignored,
      onStartup: ignored,
      onSuspend: ignored,
    },
    alarms: { onAlarm: ignored, create: noop },
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
      removeAll: (callback?: () => void) => callback?.(),
      create: noop,
    },
    sidePanel: { open: async () => {} },
    storage: {
      local: createStorageArea(localStore),
      session: createStorageArea({}),
    },
  };
}

installChromeMock();
await import("./background.ts");

/** Sends a message through the captured background listener and awaits the response. */
function sendMessage(message: AnyRecord): Promise<AnyRecord> {
  return new Promise((resolve) => {
    if (!messageListener) {
      throw new Error("background did not register a chrome.runtime.onMessage listener");
    }
    const kept = messageListener(message, {}, (response) => resolve((response ?? {}) as AnyRecord));
    if (kept !== true) resolve({});
  });
}

test("recovers the active meeting identity after a simulated restart", async () => {
  const state = await sendMessage({ type: "GET_STATE" });
  assert.equal(state.isActive, true);
  assert.equal(state.meetingId, "abc-defg-hij");
  assert.equal(state.meetingUrl, "https://meet.google.com/abc-defg-hij");
  assert.equal(state.startTime, 1_700_000_000_000);
  assert.equal(state.targetTabId, 42);
  assert.equal(state.participantCount, 2);
});

test("recovers AI-derived meeting content", async () => {
  const state = await sendMessage({ type: "GET_STATE" });
  assert.equal(state.summary, "Recovered summary");
  assert.equal(state.currentTopic, "Roadmap");
  assert.equal(state.sentiment, "positive");
  assert.deepEqual(
    (state.topics as AnyRecord[]).map((t) => t.name),
    ["Roadmap"],
  );
  assert.deepEqual(
    (state.decisions as AnyRecord[]).map((d) => d.text),
    ["Ship the beta"],
  );
  assert.deepEqual(
    (state.actionItems as AnyRecord[]).map((a) => a.task),
    ["Email the team"],
  );
  assert.deepEqual(state.unresolvedDiscussions, ["Pricing tiers"]);
  assert.deepEqual(state.questionsRaised, ["When do we launch?"]);
});

test("recovers transcript, timeline, and participant lists", async () => {
  const state = await sendMessage({ type: "GET_STATE" });

  const transcript = state.transcript as AnyRecord[];
  assert.equal(transcript.length, 1);
  assert.equal(transcript[0].text, "Hello everyone");
  assert.equal(transcript[0].speaker, "Alice");

  assert.equal((state.timeline as AnyRecord[]).length, 1);
  assert.deepEqual(state.participants, ["Alice", "Bob"]);
  assert.deepEqual(state.initialParticipants, ["Alice"]);
  assert.deepEqual(state.lateJoiners, ["Bob"]);
});

test("keeps audioActive when the offscreen document is still present", async () => {
  const state = await sendMessage({ type: "GET_STATE" });
  assert.equal(state.audioActive, true);
});
