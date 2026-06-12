/**
 * Bundle size budget checker (issue #669).
 *
 * Sums the compiled JS bundles in `dist/assets` and compares the total against a
 * budget (default 1 MB). Prints a report, writes a GitHub Actions step summary
 * when available, and raises a `::warning::` flag if the budget is exceeded.
 *
 * Non-blocking by default so it warns without failing PRs; set
 * `BUNDLE_BUDGET_ENFORCE=true` to make exceeding the budget fail the build.
 * The budget is overridable via `BUNDLE_BUDGET_BYTES`.
 *
 * Run with: `npm run size-check` (after `npm run build`).
 */
import { appendFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_BUNDLE_BUDGET_BYTES,
  evaluateBundleBudget,
  formatBytes,
} from "../src/bundleBudget.ts";

const distAssets = join(process.cwd(), "dist", "assets");

if (!existsSync(distAssets)) {
  console.error("[bundle-budget] dist/assets not found — run `npm run build` first.");
  process.exit(1);
}

const budgetBytes = Number(process.env.BUNDLE_BUDGET_BYTES) || DEFAULT_BUNDLE_BUDGET_BYTES;

const files = readdirSync(distAssets)
  .filter((name) => name.endsWith(".js"))
  .map((name) => ({ name, bytes: statSync(join(distAssets, name)).size }))
  .sort((a, b) => b.bytes - a.bytes);

const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
const result = evaluateBundleBudget(totalBytes, budgetBytes);
const percent = (result.usedFraction * 100).toFixed(1);

console.log("📦 Bundle JS budget check\n");
for (const file of files) {
  console.log(`  ${file.name.padEnd(36)} ${formatBytes(file.bytes)}`);
}
console.log(
  `\n  Total JS: ${formatBytes(totalBytes)} / ${formatBytes(budgetBytes)} budget (${percent}% used)`,
);

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  const status = result.withinBudget ? "✅ within budget" : "⚠️ over budget";
  appendFileSync(
    summaryPath,
    `### 📦 Bundle JS budget\n\n` +
      `**${formatBytes(totalBytes)}** / ${formatBytes(budgetBytes)} budget (${percent}% used) — ${status}\n`,
  );
}

if (!result.withinBudget) {
  const message = `Bundle JS is ${formatBytes(totalBytes)}, exceeding the ${formatBytes(
    budgetBytes,
  )} budget by ${formatBytes(result.overByBytes)}.`;
  console.log(`::warning::${message}`);

  if (process.env.BUNDLE_BUDGET_ENFORCE === "true") {
    process.exit(1);
  }
}
