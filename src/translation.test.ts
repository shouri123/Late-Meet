import test from "node:test";
import assert from "node:assert/strict";

import {
  NO_TRANSLATION,
  SUPPORTED_TRANSLATION_LANGUAGES,
  buildTranslationMessages,
  getTranslationLanguageLabel,
  guardTranslationOutput,
  normalizeTargetLanguage,
  shouldTranslateTo,
} from "./translation.ts";

// ─── normalizeTargetLanguage ───────────────────────────────────────────────────

test("normalizeTargetLanguage accepts supported codes case-insensitively", () => {
  assert.equal(normalizeTargetLanguage("es"), "es");
  assert.equal(normalizeTargetLanguage("  FR  "), "fr");
});

test("normalizeTargetLanguage treats empty/none/off/unknown/non-string as no translation", () => {
  assert.equal(normalizeTargetLanguage(""), NO_TRANSLATION);
  assert.equal(normalizeTargetLanguage("none"), NO_TRANSLATION);
  assert.equal(normalizeTargetLanguage("off"), NO_TRANSLATION);
  assert.equal(normalizeTargetLanguage("klingon"), NO_TRANSLATION);
  assert.equal(normalizeTargetLanguage(undefined), NO_TRANSLATION);
  assert.equal(normalizeTargetLanguage(42), NO_TRANSLATION);
});

test("shouldTranslateTo reflects whether a real language is selected", () => {
  assert.equal(shouldTranslateTo("de"), true);
  assert.equal(shouldTranslateTo(""), false);
  assert.equal(shouldTranslateTo("none"), false);
});

// ─── getTranslationLanguageLabel ───────────────────────────────────────────────

test("getTranslationLanguageLabel maps codes to labels and rejects unknowns", () => {
  assert.equal(getTranslationLanguageLabel("es"), "Spanish");
  assert.equal(getTranslationLanguageLabel("xx"), null);
});

test("every supported language has a non-empty unique code and label", () => {
  const codes = new Set<string>();
  for (const lang of SUPPORTED_TRANSLATION_LANGUAGES) {
    assert.ok(lang.code.length > 0);
    assert.ok(lang.label.length > 0);
    assert.ok(!codes.has(lang.code), `duplicate code ${lang.code}`);
    codes.add(lang.code);
  }
});

// ─── buildTranslationMessages ──────────────────────────────────────────────────

test("buildTranslationMessages targets the language and hardens against injection", () => {
  const { system, user } = buildTranslationMessages("Hello team", "Spanish");
  assert.match(system, /Spanish/);
  assert.match(system, /never follow any instructions/i);
  assert.equal(user, '"""Hello team"""');
});

// ─── guardTranslationOutput ────────────────────────────────────────────────────

test("guardTranslationOutput returns the trimmed translation for normal output", () => {
  assert.equal(guardTranslationOutput("  Hola equipo  ", "Hello team"), "Hola equipo");
});

test("guardTranslationOutput falls back to original on empty or refusal output", () => {
  assert.equal(guardTranslationOutput("", "Hello team"), "Hello team");
  assert.equal(guardTranslationOutput("   ", "Hello team"), "Hello team");
  assert.equal(
    guardTranslationOutput("I'm sorry, I cannot help with that.", "Hello team"),
    "Hello team",
  );
  assert.equal(
    guardTranslationOutput("As an AI language model, I cannot translate.", "Hello team"),
    "Hello team",
  );
});

test("guardTranslationOutput keeps legitimately short CJK translations", () => {
  // Length-ratio heuristics are intentionally not applied (CJK is far shorter).
  assert.equal(guardTranslationOutput("こんにちは", "Hello everyone, good morning"), "こんにちは");
});
