import assert from "node:assert/strict";
import test from "node:test";

import {
  createSessionListItem,
  estimateStorageBytes,
  getSavedMeetingSession,
  getSavedSessionKey,
  isStorageQuotaError,
  SAVED_SESSIONS_LEGACY_KEY,
  StoredSession,
  upsertSessionIndex,
} from "./sessionStorage";

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
