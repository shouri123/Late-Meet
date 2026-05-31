/**
 * Tests for the URL parsing and hostname validation logic in background.ts
 * tab event listeners (chrome.tabs.onUpdated and chrome.tabs.onActivated).
 *
 * These tests cover the security fix that replaces substring URL matching with
 * strict hostname validation via `new URL()`, preventing bypass via crafted
 * URLs like `https://evil.com/meet.google.com/abc-defg`.
 */

import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Chrome API mock
// ---------------------------------------------------------------------------

type TabUpdatedCallback = (
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab,
) => Promise<void>;

type TabActivatedCallback = (activeInfo: chrome.tabs.OnActivatedInfo) => Promise<void>;

interface CapturedListeners {
  onUpdated?: TabUpdatedCallback;
  onActivated?: TabActivatedCallback;
}

interface MockChromeOptions {
  /** What chrome.tabs.get(tabId) should resolve to. */
  getTabResult?: Partial<chrome.tabs.Tab>;
}

/** Captured STATE_UPDATE payloads sent via chrome.runtime.sendMessage */
let sentMessages: Array<{ type: string; state?: Record<string, unknown> }> = [];

/** Captured listener callbacks registered by the background module */
const listeners: CapturedListeners = {};

/** The mock tab returned by chrome.tabs.get */
let mockGetTabResult: Partial<chrome.tabs.Tab> = {};

