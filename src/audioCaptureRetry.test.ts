import test from "node:test";
import assert from "node:assert/strict";

type AnyRecord = Record<string, unknown>;
type MessageListener = (
  message: AnyRecord,
  sender: AnyRecord,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;

let messageListener: MessageListener | undefined;
let getMediaStreamIdCalls = 0;
let getMediaStreamIdCallbackValue: string | null = null;
let lastErrorMock: { message: string } | null = null;
let sentMessages: AnyRecord[] = [];
let tabUpdatedListener: Function | null = null;

// Speed up setTimeout for backoff testing
const originalSetTimeout = globalThis.setTimeout;
(globalThis as any).setTimeout = (cb: Function, ms?: number) => {
  return originalSetTimeout(cb, 0);
};

function installChromeMock() {
  if (typeof (globalThis as any).addEventListener !== "function") {
    (globalThis as any).addEventListener = () => {};
  }
  (globalThis as any).self = globalThis;

  (globalThis as any).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://fakeextid/${path}`,
      sendMessage: async (msg: AnyRecord) => {
        sentMessages.push(msg);
        if (msg.type === "OFFSCREEN_START_CAPTURE") {
          return { success: false, error: "Mock offscreen start failure" };
        }
        return { success: true };
      },
      getContexts: async () => [],
      onMessage: {
        addListener: (cb: MessageListener) => {
          messageListener = cb;
        },
      },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
      onSuspend: { addListener: () => {} },
      get lastError() {
        return lastErrorMock;
      },
    },
    offscreen: {
      createDocument: async () => {},
      closeDocument: async () => {},
      hasDocument: async () => false,
    },
    alarms: {
      onAlarm: { addListener: () => {} },
      create: () => {},
    },
    tabs: {
      onUpdated: {
        addListener: (cb: Function) => {
          tabUpdatedListener = cb;
        },
      },
      onActivated: { addListener: () => {} },
      onRemoved: { addListener: () => {} },
      get: async () => ({}),
      query: async () => [],
      sendMessage: async () => {},
    },
    tabCapture: {
      getMediaStreamId: (options: any, callback: (streamId: string | null) => void) => {
        getMediaStreamIdCalls++;
        callback(getMediaStreamIdCallbackValue);
      },
    },
    commands: { onCommand: { addListener: () => {} } },
    contextMenus: {
      onClicked: { addListener: () => {} },
      removeAll: (cb?: () => void) => cb?.(),
      create: () => {},
    },
    sidePanel: { open: async () => {} },
    storage: {
      local: {
        get: async () => ({}),
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

installChromeMock();
await import("./background.ts");

function sendMessage(message: AnyRecord): Promise<AnyRecord> {
  return new Promise((resolve) => {
    if (!messageListener) {
      throw new Error("background did not register an onMessage listener");
    }
    const kept = messageListener(message, {}, (response) => resolve((response ?? {}) as AnyRecord));
    if (kept !== true) resolve({});
  });
}

test("audio capture retries 3 times and reports error on failure", async () => {
  getMediaStreamIdCalls = 0;
  getMediaStreamIdCallbackValue = null;
  lastErrorMock = { message: "Mocked capture stream permission denied" };
  sentMessages = [];

  const response = await sendMessage({
    type: "MANUAL_START_AUDIO",
    tabId: 42,
    meetingId: "abc-defg-hij",
  });

  // Verify that getMediaStreamId was called 3 times (due to retry limit)
  assert.equal(getMediaStreamIdCalls, 3);

  // Retrieve final state to check error message is populated
  const finalState = await sendMessage({ type: "GET_STATE" });
  assert.equal(finalState.audioActive, false);
  assert.equal(finalState.captureError, "Failed to get media stream ID for tab capture. Ensure you have given permission.");
});

test("audio capture stops when active tab navigates away from Google Meet", async () => {
  // Reset states
  const finalState1 = await sendMessage({ type: "GET_STATE" });
  assert.equal(finalState1.audioActive, false);

  // Simulate success on first try
  getMediaStreamIdCalls = 0;
  getMediaStreamIdCallbackValue = "mock-stream-id";
  lastErrorMock = null;
  
  // Temporarily mock sendMessage for runtime to return success for offscreen document start
  const originalSendMessage = chrome.runtime.sendMessage;
  chrome.runtime.sendMessage = async (msg: any) => {
    if (msg.type === "OFFSCREEN_START_CAPTURE") {
      return { success: true };
    }
    return { success: true };
  };

  await sendMessage({
    type: "MANUAL_START_AUDIO",
    tabId: 42,
    meetingId: "abc-defg-hij",
  });

  const activeState = await sendMessage({ type: "GET_STATE" });
  assert.equal(activeState.audioActive, true);
  assert.equal(activeState.targetTabId, 42);

  // Restore original runtime sendMessage
  chrome.runtime.sendMessage = originalSendMessage;

  // Now trigger tab update listener to navigate away
  assert.ok(tabUpdatedListener);
  await tabUpdatedListener(
    42,
    { url: "https://example.com" },
    { id: 42, url: "https://example.com" }
  );

  const stoppedState = await sendMessage({ type: "GET_STATE" });
  assert.equal(stoppedState.audioActive, false);
});
