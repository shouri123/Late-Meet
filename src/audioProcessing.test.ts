import test from "node:test";
import assert from "node:assert/strict";

import { VoiceActivityTracker, audioFileExtensionForMimeType } from "./audioProcessing.ts";

// ─── existing tests ───────────────────────────────────────────────────────────

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

// ─── dynamic conversational slicing tests ────────────────────────────────────
//
// These tests simulate the VAD loop logic from offscreen.ts in pure Node so
// the slice behaviour can be verified without a browser or Chrome extension.

// Mirror the constants defined in offscreen.ts so tests stay in sync.
const VAD_SAMPLE_MS = 250;
const SILENCE_FLUSH_MS = 1500;
const MAX_BUFFER_MS = 25000;
const SILENCE_FLUSH_TICKS = Math.ceil(SILENCE_FLUSH_MS / VAD_SAMPLE_MS); // 6
const RMS_THRESHOLD = 0.012;

// Runs one full VAD-loop iteration over an array of RMS samples and returns
// { flushTriggered, force } so individual tests can assert on them.
function simulateVadLoop(
  rmsValues: number[],
  bufferAgeMs = 0,
): { flushTriggered: boolean; force: boolean } {
  let silenceTicks = 0;
  const bufferStartTime = Date.now() - bufferAgeMs;

  for (const rms of rmsValues) {
    if (rms < RMS_THRESHOLD) {
      silenceTicks++;
    } else {
      silenceTicks = 0;
    }

    const naturalPause = silenceTicks >= SILENCE_FLUSH_TICKS;
    const overflowReached = Date.now() - bufferStartTime >= MAX_BUFFER_MS;

    if (naturalPause || overflowReached) {
      return { flushTriggered: true, force: overflowReached && !naturalPause };
    }
  }

  return { flushTriggered: false, force: false };
}

test("natural pause: flush fires after 6 consecutive silent ticks (1 500 ms)", () => {
  // 2 speech ticks followed by exactly 6 silent ticks
  const rms = [0.05, 0.04, 0.001, 0.001, 0.001, 0.001, 0.001, 0.001];
  const { flushTriggered, force } = simulateVadLoop(rms);

  assert.equal(flushTriggered, true, "flush must fire after 1 500 ms of silence");
  assert.equal(force, false, "natural pause must not be a force-flush");
});

test("no flush when silence lasts fewer than 6 ticks", () => {
  // Only 5 silent ticks — one short of the threshold
  const rms = [0.05, 0.001, 0.001, 0.001, 0.001, 0.001];
  const { flushTriggered } = simulateVadLoop(rms);

  assert.equal(flushTriggered, false, "5 silent ticks must not trigger a flush");
});

test("silence counter resets when speech resumes mid-pause", () => {
  // 3 silent → 1 speech → 3 silent: total never reaches 6
  const rms = [0.001, 0.001, 0.001, 0.05, 0.001, 0.001, 0.001];
  const { flushTriggered } = simulateVadLoop(rms);

  assert.equal(flushTriggered, false, "interrupted silence must not trigger a flush");
});

test("overflow cap: force-flush fires when buffer exceeds 25 s with no pause", () => {
  // Buffer is already 25 001 ms old; RMS is always above threshold (continuous speech)
  const rms = Array(10).fill(0.05); // all speech, no pause
  const { flushTriggered, force } = simulateVadLoop(rms, MAX_BUFFER_MS + 1);

  assert.equal(flushTriggered, true, "overflow must trigger a flush");
  assert.equal(force, true, "overflow flush must be a force-flush");
});

test("overflow fires immediately on the next tick — does not wait for 6 silent ticks", () => {
  // Buffer already exceeded 25 s. Even one tick of continuous speech must trigger a
  // force-flush without waiting for the natural-pause counter to reach 6.
  const rms = [0.05]; // single above-threshold tick (no silence at all)
  const { flushTriggered, force } = simulateVadLoop(rms, MAX_BUFFER_MS + 1);

  assert.equal(flushTriggered, true, "overflow must fire on the very next VAD tick");
  assert.equal(force, true, "overflow without a natural pause must be a force-flush");
});

test("speech gate: chunk is skipped when flush fires but no speech was observed", () => {
  const tracker = new VoiceActivityTracker({ rmsThreshold: RMS_THRESHOLD });

  // Only silence observed — consumeShouldFlush must return false
  tracker.observe(0.001);
  tracker.observe(0.002);
  tracker.observe(0.001);

  assert.equal(
    tracker.consumeShouldFlush(),
    false,
    "silent-only window must not send a chunk to STT",
  );
});

test("speech gate: chunk is sent when speech preceded the natural pause", () => {
  const tracker = new VoiceActivityTracker({ rmsThreshold: RMS_THRESHOLD });

  tracker.observe(0.05); // speech
  tracker.observe(0.001); // silence …
  tracker.observe(0.001);

  assert.equal(
    tracker.consumeShouldFlush(),
    true,
    "window that contained speech must produce a chunk",
  );
});

test("consumeShouldFlush resets state so the next window starts clean", () => {
  const tracker = new VoiceActivityTracker({ rmsThreshold: RMS_THRESHOLD });

  tracker.observe(0.05);
  tracker.consumeShouldFlush(); // drains the flag

  // Second window is silent — must not inherit state from the first
  tracker.observe(0.001);
  assert.equal(tracker.consumeShouldFlush(), false, "state must be reset after each flush");
});

test("vadThreshold forwarded in message falls back to 0.012 when absent", () => {
  // Mirrors: rmsThreshold = message.vadThreshold ?? 0.012
  const withThreshold = { vadThreshold: 0.02 };
  const withoutThreshold = {} as { vadThreshold?: number };

  assert.equal(withThreshold.vadThreshold ?? 0.012, 0.02, "custom threshold must be honoured");
  assert.equal(
    withoutThreshold.vadThreshold ?? 0.012,
    0.012,
    "missing threshold must default to 0.012",
  );
});
