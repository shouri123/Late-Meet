import assert from "node:assert/strict";
import test from "node:test";

import {
  createSessionListItem,
  deleteAllSavedMeetingSessions,
  deleteMultipleSavedMeetingSessions,
  deleteSavedMeetingSession,
  estimateStorageBytes,
  getSavedMeetingSession,
  getSavedSessionKey,
  isStorageQuotaError,
  SAVED_SESSION_INDEX_KEY,
  SAVED_SESSIONS_LEGACY_KEY,
  StoredSession,
  upsertSessionIndex,
} from "./sessionStorage";

/**
 * Minimal in-memory chrome.storage.local stand-in that records the keys written
 * via `set` and removed via `remove`, so tests can assert exactly which keys a
 * delete touched.
 */
function makeMemoryStorage(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial };
  // Loosely-typed signatures (...args: unknown[]) so the mock is assignable to
  // chrome.storage.StorageArea's overloaded get/set/remove without reimplementing
  // every overload.
  const get = async (...args: unknown[]) => {
    const keys = args[0] as string | string[];
    const list = Array.isArray(keys) ? keys : [keys];
    const out: Record<string, unknown> = {};
    for (const key of list) {
      if (key in store) out[key] = store[key];
    }
    return out;
  };
  const set = async (...args: unknown[]) => {
    Object.assign(store, args[0] as Record<string, unknown>);
  };
  const remove = async (...args: unknown[]) => {
    const keys = args[0] as string | string[];
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) delete store[key];
  };
  return { store, get, set, remove };
}

function makeSession(id: string, savedAt: number): StoredSession {
  return {
    id,
    savedAt,
    isActive: false,
    meetingId: `meet-${id}`,
    meetingUrl: null,
    startTime: savedAt,
    summary: `Summary ${id}`,
    summaryItems: [{ text: `Summary item ${id}`, timestamp: "00:10" }],
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
    timeline: [{ event: "Meeting ended", timestamp: savedAt, elapsed: 10 }],
    transcript: [{ speaker: "Audio", text: "A long transcript entry", timestamp: savedAt }],
    audioActive: false,
    duration: 10,
  };
}

test("saved session keys are namespaced by id", () => {
  assert.equal(getSavedSessionKey("abc-123"), "savedSession:abc-123");
});

test("session list items omit large transcript and timeline payloads", () => {
  const session = makeSession("one", 100);
  const listItem = createSessionListItem(session);

  assert.equal(listItem.id, session.id);
  assert.equal(listItem.summary, session.summary);
  assert.deepEqual(listItem.transcript, []);
  assert.deepEqual(listItem.timeline, []);
});

test("upsertSessionIndex places newest sessions first and deduplicates ids", () => {
  const first = makeSession("first", 100);
  const second = makeSession("second", 200);
  const updatedFirst = { ...first, savedAt: 300, summary: "Updated summary" };

  const index = upsertSessionIndex(upsertSessionIndex([first], second), updatedFirst);

  assert.deepEqual(
    index.map((session) => session.id),
    ["first", "second"],
  );
  assert.equal(index[0].summary, "Updated summary");
});

test("upsertSessionIndex enforces max session count", () => {
  const sessions = Array.from({ length: 5 }, (_, index) => makeSession(`session-${index}`, index));
  const next = upsertSessionIndex(sessions, makeSession("new", 10), 3);

  assert.deepEqual(
    next.map((session) => session.id),
    ["new", "session-0", "session-1"],
  );
});

test("quota errors are detected from Chrome storage messages", () => {
  assert.equal(isStorageQuotaError(new Error("QUOTA_BYTES quota exceeded")), true);
  assert.equal(isStorageQuotaError(new Error("Network request failed")), false);
});

test("storage byte estimates increase with payload size", () => {
  assert.ok(estimateStorageBytes({ text: "large payload" }) > estimateStorageBytes({ text: "" }));
});

test("getSavedMeetingSession loads the full indexed session payload", async () => {
  const session = makeSession("full", 100);
  const storage = {
    get: async () => ({
      [getSavedSessionKey(session.id)]: session,
      [SAVED_SESSIONS_LEGACY_KEY]: [],
    }),
    set: async () => {},
    remove: async () => {},
  };

  const result = await getSavedMeetingSession(storage, session.id);

  assert.equal(result?.id, session.id);
  assert.deepEqual(result?.transcript, session.transcript);
  assert.deepEqual(result?.timeline, session.timeline);
});

