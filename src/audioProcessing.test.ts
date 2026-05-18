import test from "node:test";
import assert from "node:assert/strict";

import { VoiceActivityTracker, audioFileExtensionForMimeType } from "./audioProcessing.ts";

test("voice activity observed between recorder flushes is enough to send the chunk", () => {
  const tracker = new VoiceActivityTracker({ rmsThreshold: 0.012 });

  tracker.observe(0.001);
  tracker.observe(0.02);
  tracker.observe(0.001);

  assert.equal(tracker.consumeShouldFlush(), true);
});

test("silent windows do not trigger transcription requests", () => {
  const tracker = new VoiceActivityTracker({ rmsThreshold: 0.012 });

  tracker.observe(0.001);
  tracker.observe(0.002);

  assert.equal(tracker.consumeShouldFlush(), false);
});

test("recorder file extension keeps the container compatible with STT APIs", () => {
  assert.equal(audioFileExtensionForMimeType("audio/webm;codecs=opus"), "webm");
  assert.equal(audioFileExtensionForMimeType("audio/ogg;codecs=opus"), "ogg");
  assert.equal(audioFileExtensionForMimeType("audio/wav"), "wav");
});
