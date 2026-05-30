import test from "node:test";
import assert from "node:assert/strict";

import { startPopupAudioCapture } from "./popupCapture.ts";
import { MeetTabSelection } from "./meetingTabs.ts";

function meetSelection(): MeetTabSelection {
  return {
    tab: {
      id: 42,
      url: "https://meet.google.com/abc-defg-hij",
    } as chrome.tabs.Tab,
    meetingId: "abc-defg-hij",
    meetingUrl: "https://meet.google.com/abc-defg-hij",
  };
}

test("popup capture gets tab stream id before requesting microphone permission", async () => {
  const calls: string[] = [];

  const result = await startPopupAudioCapture({
    resolveMeetTab: async () => {
      calls.push("resolve-meet-tab");
      return meetSelection();
    },
    getMediaStreamId: async (tabId) => {
      calls.push(`get-stream-id:${tabId}`);
      return "stream-id";
    },
    requestMicrophonePermission: async () => {
      calls.push("request-microphone");
      return true;
    },
    startAudioCapture: async (payload) => {
      calls.push(`start-audio:mic-${payload.includeMicrophone}`);
      return { success: true };
    },
  });

  assert.equal(result.meetingId, "abc-defg-hij");
  assert.equal(result.microphoneEnabled, true);
  assert.deepEqual(calls, [
    "resolve-meet-tab",
    "get-stream-id:42",
    "request-microphone",
    "start-audio:mic-true",
  ]);
});

test("popup capture starts tab-only audio when microphone permission is denied", async () => {
  const payloads: boolean[] = [];

  const result = await startPopupAudioCapture({
    resolveMeetTab: async () => meetSelection(),
    getMediaStreamId: async () => "stream-id",
    requestMicrophonePermission: async () => false,
    startAudioCapture: async (payload) => {
      payloads.push(payload.includeMicrophone);
      return { success: true };
    },
  });

  assert.equal(result.microphoneEnabled, false);
  assert.deepEqual(payloads, [false]);
});

test("popup capture treats microphone permission errors as tab-only fallback", async () => {
  const payloads: boolean[] = [];

  await startPopupAudioCapture({
    resolveMeetTab: async () => meetSelection(),
    getMediaStreamId: async () => "stream-id",
    requestMicrophonePermission: async () => {
      throw new Error("Permission prompt dismissed");
    },
    startAudioCapture: async (payload) => {
      payloads.push(payload.includeMicrophone);
      return { success: true };
    },
  });

  assert.deepEqual(payloads, [false]);
});

test("popup capture does not request microphone when tab capture is denied", async () => {
  const calls: string[] = [];

  await assert.rejects(
    startPopupAudioCapture({
      resolveMeetTab: async () => meetSelection(),
      getMediaStreamId: async () => "",
      requestMicrophonePermission: async () => {
        calls.push("request-microphone");
        return true;
      },
      startAudioCapture: async () => {
        calls.push("start-audio");
        return { success: true };
      },
    }),
    /Capture permission denied/,
  );

  assert.deepEqual(calls, []);
});