test("getSavedMeetingSession normalizes string savedAt values from older storage", async () => {
  const session = {
    ...makeSession("legacy-string-date", 100),
    savedAt: "2025-05-13T12:00:00Z",
  };
  const storage = {
    get: async () => ({
      [getSavedSessionKey(session.id)]: session,
      [SAVED_SESSIONS_LEGACY_KEY]: [],
    }),
    set: async () => {},
    remove: async () => {},
  };

  const result = await getSavedMeetingSession(storage, session.id);

  assert.equal(result?.savedAt, Date.parse("2025-05-13T12:00:00Z"));
});

test("getSavedMeetingSession falls back to legacy saved sessions", async () => {
  const session = makeSession("legacy", 200);
  const storage = {
    get: async () => ({
      [SAVED_SESSIONS_LEGACY_KEY]: [session],
    }),
    set: async () => {},
    remove: async () => {},
  };

  const result = await getSavedMeetingSession(storage, session.id);

  assert.equal(result?.id, session.id);
  assert.deepEqual(result?.transcript, session.transcript);
  assert.deepEqual(result?.timeline, session.timeline);
});

// ─── delete does not resurrect the migrated legacy key (#677) ───────────────────

test("deleteSavedMeetingSession does not recreate the legacy key when it is absent", async () => {
  const session = makeSession("a", 100);
  const storage = makeMemoryStorage({
    [SAVED_SESSION_INDEX_KEY]: [createSessionListItem(session)],
    [getSavedSessionKey(session.id)]: session,
  });

  await deleteSavedMeetingSession(storage, session.id);

  assert.ok(
    !(SAVED_SESSIONS_LEGACY_KEY in storage.store),
    "legacy savedSessions key should stay absent after deletion",
  );
  assert.deepEqual(storage.store[SAVED_SESSION_INDEX_KEY], []);
  assert.ok(!(getSavedSessionKey(session.id) in storage.store));
});

test("deleteSavedMeetingSession filters the legacy key when it is present", async () => {
  const keep = makeSession("keep", 100);
  const drop = makeSession("drop", 200);
  const storage = makeMemoryStorage({
    [SAVED_SESSION_INDEX_KEY]: [createSessionListItem(keep), createSessionListItem(drop)],
    [SAVED_SESSIONS_LEGACY_KEY]: [keep, drop],
  });

  await deleteSavedMeetingSession(storage, drop.id);

  const legacy = storage.store[SAVED_SESSIONS_LEGACY_KEY] as StoredSession[];
  assert.deepEqual(
    legacy.map((s) => s.id),
    ["keep"],
  );
});

test("deleteMultipleSavedMeetingSessions does not recreate the legacy key when absent", async () => {
  const a = makeSession("a", 100);
  const b = makeSession("b", 200);
  const storage = makeMemoryStorage({
    [SAVED_SESSION_INDEX_KEY]: [createSessionListItem(a), createSessionListItem(b)],
    [getSavedSessionKey(a.id)]: a,
    [getSavedSessionKey(b.id)]: b,
  });

  await deleteMultipleSavedMeetingSessions(storage, [a.id, b.id]);

  assert.ok(!(SAVED_SESSIONS_LEGACY_KEY in storage.store));
  assert.deepEqual(storage.store[SAVED_SESSION_INDEX_KEY], []);
});

test("deleteAllSavedMeetingSessions removes the legacy key instead of resurrecting it", async () => {
  const a = makeSession("a", 100);
  const storage = makeMemoryStorage({
    [SAVED_SESSION_INDEX_KEY]: [createSessionListItem(a)],
    [SAVED_SESSIONS_LEGACY_KEY]: [a],
    [getSavedSessionKey(a.id)]: a,
  });

  await deleteAllSavedMeetingSessions(storage);

  assert.ok(!(SAVED_SESSIONS_LEGACY_KEY in storage.store), "legacy key should be removed, not []");
  assert.deepEqual(storage.store[SAVED_SESSION_INDEX_KEY], []);
});
