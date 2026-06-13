import test from "node:test";
import assert from "node:assert/strict";

import { isValidAccent, normalizeSettings } from "./settings.ts";

test("normalizeSettings fills defaults for empty/invalid input", () => {
  const result = normalizeSettings(undefined);
  assert.equal(result.theme, "system");
  assert.equal(result.accent, "210, 100%, 50%");
});

test("normalizeSettings keeps a valid theme and accent", () => {
  const result = normalizeSettings({ theme: "dark", accent: "145, 65%, 45%" });
  assert.equal(result.theme, "dark");
  assert.equal(result.accent, "145, 65%, 45%");
});

test("normalizeSettings rejects an invalid theme and accent, falling back to defaults", () => {
  const result = normalizeSettings({ theme: "neon", accent: "not-a-color" });
  assert.equal(result.theme, "system");
  assert.equal(result.accent, "210, 100%, 50%");
});

test("normalizeSettings preserves unrelated persisted keys", () => {
  const result = normalizeSettings({ vadThreshold: 0.05, aiModel: "gpt-4o" });
  assert.equal(result.vadThreshold, 0.05);
  assert.equal(result.aiModel, "gpt-4o");
  assert.equal(result.theme, "system");
});

test("isValidAccent accepts hex and HSL component formats", () => {
  assert.equal(isValidAccent("#fff"), true);
  assert.equal(isValidAccent("#1a2b3c"), true);
  assert.equal(isValidAccent("210, 100%, 50%"), true);
  assert.equal(isValidAccent("210 100% 50%"), true);
  assert.equal(isValidAccent("rgb(0,0,0)"), false);
  assert.equal(isValidAccent("400, 100%, 50%"), false);
});
