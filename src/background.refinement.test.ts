import test from "node:test";
import assert from "node:assert/strict";

let capturedFetchRequests: Array<{ url: string; options: any }> = [];

const MOCK_API_KEY = "test-sk-123";

function installChromeMock() {
  const originalSetTimeout = globalThis.setTimeout;
  (globalThis as any).setTimeout = ((cb: any, ms: any) => {
    if (ms === 30 * 60 * 1000) return 1;
    return originalSetTimeout(cb, ms);
  }) as any;

  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true },
    configurable: true,
  });

  // Node.js does not define `self`; service-worker code uses it as an alias
  if (typeof (globalThis as any).addEventListener !== "function") {
    (globalThis as any).addEventListener = () => {};
  }
  (globalThis as any).self = globalThis;

  (globalThis as any).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://fakeextid/${path}`,
      sendMessage: async () => {},
      getContexts: async () => [],
      onMessage: { addListener: () => {} },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
      onSuspend: { addListener: () => {} },
    },
    alarms: {
      get: (name: string, cb?: Function) => {
        if (cb) cb({});
        else return Promise.resolve({});
      },
      clear: async () => {},
      onAlarm: { addListener: () => {} },
      create: () => {},
    },
    tabs: {
      onUpdated: { addListener: () => {} },
      onActivated: { addListener: () => {} },
      onRemoved: { addListener: () => {} },
      get: async () => ({}),
      query: async () => [],
      sendMessage: async () => {},
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
    storage: {
      local: {
        get: async (keys: any) => {
          if (keys === "openaiApiKey" || (Array.isArray(keys) && keys.includes("openaiApiKey"))) {
            return { openaiApiKey: MOCK_API_KEY };
          }
          return {};
        },
        set: async () => {},
        remove: async () => {},
      },
      session: {
        get: async (keys: any) => {
          if (keys === "openai_api_key" || (Array.isArray(keys) && keys.includes("openai_api_key"))) {
            return { openai_api_key: MOCK_API_KEY };
          }
          return {};
        },
        set: async () => {},
        remove: async () => {},
      },
    },
  };

  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async (url: string | URL | Request, options?: RequestInit) => {
    if (url.toString() === "https://api.openai.com/v1/chat/completions") {
      capturedFetchRequests.push({ url: url.toString(), options });
      return {
        ok: true,
        text: async () => "",
        json: async () => ({
          choices: [{ message: { content: "Refined transcript output" } }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }),
      } as any;
    }
    return originalFetch(url, options);
  };
}

installChromeMock();
const { refineTranscription } = await import("./background.ts");

test("refineTranscription constructs correct system message and user prompt", async () => {
  capturedFetchRequests = [];
  const rawText = "um so like this is a test transcript";
  
  const result = await refineTranscription(rawText);
  
  assert.equal(result, "Refined transcript output");
  assert.equal(capturedFetchRequests.length, 1);
  
  const req = capturedFetchRequests[0];
  assert.equal(req.url, "https://api.openai.com/v1/chat/completions");
  
  const body = JSON.parse(req.options.body);
  
  assert.equal(body.messages[0].role, "system");
  assert.ok(body.messages[0].content.includes("expert AI transcription editor"));
  
  assert.equal(body.messages[1].role, "user");
  assert.equal(body.messages[1].content, '"""um so like this is a test transcript"""');
});

test("refineTranscription sanitizes excessive quotes in input to prevent prompt injection", async () => {
  capturedFetchRequests = [];
  const rawText = 'they said """hello""" world';
  
  await refineTranscription(rawText);
  
  assert.equal(capturedFetchRequests.length, 1);
  const req = capturedFetchRequests[0];
  const body = JSON.parse(req.options.body);
  
  assert.equal(body.messages[1].role, "user");
  // The sanitize function removes backticks and HTML tags, but replace/"""/ replaces excessive quotes
  // wait, the code does: sanitizePromptText(rawText).replace(/"{3,}/g, '"')
  // sanitizePromptText also strips <> and {}
  assert.equal(body.messages[1].content, '"""they said "hello" world"""');
});

test("refineTranscription bypasses refinement for short chunks", async () => {
  capturedFetchRequests = [];
  const rawText = "ok";
  
  const result = await refineTranscription(rawText);
  
  assert.equal(result, "ok");
  assert.equal(capturedFetchRequests.length, 0);
});
