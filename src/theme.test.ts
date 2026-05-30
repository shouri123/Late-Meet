import { describe, it } from "node:test";
import assert from "node:assert";
import { isValidAccent } from "./theme";

describe("isValidAccent", () => {
  // Valid hex colors
  it("should accept valid 3-digit hex colors", () => {
    assert.strictEqual(isValidAccent("#ABC"), true);
    assert.strictEqual(isValidAccent("#fff"), true);
    assert.strictEqual(isValidAccent("#FFF"), true);
  });

  it("should accept valid 6-digit hex colors", () => {
    assert.strictEqual(isValidAccent("#ABCDEF"), true);
    assert.strictEqual(isValidAccent("#ffffff"), true);
    assert.strictEqual(isValidAccent("#123456"), true);
  });

  // Valid HSL formats
  it("should accept HSL format with commas and spaces", () => {
    assert.strictEqual(isValidAccent("210, 100%, 50%"), true);
    assert.strictEqual(isValidAccent("0, 0%, 0%"), true);
    assert.strictEqual(isValidAccent("360, 100%, 100%"), true);
  });

  it("should accept HSL format with spaces only", () => {
    assert.strictEqual(isValidAccent("210 100% 50%"), true);
    assert.strictEqual(isValidAccent("0 0% 0%"), true);
  });

  // Invalid formats
  it("should reject invalid hex colors", () => {
    assert.strictEqual(isValidAccent("#GG"), false);
    assert.strictEqual(isValidAccent("#12"), false);
    assert.strictEqual(isValidAccent("#1234567"), false);
  });

  it("should reject malformed HSL", () => {
    assert.strictEqual(isValidAccent("210, 100, 50"), false);
    assert.strictEqual(isValidAccent("210, 100%, 50"), false);
    assert.strictEqual(isValidAccent("abc, def%, ghi%"), false);
  });

  // Whitespace handling
  it("should trim whitespace before validation", () => {
    assert.strictEqual(isValidAccent("  #FFF  "), true);
    assert.strictEqual(isValidAccent("  210, 100%, 50%  "), true);
  });
});
