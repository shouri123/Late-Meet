import test from "node:test";
import assert from "node:assert/strict";

import { getMeetingIdFromUrl, resolveManualMeetTab } from "./meetingTabs.ts";

type MockTab = Pick<chrome.tabs.Tab, "id" | "url" | "active"> & {
  currentWindow?: boolean;
};

function mockChromeTabs(tabs: MockTab[]) {
  const previousChrome = (globalThis as any).chrome;

  (globalThis as any).chrome = {
    tabs: {
      query: async (queryInfo: chrome.tabs.QueryInfo) => {
        if (queryInfo.active && queryInfo.currentWindow) {
          return tabs.filter((tab) => tab.active && tab.currentWindow) as chrome.tabs.Tab[];
        }

        if (queryInfo.url === "https://meet.google.com/*") {
          return tabs.filter((tab) =>
            tab.url?.startsWith("https://meet.google.com/"),
          ) as chrome.tabs.Tab[];
        }

        if (queryInfo.url === "https://*.zoom.us/wc/*") {
          return tabs.filter((tab) => {
            try {
              if (!tab.url) return false;
              const parsed = new URL(tab.url);
              return (
                parsed.hostname.endsWith(".zoom.us") && parsed.pathname.split("/").includes("wc")
              );
            } catch {
              return false;
            }
          }) as chrome.tabs.Tab[];
        }

        if (queryInfo.url === "https://zoom.us/wc/*") {
          return tabs.filter((tab) => {
            try {
              if (!tab.url) return false;
              const parsed = new URL(tab.url);
              return parsed.hostname === "zoom.us" && parsed.pathname.split("/").includes("wc");
            } catch {
              return false;
            }
          }) as chrome.tabs.Tab[];
        }

        return [];
      },
    },
  };

  return () => {
    (globalThis as any).chrome = previousChrome;
  };
}

test("meeting id extraction accepts real Meet rooms and rejects non-room URLs", () => {
  assert.equal(getMeetingIdFromUrl("https://meet.google.com/abc-defg-hij"), "abc-defg-hij");
  assert.equal(getMeetingIdFromUrl("https://meet.google.com/new"), null);
  assert.equal(getMeetingIdFromUrl("https://example.com/abc-defg-hij"), null);
  assert.equal(getMeetingIdFromUrl(undefined), null);
});

test("meeting id extraction accepts real Zoom rooms and rejects non-room URLs", () => {
  assert.equal(getMeetingIdFromUrl("https://zoom.us/wc/123456789/join"), "123456789");
  assert.equal(getMeetingIdFromUrl("https://us02web.zoom.us/wc/98765432101/join"), "98765432101");
  assert.equal(getMeetingIdFromUrl("https://us04web.zoom.us/wc/123456789012/join"), "123456789012");
  assert.equal(getMeetingIdFromUrl("https://zoom.us/wc/join/123456789"), "123456789");
  assert.equal(getMeetingIdFromUrl("https://zoom.us/wc/12345/join"), null); // too short
  assert.equal(getMeetingIdFromUrl("https://zoom.us/wc/1234567890123/join"), null); // too long
  assert.equal(getMeetingIdFromUrl("https://zoom.us/wc/abc123xyz/join"), null); // non-numeric
  assert.equal(getMeetingIdFromUrl("https://zoom.us/wc/"), null);
});

test("meeting id extraction rejects non-meeting paths under meet.google.com", () => {
  assert.equal(getMeetingIdFromUrl("https://meet.google.com/landing"), null);
  assert.equal(getMeetingIdFromUrl("https://meet.google.com/calling"), null);
  assert.equal(getMeetingIdFromUrl("https://meet.google.com/support"), null);
  assert.equal(getMeetingIdFromUrl("https://meet.google.com/about"), null);
  assert.equal(getMeetingIdFromUrl("https://meet.google.com/"), null);
  // Uppercase IDs are not valid (Meet IDs are always lowercase)
  assert.equal(getMeetingIdFromUrl("https://meet.google.com/ABC-DEFG-HIJ"), null);
  // Too many / too few segments
  assert.equal(getMeetingIdFromUrl("https://meet.google.com/ab-cdef-ghi"), null);
  assert.equal(getMeetingIdFromUrl("https://meet.google.com/abcd-defg-hijk"), null);
});

test("manual Meet tab resolution prefers the active meeting tab", async () => {
  const cleanup = mockChromeTabs([
    {
      id: 1,
      url: "https://meet.google.com/old-rmxx-aaa",
      active: false,
      currentWindow: true,
    },
    {
      id: 2,
      url: "https://meet.google.com/liv-room-bbb",
      active: true,
      currentWindow: true,
    },
  ]);

  try {
    const selected = await resolveManualMeetTab();
    assert.equal(selected.tab.id, 2);
    assert.equal(selected.meetingId, "liv-room-bbb");
  } finally {
    cleanup();
  }
});

test("manual Meet tab resolution falls back when exactly one meeting tab is open", async () => {
  const cleanup = mockChromeTabs([
    {
      id: 3,
      url: "https://example.com/",
      active: true,
      currentWindow: true,
    },
    {
      id: 4,
      url: "https://meet.google.com/onl-room-ccc",
      active: false,
      currentWindow: true,
    },
  ]);

  try {
    const selected = await resolveManualMeetTab();
    assert.equal(selected.tab.id, 4);
    assert.equal(selected.meetingUrl, "https://meet.google.com/onl-room-ccc");
  } finally {
    cleanup();
  }
});

test("manual Meet tab resolution rejects ambiguous background meetings", async () => {
  const cleanup = mockChromeTabs([
    {
      id: 5,
      url: "https://example.com/",
      active: true,
      currentWindow: true,
    },
    {
      id: 6,
      url: "https://meet.google.com/fir-stro-ddd",
      active: false,
      currentWindow: true,
    },
    {
      id: 7,
      url: "https://meet.google.com/sec-ondo-eee",
      active: false,
      currentWindow: false,
    },
  ]);

  try {
    await assert.rejects(resolveManualMeetTab(), /Multiple Meet or Zoom tabs/);
  } finally {
    cleanup();
  }
});
