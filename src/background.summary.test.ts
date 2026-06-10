import test, { after } from "node:test";
import assert from "node:assert/strict";
import { lockCredentials } from "./utils/credentials.ts";

type MessageHandler = (message: any, sender: any, sendResponse: (r?: any) => void) => boolean;

let onMessageListeners: MessageHandler[] = [];
let alarmListeners: Array<(alarm: { name: string }) => void> = [];
let createdAlarms: Record<string, { when: number }> = {};
let clearedAlarms: string[] = [];
let fetchCalls: any[] = [];

const mockStorage: Record<string, any> = {
  settings: { summarizationInterval: 30 },
  activeMeetingState: {
    isActive: true,
    audioActive: true,
    transcript: [
      { id: "c1", text: "hello", speaker: "John", timestamp: 1, timestampLabel: "00:01" },
    ],
    lastSummarizedAt: Date.now() - 5000, // 5 seconds ago
  },
};

function installChromeMock() {
  onMessageListeners = [];
  alarmListeners = [];
  createdAlarms = {};
  clearedAlarms = [];
  fetchCalls = [];

  (globalThis as any).fetch = async (url: string, options: any) => {
    fetchCalls.push({ url, options });
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          text: "Mock transcript",
          choices: [{ message: { content: '{"text": "Mock transcript"}' } }],
        }),
      json: async () => ({
        text: "Mock transcript",
        choices: [{ message: { content: '{"text": "Mock transcript"}' } }],
      }),
    };
  };

  if (typeof (globalThis as any).addEventListener !== "function") {
    (globalThis as any).addEventListener = () => {};
  }
  (globalThis as any).self = globalThis;

  (globalThis as any).chrome = {
    runtime: {
      getURL: (p: string) => `chrome-extension://ext/${p}`,
      sendMessage: async () => {},
      getContexts: async () => [],
      onMessage: {
        addListener: (cb: MessageHandler) => {
          onMessageListeners.push(cb);
        },
      },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
    },
    alarms: {
      onAlarm: {
        addListener: (cb: any) => {
          alarmListeners.push(cb);
        },
      },
      create: (name: string, info: any) => {
        createdAlarms[name] = info;
      },
      clear: (name: string) => {
        clearedAlarms.push(name);
        delete createdAlarms[name];
      },
    },
    tabs: {
      onUpdated: { addListener: () => {} },
      onActivated: { addListener: () => {} },
      onRemoved: { addListener: () => {} },
      query: async () => [],
      sendMessage: async () => {},
    },
    commands: { onCommand: { addListener: () => {} } },
    contextMenus: {
      onClicked: { addListener: () => {} },
      removeAll: (cb: any) => cb?.(),
      create: () => {},
    },
    sidePanel: { open: async () => {} },
    storage: {
      local: {
        get: async (key: string) => {
          if (key === "settings") return mockStorage;
          if (key === "credentials")
            return { credentials: { OPENAI_API_KEY: { key: "foo", isEncrypted: false } } };
          return { [key]: mockStorage[key] };
        },
        set: async (items: any) => {
          Object.assign(mockStorage, items);
        },
        remove: async (key: string) => {
          delete mockStorage[key];
        },
      },
      session: {
        get: async (key: string) => ({ openai_api_key: "foo" }),
        set: async (items: any) => {},
        remove: async (key: string) => {},
      },
    },
  };
}

installChromeMock();

// Load the module after mocks
await import("./background.ts");

async function sendMessage(msg: any) {
  for (const listener of onMessageListeners) {
    listener(msg, {}, () => {});
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("Interval guard schedules an alarm if elapsed time is less than interval", async () => {
  // Reset test tracking variables
  createdAlarms = {};
  clearedAlarms = [];
  fetchCalls = [];

  // Note: activeMeetingState was already hydrated at module load because we set it
  // in mockStorage before `await import("./background.ts")`. Thus `state.isActive` is true,
  // and `state.lastSummarizedAt` is very recent.

  // Send first chunk to trigger initial summarization and set lastSummarizedAt > 0
  await sendMessage({
    type: "OFFSCREEN_AUDIO_CHUNK",
    audioBase64: "A".repeat(10000),
    timestamp: Date.now(),
  });

  // Wait for it to process
  await sleep(200);

  // Now state.lastSummarizedAt is recent. Send second chunk to hit the interval guard.
  await sendMessage({
    type: "OFFSCREEN_AUDIO_CHUNK",
    audioBase64: "A".repeat(10000),
    timestamp: Date.now(),
  });

  // Wait for the queue to process it
  await sleep(100);

  // We expect SUMMARY_RETRY_ALARM to be created because it's been less than 30s since the first summary
  assert.ok(createdAlarms["summarize-retry"], "Alarm should be scheduled");
  const alarmWhen = createdAlarms["summarize-retry"].when;
  assert.ok(alarmWhen > Date.now(), "Alarm should be in the future");
});

test("Manual stop audio forces final summary flush", async () => {
  createdAlarms = {};
  clearedAlarms = [];
  fetchCalls = [];

  // Trigger manual stop
  await sendMessage({ type: "MANUAL_STOP_AUDIO" });
  await sleep(500);

  // The final flush clears the retry alarm
  assert.ok(
    clearedAlarms.includes("summarize-retry"),
    "Retry alarm should be cleared before final flush",
  );

  // Check that fetch was called for the summary endpoint (OPENAI_CHAT_URL)
  const chatCalls = fetchCalls.filter((f) => f.url.includes("api.openai.com/v1/chat/completions"));
  assert.ok(chatCalls.length > 0, "A final summary request should be dispatched");
});

after(() => {
  // Clear the 30-minute auto-lock timer created in credentials.ts when getApiKey() unlocks credentials.
  lockCredentials();
});
