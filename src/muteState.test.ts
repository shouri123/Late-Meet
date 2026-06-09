import test from "node:test";
import assert from "node:assert/strict";

import { MUTE_BUTTON_SELECTORS, parseMuteState } from "./muteState.ts";

// ─── parseMuteState: data-is-muted attribute (preferred) ───────────────────────

test("parseMuteState reads the data-is-muted attribute", () => {
  assert.equal(parseMuteState({ dataIsMuted: "true" }), true);
  assert.equal(parseMuteState({ dataIsMuted: "false" }), false);
  assert.equal(parseMuteState({ dataIsMuted: "TRUE" }), true);
  assert.equal(parseMuteState({ dataIsMuted: " false " }), false);
});

test("parseMuteState prefers data-is-muted over a conflicting aria-label", () => {
  assert.equal(parseMuteState({ dataIsMuted: "true", ariaLabel: "Turn off microphone" }), true);
});

// ─── parseMuteState: aria-label fallback ───────────────────────────────────────

test("parseMuteState infers muted from an 'unmute'/'turn on' aria-label", () => {
  assert.equal(parseMuteState({ ariaLabel: "Turn on microphone (⌘ + d)" }), true);
  assert.equal(parseMuteState({ ariaLabel: "Unmute" }), true);
});

test("parseMuteState infers unmuted from a 'turn off'/'mute' aria-label", () => {
  assert.equal(parseMuteState({ ariaLabel: "Turn off microphone (⌘ + d)" }), false);
  assert.equal(parseMuteState({ ariaLabel: "Mute" }), false);
});

test("parseMuteState does not mistake 'unmute' for 'mute'", () => {
  // "mute" is a substring of "unmute"; unmute must win (currently muted).
  assert.equal(parseMuteState({ ariaLabel: "Unmute microphone" }), true);
});

// ─── parseMuteState: undeterminable input ──────────────────────────────────────

test("parseMuteState returns null when it cannot determine state", () => {
  assert.equal(parseMuteState({}), null);
  assert.equal(parseMuteState({ dataIsMuted: "maybe" }), null);
  assert.equal(parseMuteState({ ariaLabel: "Open chat" }), null);
  assert.equal(parseMuteState({ dataIsMuted: null, ariaLabel: null }), null);
});

// ─── selectors ─────────────────────────────────────────────────────────────────

test("MUTE_BUTTON_SELECTORS prioritizes the data-is-muted attribute", () => {
  assert.equal(MUTE_BUTTON_SELECTORS[0], "[data-is-muted]");
  assert.ok(MUTE_BUTTON_SELECTORS.length > 1);
});
