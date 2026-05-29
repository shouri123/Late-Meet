import test from "node:test";
import assert from "node:assert/strict";

import { startDashboardAudioCapture } from "./dashboardCapture.ts";
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

test("dashboard capture gets tab stream id before microphone permission", async () => {
  const calls: string[] = [];

  const result = await startDashboardAudioCapture({
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
      calls.push(`start-audio:${payload.streamId}`);
      return { success: true };
    },
  });

  assert.equal(result.meetingId, "abc-defg-hij");
  assert.deepEqual(calls, [
    "resolve-meet-tab",
    "get-stream-id:42",
    "request-microphone",
    "start-audio:stream-id",
  ]);
});

test("dashboard capture still starts tab audio when microphone permission fails", async () => {
  const calls: string[] = [];

  await startDashboardAudioCapture({
    resolveMeetTab: async () => meetSelection(),
    getMediaStreamId: async () => "stream-id",
    requestMicrophonePermission: async () => {
      calls.push("request-microphone");
      throw new Error("Permission denied");
    },
    startAudioCapture: async () => {
      calls.push("start-audio");
      return { success: true };
    },
  });

  assert.deepEqual(calls, ["request-microphone", "start-audio"]);
});

test("dashboard capture does not request microphone when tab capture is denied", async () => {
  const calls: string[] = [];

  await assert.rejects(
    startDashboardAudioCapture({
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
