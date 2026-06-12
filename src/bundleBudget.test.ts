import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_BUNDLE_BUDGET_BYTES, evaluateBundleBudget, formatBytes } from "./bundleBudget.ts";

test("default budget is 1 MB", () => {
  assert.equal(DEFAULT_BUNDLE_BUDGET_BYTES, 1024 * 1024);
});

test("evaluateBundleBudget reports within-budget totals", () => {
  const result = evaluateBundleBudget(500_000, DEFAULT_BUNDLE_BUDGET_BYTES);
  assert.equal(result.withinBudget, true);
  assert.equal(result.overByBytes, 0);
  assert.ok(result.usedFraction > 0 && result.usedFraction < 1);
});

test("a total exactly at the budget is within budget", () => {
  const result = evaluateBundleBudget(1000, 1000);
  assert.equal(result.withinBudget, true);
  assert.equal(result.overByBytes, 0);
  assert.equal(result.usedFraction, 1);
});

test("evaluateBundleBudget flags totals over the budget with the overage", () => {
  const result = evaluateBundleBudget(1_500_000, 1_000_000);
  assert.equal(result.withinBudget, false);
  assert.equal(result.overByBytes, 500_000);
  assert.equal(result.usedFraction, 1.5);
});

test("evaluateBundleBudget treats invalid input defensively", () => {
  const result = evaluateBundleBudget(Number.NaN, DEFAULT_BUNDLE_BUDGET_BYTES);
  assert.equal(result.totalBytes, 0);
  assert.equal(result.withinBudget, true);
});

test("formatBytes renders human-readable sizes", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(1024 * 1024), "1 MB");
  assert.equal(formatBytes(1536), "1.5 KB");
});
