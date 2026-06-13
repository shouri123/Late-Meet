import assert from "node:assert/strict";
import test from "node:test";

import {
  createSessionListItem,
  getSavedSessionKey,
  SAVED_SESSION_INDEX_KEY,
  type StoredSession,
} from "../sessionStorage";
import { getStorageStats } from "./storageUtils";

type Store = Record<string, unknown>;

function makeSession(id: string, transcriptLength: number): StoredSession {
  return {
    id,
    savedAt: 1_700_000_000_000,
    isActive: false,
    meetingId: `meet-${id}`,
    meetingUrl: `https://meet.google.com/aaa-bbbb-${id.slice(0, 3).padEnd(3, "x")}`,
    startTime: 1_700_000_000_000,
    summary: `Summary ${id}`,
    summaryItems: [],
    topics: [],
    decisions: [],
    actionItems: [{ task: `Action ${id}` }],
    currentTopic: "",
    sentiment: "neutral",
    keyInsights: [],
    unresolvedDiscussions: [],
    contradictions: [],
    questionsRaised: [],
    participants: [],
    initialParticipants: [],
    lateJoiners: [],
    timeline: [{ event: "Meeting ended", timestamp: 1_700_000_000_000, elapsed: 60 }],
    transcript: [
      {
        speaker: "Audio",
        text: "x".repeat(transcriptLength),
        timestamp: 0,
      },
    ],
    audioActive: false,
    duration: 60,
  };
}

function storageBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value ?? null)).byteLength;
}

function setupChromeStorage(store: Store) {
  (globalThis as any).chrome = {
    storage: {
      local: {
        async get(keys: string | string[] | null) {
          if (keys === null) return { ...store };
          const keyList = Array.isArray(keys) ? keys : [keys];
          return keyList.reduce<Store>((result, key) => {
            result[key] = store[key];
            return result;
          }, {});
        },
        async set(values: Store) {
          Object.assign(store, values);
        },
        async remove(keys: string | string[]) {
          const keyList = Array.isArray(keys) ? keys : [keys];
          keyList.forEach((key) => delete store[key]);
        },
        getBytesInUse(keys: string | string[] | null, callback: (bytes: number) => void) {
          const keyList = keys === null ? Object.keys(store) : Array.isArray(keys) ? keys : [keys];
          const bytes = keyList.reduce((sum, key) => sum + storageBytes(store[key]), 0);
          callback(bytes);
        },
      },
    },
  };
}

test("getStorageStats measures full indexed session payloads, not lightweight index items", async () => {
  const smallSession = makeSession("small", 20);
  const largeSession = makeSession("large", 5_000);
  const store: Store = {
    [SAVED_SESSION_INDEX_KEY]: [
      createSessionListItem(smallSession),
      createSessionListItem(largeSession),
    ],
    [getSavedSessionKey(smallSession.id)]: smallSession,
    [getSavedSessionKey(largeSession.id)]: largeSession,
  };
  setupChromeStorage(store);

  const stats = await getStorageStats();

  assert.equal(stats.meetingCount, 2);
  assert.equal(stats.largestMeetings[0].id, largeSession.id);
  assert.ok(stats.transcriptBytes >= storageBytes(largeSession.transcript));
  assert.ok(stats.largestMeetings[0].transcriptBytes >= storageBytes(largeSession.transcript));
  assert.ok(stats.largestMeetings[0].totalBytes > stats.largestMeetings[1].totalBytes);
});