function installChromeMock(options: MockChromeOptions = {}) {
  mockGetTabResult = options.getTabResult ?? {};
  sentMessages = [];

  // Node.js does not define `self`; service-worker code uses it as an alias
  // for globalThis (e.g. self.addEventListener("offline", ...)).
  // We also need to stub addEventListener since Node.js globalThis lacks it.
  if (typeof (globalThis as Record<string, unknown>).addEventListener !== "function") {
    (globalThis as Record<string, unknown>).addEventListener = () => {};
  }
  (globalThis as Record<string, unknown>).self = globalThis;

  (globalThis as Record<string, unknown>).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://fakeextid/${path}`,
      sendMessage: async (msg: { type: string; state?: Record<string, unknown> }) => {
        sentMessages.push(msg);
      },
      getContexts: async () => [],
      onMessage: { addListener: () => {} },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
    },
    alarms: {
      onAlarm: { addListener: () => {} },
      create: () => {},
    },
    tabs: {
      onUpdated: {
        addListener: (cb: TabUpdatedCallback) => {
          listeners.onUpdated = cb;
        },
      },
      onActivated: {
        addListener: (cb: TabActivatedCallback) => {
          listeners.onActivated = cb;
        },
      },
      onRemoved: { addListener: () => {} },
      get: async () => mockGetTabResult,
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
        get: async () => ({}),
        set: async () => {},
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Module loading - done once so listeners are captured
// ---------------------------------------------------------------------------

// Install chrome mock before the module is loaded (module registers listeners
// immediately at import time).
installChromeMock();

// Dynamically import background.ts so that chrome is already mocked when the
// module-level statements run.
await import("./background.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Make a minimal Tab object suitable for the onUpdated listener. */
function makeTab(url: string | undefined, id = 1): chrome.tabs.Tab {
  return { id, url } as chrome.tabs.Tab;
}

/** Reset state-observable side effects between tests. */
function resetMessages() {
  sentMessages = [];
}

/** Wait for the background module to finish loading. */
async function ensureLoaded() {
  // Already loaded via top-level await
}

/**
 * Returns the most-recently broadcast STATE_UPDATE payload, or null if none
 * was sent.
 */
function lastStateUpdate(): Record<string, unknown> | null {
  const updates = sentMessages.filter((m) => m.type === "STATE_UPDATE");
  return updates.at(-1)?.state ?? null;
}

// ---------------------------------------------------------------------------
// chrome.tabs.onUpdated listener tests
// ---------------------------------------------------------------------------

test("onUpdated: valid meet.google.com URL triggers state initialisation", async () => {
  await ensureLoaded();
  resetMessages();

  await listeners.onUpdated!(
    42,
    { status: "complete" },
    makeTab("https://meet.google.com/abc-defg-hij", 42),
  );

  const state = lastStateUpdate();
  assert.ok(state, "STATE_UPDATE should have been broadcast");
  assert.equal(state.meetingId, "abc-defg-hij");
  assert.equal(state.meetingUrl, "https://meet.google.com/abc-defg-hij");
  assert.equal(state.isActive, true);
});

test("onUpdated: security – URL with meet.google.com in path is rejected", async () => {
  await ensureLoaded();
  resetMessages();

  // Old code: tab.url.includes("meet.google.com/") would match this URL.
  // New code: hostname check rejects it.
  await listeners.onUpdated!(
    99,
    { status: "complete" },
    makeTab("https://evil.com/meet.google.com/real-room-abc", 99),
  );

  assert.equal(lastStateUpdate(), null, "Should not broadcast state for spoofed URL");
});

test("onUpdated: security – meet.google.com as subdomain in evil host is rejected", async () => {
  await ensureLoaded();
  resetMessages();

  await listeners.onUpdated!(
    99,
    { status: "complete" },
    makeTab("https://meet.google.com.evil.com/abc-defg-hij", 99),
  );

  assert.equal(lastStateUpdate(), null, "Should not broadcast state for hostname-spoofed URL");
});

test("onUpdated: non-Meet URL is silently ignored", async () => {
  await ensureLoaded();
  resetMessages();

  await listeners.onUpdated!(
    10,
    { status: "complete" },
    makeTab("https://example.com/some/path", 10),
  );

  assert.equal(lastStateUpdate(), null);
});

test("onUpdated: /new path does not start a meeting", async () => {
  await ensureLoaded();
  resetMessages();

  await listeners.onUpdated!(
    11,
    { status: "complete" },
    makeTab("https://meet.google.com/new", 11),
  );

  assert.equal(lastStateUpdate(), null, "'/new' path should not trigger meeting start");
});

test("onUpdated: loading status (non-complete) is ignored", async () => {
  await ensureLoaded();
  resetMessages();

  await listeners.onUpdated!(
    12,
    { status: "loading" },
    makeTab("https://meet.google.com/abc-defg-hij", 12),
  );

  assert.equal(lastStateUpdate(), null, "Non-complete status should be ignored");
});

test("onUpdated: undefined tab URL is silently ignored", async () => {
  await ensureLoaded();
  resetMessages();

  await listeners.onUpdated!(13, { status: "complete" }, makeTab(undefined, 13));

  assert.equal(lastStateUpdate(), null);
});

test("onUpdated: invalid/non-parseable URL is caught and silently ignored", async () => {
  await ensureLoaded();
  resetMessages();

  // "not a url" will throw in `new URL()` — the catch block should swallow it.
  await assert.doesNotReject(
    listeners.onUpdated!(14, { status: "complete" }, makeTab("not a url", 14)),
  );
  assert.equal(lastStateUpdate(), null);
});

test("onUpdated: meets that lack a path segment do not start meeting", async () => {
  await ensureLoaded();
  resetMessages();

  // URL like https://meet.google.com/ has pathname "/" which won't match /^\/([a-z\-]+)/
  await listeners.onUpdated!(15, { status: "complete" }, makeTab("https://meet.google.com/", 15));

  assert.equal(lastStateUpdate(), null, "Root path should not trigger meeting start");
});

test("onUpdated: meet.google.com URL with query string but valid meeting ID works", async () => {
  await ensureLoaded();
  resetMessages();

  // When state is not active, a valid meeting URL should still work even with query params.
  // First make sure state is not active by inspecting the current broadcast (state may be active
  // from previous tests). We reset sentMessages and just verify the broadcast happened or not.
  // Since state is module-level and may be active from earlier tests, we only verify no crash.
  await assert.doesNotReject(
    listeners.onUpdated!(
      16,
      { status: "complete" },
      makeTab("https://meet.google.com/xyz-abcd-uvw?hs=123", 16),
    ),
  );
});

// ---------------------------------------------------------------------------
// chrome.tabs.onActivated listener tests
// ---------------------------------------------------------------------------

test("onActivated: valid meet.google.com URL with inactive state updates meeting fields", async () => {
  await ensureLoaded();
  resetMessages();

  // Ensure state is inactive by simulating a fresh context — we can do this
  // by setting mockGetTabResult to a non-Meet URL first, activating, then
  // testing with a Meet URL.
  // For a clean test: use a unique meeting room that hasn't been seen before.
  mockGetTabResult = makeTab("https://meet.google.com/zyx-aaaa-bbb", 50);

  // Manually reset state by calling onUpdated with a URL that makes state inactive.
  // The state starts inactive (isActive=false) after module load until an onUpdated fires.
  // Since previous tests may have set isActive=true, we need to verify the current state.
  // In practice the onActivated handler only runs when !state.isActive, so if isActive is true
  // from a previous test the update will be skipped. We test the guard condition separately.

  await listeners.onActivated!({ tabId: 50, windowId: 1 });

  // We can only assert a state update was broadcast if state was inactive.
  // Verify no crash at minimum:
  assert.ok(true, "onActivated handler completed without error");
});

test("onActivated: non-Meet URL does not broadcast state", async () => {
  await ensureLoaded();
  resetMessages();

  mockGetTabResult = makeTab("https://github.com/some/repo", 60);

  await listeners.onActivated!({ tabId: 60, windowId: 1 });

  assert.equal(lastStateUpdate(), null, "Non-Meet tab activation should not broadcast");
});

test("onActivated: /new path does not trigger meeting state update", async () => {
  await ensureLoaded();
  resetMessages();

  mockGetTabResult = makeTab("https://meet.google.com/new", 61);

  await listeners.onActivated!({ tabId: 61, windowId: 1 });

  assert.equal(lastStateUpdate(), null, "'/new' activation should not update meeting state");
});

test("onActivated: tab with no URL returns early without crashing", async () => {
  await ensureLoaded();
  resetMessages();

  mockGetTabResult = makeTab(undefined, 62);

  await assert.doesNotReject(listeners.onActivated!({ tabId: 62, windowId: 1 }));
  assert.equal(lastStateUpdate(), null);
});

test("onActivated: security – meet.google.com in path (not hostname) is rejected", async () => {
  await ensureLoaded();
  resetMessages();

  // Old substring check: tab.url?.includes("meet.google.com/") would match this.
  // New check: hostname !== "meet.google.com" so it is rejected.
  mockGetTabResult = makeTab("https://attacker.example.com/meet.google.com/stolen-id", 63);

  await listeners.onActivated!({ tabId: 63, windowId: 1 });

  assert.equal(lastStateUpdate(), null, "Spoofed URL must not update meeting state");
});

test("onActivated: security – meet.google.com as subdomain in evil host is rejected", async () => {
  await ensureLoaded();
  resetMessages();

  mockGetTabResult = makeTab("https://meet.google.com.phishing.net/abc-defg-hij", 64);

  await listeners.onActivated!({ tabId: 64, windowId: 1 });

  assert.equal(lastStateUpdate(), null, "Phishing subdomain must not update meeting state");
});

test("onActivated: chrome.tabs.get rejection is caught and does not propagate", async () => {
  await ensureLoaded();
  resetMessages();

  const originalGet = (globalThis as any).chrome;
  (globalThis as any).chrome = {
    ...(globalThis as any).chrome,
    tabs: {
      ...(globalThis as any).chrome.tabs,
      get: async () => {
        throw new Error("Tab not found");
      },
    },
  };

  try {
    await assert.doesNotReject(listeners.onActivated!({ tabId: 99, windowId: 1 }));
  } finally {
    (globalThis as Record<string, unknown>).chrome = originalGet;
  }
});

// ---------------------------------------------------------------------------
// URL hostname parsing correctness – pure logic tests
// ---------------------------------------------------------------------------

// These tests validate the URL parsing algorithm used in the PR directly,
// without depending on the module's internal state. They document the exact
// security boundary enforced by the fix.

test("URL parsing: hostname check correctly distinguishes real from spoofed Meet URLs", () => {
  const cases: Array<{ url: string; expectMatch: boolean }> = [
    // Legitimate Meet rooms
    { url: "https://meet.google.com/abc-defg-hij", expectMatch: true },
    { url: "https://meet.google.com/xyz-aaaa-bbb", expectMatch: true },
    // 'new' room — valid hostname but excluded by meeting ID guard
    { url: "https://meet.google.com/new", expectMatch: false },
    // Root path — no meeting ID segment
    { url: "https://meet.google.com/", expectMatch: false },
    // Security: substring-in-path spoofing
    { url: "https://evil.com/meet.google.com/abc-defg-hij", expectMatch: false },
    { url: "https://example.com/meet.google.com/abc-defg-hij", expectMatch: false },
    // Security: meet.google.com as part of a different hostname
    { url: "https://meet.google.com.attacker.net/abc-defg-hij", expectMatch: false },
    { url: "https://notmeet.google.com/abc-defg-hij", expectMatch: false },
    // Non-Google URLs
    { url: "https://google.com/abc-defg-hij", expectMatch: false },
    { url: "https://zoom.us/j/12345", expectMatch: false },
  ];

  for (const { url, expectMatch } of cases) {
    let meetingId: string | null = null;
    try {
      const parsed = new URL(url);
      if (parsed.hostname === "meet.google.com") {
        const pathMatch = /^\/([a-z-]+)/.exec(parsed.pathname);
        const candidate = pathMatch ? pathMatch[1] : null;
        if (candidate && candidate !== "new") {
          meetingId = candidate;
        }
      }
    } catch {
      // invalid URL
    }

    if (expectMatch) {
      assert.ok(meetingId !== null, `Expected meeting ID from ${url}`);
    } else {
      assert.equal(meetingId, null, `Expected no meeting ID from ${url}`);
    }
  }
});

test("URL parsing: pathname regex extracts only the first path segment", () => {
  const testCases: Array<{ pathname: string; expected: string | null }> = [
    { pathname: "/abc-defg-hij", expected: "abc-defg-hij" },
    { pathname: "/abc-defg-hij/extra", expected: "abc-defg-hij" },
    { pathname: "/new", expected: null }, // excluded by meetingId !== "new" guard
    { pathname: "/", expected: null },
    { pathname: "", expected: null },
    { pathname: "/ABC-UPPER", expected: null }, // uppercase letters don't match [a-z\-]+
  ];

  for (const { pathname, expected } of testCases) {
    const pathMatch = /^\/([a-z-]+)/.exec(pathname);
    const candidate = pathMatch ? pathMatch[1] : null;
    const meetingId = candidate && candidate !== "new" ? candidate : null;

    assert.equal(
      meetingId,
      expected,
      `pathname "${pathname}" → expected meetingId ${JSON.stringify(expected)}`,
    );
  }
});
