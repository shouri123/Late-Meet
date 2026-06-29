import test from "node:test";
import assert from "node:assert/strict";

import {
  CURRENT_PBKDF2_ITERATIONS,
  LEGACY_PBKDF2_ITERATIONS,
  resolveKdfIterations,
} from "./kdf.ts";

test("new-install iteration count meets the OWASP 2023 PBKDF2-SHA256 recommendation", () => {
  assert.ok(CURRENT_PBKDF2_ITERATIONS >= 600_000);
  assert.ok(CURRENT_PBKDF2_ITERATIONS > LEGACY_PBKDF2_ITERATIONS);
});

test("resolveKdfIterations honours a valid stored count exactly", () => {
  assert.equal(resolveKdfIterations(600_000), 600_000);
  assert.equal(resolveKdfIterations(100_000), 100_000);
  assert.equal(resolveKdfIterations(250_000), 250_000);
});

test("resolveKdfIterations truncates fractional counts", () => {
  assert.equal(resolveKdfIterations(310_000.7), 310_000);
});

test("resolveKdfIterations falls back to the legacy count for missing/invalid values", () => {
  assert.equal(resolveKdfIterations(undefined), LEGACY_PBKDF2_ITERATIONS);
  assert.equal(resolveKdfIterations(null), LEGACY_PBKDF2_ITERATIONS);
  assert.equal(resolveKdfIterations("600000"), LEGACY_PBKDF2_ITERATIONS);
  assert.equal(resolveKdfIterations(0), LEGACY_PBKDF2_ITERATIONS);
  assert.equal(resolveKdfIterations(-5), LEGACY_PBKDF2_ITERATIONS);
  assert.equal(resolveKdfIterations(Number.NaN), LEGACY_PBKDF2_ITERATIONS);
});
