import test from "node:test";
import assert from "node:assert/strict";

import {
  SUMMARIZATION_INTERVAL_DEFAULT,
  SUMMARIZATION_INTERVAL_MIN,
  SUMMARIZATION_INTERVAL_MAX,
  VAD_THRESHOLD_DEFAULT,
  VAD_THRESHOLD_MIN,
  VAD_THRESHOLD_MAX,
  clampSummarizationInterval,
  clampVadThreshold,
  resolveSaveStatus,
  shouldSaveCredentials,
} from "./optionsSettings.ts";

// ─── clampSummarizationInterval ────────────────────────────────────────────────

test("summarization interval is clamped into the supported range", () => {
  assert.equal(clampSummarizationInterval(30), 30);
  assert.equal(clampSummarizationInterval(5), SUMMARIZATION_INTERVAL_MIN);
  assert.equal(clampSummarizationInterval(1000), SUMMARIZATION_INTERVAL_MAX);
});

test("summarization interval truncates fractions and defaults on non-finite input", () => {
  assert.equal(clampSummarizationInterval(45.9), 45);
  assert.equal(clampSummarizationInterval(Number.NaN), SUMMARIZATION_INTERVAL_DEFAULT);
  assert.equal(clampSummarizationInterval(Infinity), SUMMARIZATION_INTERVAL_DEFAULT);
});

// ─── clampVadThreshold ─────────────────────────────────────────────────────────

test("VAD threshold is clamped into the supported range", () => {
  assert.equal(clampVadThreshold(0.05), 0.05);
  assert.equal(clampVadThreshold(0), VAD_THRESHOLD_MIN);
  assert.equal(clampVadThreshold(2), VAD_THRESHOLD_MAX);
});

test("VAD threshold defaults on non-finite input", () => {
  assert.equal(clampVadThreshold(Number.NaN), VAD_THRESHOLD_DEFAULT);
  assert.equal(clampVadThreshold(-Infinity), VAD_THRESHOLD_DEFAULT);
});

// ─── resolveSaveStatus (issue #526 behavior) ───────────────────────────────────

test("locked save reports settings saved without touching credentials", () => {
  const status = resolveSaveStatus({ unlocked: false, credentialsSaved: false });
  assert.equal(status.tone, "info");
  assert.match(status.message, /Settings saved\. Unlock credential encryption/);
});

test("unlocked save with valid credentials reports full success", () => {
  const status = resolveSaveStatus({ unlocked: true, credentialsSaved: true });
  assert.equal(status.tone, "success");
  assert.equal(status.message, "Settings saved successfully!");
});

test("invalid key while unlocked still reports settings saved as an error", () => {
  const openai = resolveSaveStatus({
    unlocked: true,
    credentialsSaved: false,
    invalidKey: "openai",
  });
  assert.equal(openai.tone, "error");
  assert.match(openai.message, /OpenAI API key is invalid/);

  const eleven = resolveSaveStatus({
    unlocked: true,
    credentialsSaved: false,
    invalidKey: "elevenlabs",
  });
  assert.equal(eleven.tone, "error");
  assert.match(eleven.message, /ElevenLabs API key is invalid/);
});

test("invalidKey is ignored when locked (credentials were never attempted)", () => {
  const status = resolveSaveStatus({
    unlocked: false,
    credentialsSaved: false,
    invalidKey: "openai",
  });
  assert.equal(status.tone, "info");
});

test("unlocked without credential save (no validation error) returns generic message", () => {
  const status = resolveSaveStatus({
    unlocked: true,
    credentialsSaved: false,
    invalidKey: null,
  });
  assert.equal(status.tone, "info");
  assert.notMatch(status.message, /Unlock credential encryption/);
});

// ─── shouldSaveCredentials ─────────────────────────────────────────────────────

// ─── shouldSaveCredentials ─────────────────────────────────────────────────────

test("credentials are only saved while unlocked", () => {
  assert.equal(shouldSaveCredentials(true), true);
  assert.equal(shouldSaveCredentials(false), false);
});
