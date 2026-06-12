import test from "node:test";
import assert from "node:assert/strict";

import { isMessageFromActiveMeeting } from "./activeMeetingMessages.ts";

const ACTIVE_MEETING = {
  targetTabId: 42,
  meetingId: "cat-room-dog",
};

test("accepts content-script messages from the active Meet tab", () => {
  assert.equal(
    isMessageFromActiveMeeting({
      ...ACTIVE_MEETING,
      senderTabId: 42,
      senderUrl: "https://meet.google.com/cat-room-dog",
    }),
    true,
  );
});

test("rejects messages from another Meet tab", () => {
  assert.equal(
    isMessageFromActiveMeeting({
      ...ACTIVE_MEETING,
      senderTabId: 99,
      senderUrl: "https://meet.google.com/owl-room-fox",
    }),
    false,
  );
});

test("rejects messages when the tab id matches but the Meet room does not", () => {
  assert.equal(
    isMessageFromActiveMeeting({
      ...ACTIVE_MEETING,
      senderTabId: 42,
      senderUrl: "https://meet.google.com/owl-room-fox",
    }),
    false,
  );
});

test("rejects messages without an owned target tab or valid Meet URL", () => {
  assert.equal(
    isMessageFromActiveMeeting({
      senderTabId: 42,
      senderUrl: "https://meet.google.com/cat-room-dog",
      targetTabId: null,
      meetingId: "cat-room-dog",
    }),
    false,
  );
  assert.equal(
    isMessageFromActiveMeeting({
      ...ACTIVE_MEETING,
      senderTabId: 42,
      senderUrl: "https://example.com/cat-room-dog",
    }),
    false,
  );
});

test("allows a valid sender URL while the active meeting id is unknown", () => {
  assert.equal(
    isMessageFromActiveMeeting({
      senderTabId: 42,
      senderUrl: "https://meet.google.com/cat-room-dog",
      targetTabId: 42,
      meetingId: "unknown",
    }),
    true,
  );
});
