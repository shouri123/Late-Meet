import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TRANSCRIPT_SPEAKER,
  normalizeActiveSpeakerName,
  resolveTranscriptSpeaker,
} from "./speakerAttribution.ts";

test("active speaker names are normalized with participant-name filtering", () => {
  assert.equal(normalizeActiveSpeakerName("Ada Lovelace"), "Ada Lovelace");
  assert.equal(normalizeActiveSpeakerName("Ada Lovelace Mute More options"), "Ada Lovelace");
});

test("invalid active speaker payloads are rejected", () => {
  assert.equal(normalizeActiveSpeakerName(undefined), null);
  assert.equal(normalizeActiveSpeakerName(""), null);
  assert.equal(normalizeActiveSpeakerName("Mute"), null);
  assert.equal(normalizeActiveSpeakerName("Ada…"), null);
});

test("transcript speaker falls back to the default audio label", () => {
  assert.equal(resolveTranscriptSpeaker("Grace Hopper"), "Grace Hopper");
  assert.equal(resolveTranscriptSpeaker(null), DEFAULT_TRANSCRIPT_SPEAKER);
  assert.equal(resolveTranscriptSpeaker("Pin"), DEFAULT_TRANSCRIPT_SPEAKER);
});
