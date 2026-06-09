import test from "node:test";
import assert from "node:assert/strict";

type RuntimeMessageCallback = (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
) => boolean | void;

const activeMeetingState = {
  isActive: true,
  meetingId: "abc-defg-hij",
  meetingUrl: "https://meet.google.com/abc-defg-hij",
  startTime: Date.now() - 20_000,
  summary: "Project status reviewed.",
  summaryItems: [],
  topics: [],
  decisions: [],
  actionItems: [],
  currentTopic: "release planning",
  sentiment: "neutral",
  keyInsights: [],
  unresolvedDiscussions: [],
  contradictions: [],
  questionsRaised: [],
  participants: ["Alice"],
  initialParticipants: ["Alice"],
  lateJoiners: [],
  timeline: [],
  transcript: [],
  audioActive: true,
  currentSpeaker: null,
  targetTabId: 7,
  lastSummarizedAt: 0,
  participantCount: 1,
};

let settings: Record<string, unknown> = {
  lateJoinerBriefing: true,
  publicLateJoinerChat: false,
};
let onMessage: RuntimeMessageCallback | null = null;
let tabMessages: Array<{ tabId: number; message: any }> = [];

function installChromeMock() {
  if (typeof (globalThis as any).addEventListener !== "function") {
    (globalThis as any).addEventListener = () => {};
  }
  (globalThis as any).self = globalThis;
  (globalThis as any).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://late-meet/${path}`,
      getContexts: async () => [],
      sendMessage: async () => undefined,
      onMessage: {
        addListener: (callback: RuntimeMessageCallback) => {
          onMessage = callback;
        },
      },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
      onSuspend: { addListener: () => {} },
    },
    alarms: {
      onAlarm: { addListener: () => {} },
      create: () => {},
    },
    tabs: {
      onUpdated: { addListener: () => {} },
      onActivated: { addListener: () => {} },
      onRemoved: { addListener: () => {} },
      query: async () => [],
      get: async () => ({}),
      sendMessage: async (tabId: number, message: any) => {
        tabMessages.push({ tabId, message });
        return { success: true };
      },
    },
    commands: {
      onCommand: { addListener: () => {} },
    },
    contextMenus: {
      onClicked: { addListener: () => {} },
      removeAll: (callback?: () => void) => callback?.(),
      create: () => {},
    },
    sidePanel: {
      open: async () => {},
    },
    offscreen: {
      createDocument: async () => {},
      closeDocument: async () => {},
    },
    storage: {
      local: {
        get: async (key?: string | string[] | null) => {
          if (key === "activeMeetingState") return { activeMeetingState };
          if (key === "settings") return { settings };
          if (Array.isArray(key)) {
            return Object.fromEntries(
              key.map((item) => [
                item,
                item === "activeMeetingState"
                  ? activeMeetingState
                  : item === "settings"
                    ? settings
                    : undefined,
              ]),
            );
          }
          return {};
        },
        set: async () => {},
        remove: async () => {},
      },
      session: {
        get: async () => ({}),
        set: async () => {},
        remove: async () => {},
      },
    },
  };
}

async function sendMessage(message: any) {
  assert.ok(onMessage, "background onMessage listener should be registered");

  return new Promise<any>((resolve) => {
    onMessage!(
      message,
      {
        tab: {
          id: 7,
          url: "https://meet.google.com/abc-defg-hij",
        } as chrome.tabs.Tab,
      },
      resolve,
    );
  });
}

installChromeMock();
await import("./background.ts");

test("late-joiner workflow: Bob joins (private-only), then Carol joins (with public chat)", async () => {
  // Step 1 — Bob joins while public chat is disabled; only private overlay expected.
  tabMessages = [];
  settings = { lateJoinerBriefing: true, publicLateJoinerChat: false };

  const response1 = await sendMessage({
    type: "PARTICIPANTS_UPDATED",
    participants: ["Alice", "Bob"],
    selfName: "Alice",
  });

  assert.equal(response1.success, true);
  assert.deepEqual(response1.joiners, ["Bob"]);
  assert.equal(tabMessages.length, 1);
  assert.equal(tabMessages[0].tabId, 7);
  assert.equal(tabMessages[0].message.type, "SHOW_BRIEF");
  assert.equal(tabMessages[0].message.targetName, "Bob");
  assert.match(tabMessages[0].message.briefContent, /Bob/i);

  // Step 2 — Carol joins after public chat is opted in; both overlay and chat message expected.
  // Bob is already a known participant from step 1, so only Carol is detected as a new joiner.
  tabMessages = [];
  settings = { lateJoinerBriefing: true, publicLateJoinerChat: true };

  const response2 = await sendMessage({
    type: "PARTICIPANTS_UPDATED",
    participants: ["Alice", "Bob", "Carol"],
    selfName: "Alice",
  });

  assert.equal(response2.success, true);
  assert.deepEqual(response2.joiners, ["Carol"]);
  assert.deepEqual(
    tabMessages.map((entry) => entry.message.type),
    ["SHOW_BRIEF", "SEND_CHAT_MESSAGE"],
  );
  assert.equal(tabMessages[0].message.targetName, "Carol");
  assert.match(tabMessages[1].message.text, /Carol/i);
});
