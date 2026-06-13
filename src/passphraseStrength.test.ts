import test from "node:test";
import assert from "node:assert/strict";

import { MIN_PASSPHRASE_LENGTH, evaluatePassphraseStrength } from "./passphraseStrength.ts";

test("short passphrases fail the minimum and report 'Too short'", () => {
  const result = evaluatePassphraseStrength("ab12");
  assert.equal(result.meetsMinimum, false);
  assert.equal(result.score, 0);
  assert.equal(result.label, "Too short");
  assert.ok(result.suggestions.some((s) => s.includes(String(MIN_PASSPHRASE_LENGTH))));
});

test("a passphrase exactly at the minimum length is accepted", () => {
  const value = "a".repeat(MIN_PASSPHRASE_LENGTH);
  const result = evaluatePassphraseStrength(value);
  assert.equal(result.meetsMinimum, true);
  assert.ok(result.score >= 1);
});

test("low-variety minimum-length passphrases are weak but allowed", () => {
  const result = evaluatePassphraseStrength("password"); // 8 lowercase
  assert.equal(result.meetsMinimum, true);
  assert.equal(result.label, "Weak");
  assert.ok(result.suggestions.includes("Add a number"));
  assert.ok(result.suggestions.includes("Add a symbol"));
});

test("longer, varied passphrases score higher", () => {
  const fair = evaluatePassphraseStrength("Password1234"); // 12, 3 classes
  assert.ok(fair.score >= 3);

  const strong = evaluatePassphraseStrength("Password1234!@#$"); // 16, 4 classes
  assert.equal(strong.score, 4);
  assert.equal(strong.label, "Strong");
  assert.deepEqual(strong.suggestions, []);
});

test("evaluatePassphraseStrength tolerates non-string input", () => {
  const result = evaluatePassphraseStrength(undefined);
  assert.equal(result.meetsMinimum, false);
  assert.equal(result.score, 0);
});
