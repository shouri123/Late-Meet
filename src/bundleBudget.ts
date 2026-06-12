// Pure helpers for the bundle-size budget checker (issue #669). The script that
// reads `dist/` lives in `scripts/checkBundleSize.ts`; the math lives here so it
// can be unit-tested.

/** Default budget for the compiled JS bundles: 1 MB. */
export const DEFAULT_BUNDLE_BUDGET_BYTES = 1024 * 1024;

export interface BundleBudgetResult {
  totalBytes: number;
  budgetBytes: number;
  withinBudget: boolean;
  /** Bytes over the budget (0 when within). */
  overByBytes: number;
  /** Fraction of the budget used (1 = exactly at budget). */
  usedFraction: number;
}

/** Compares a measured bundle total against a byte budget. */
export function evaluateBundleBudget(totalBytes: number, budgetBytes: number): BundleBudgetResult {
  const safeTotal = Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : 0;
  const safeBudget = Number.isFinite(budgetBytes) && budgetBytes > 0 ? budgetBytes : 0;
  const withinBudget = safeBudget === 0 ? true : safeTotal <= safeBudget;

  return {
    totalBytes: safeTotal,
    budgetBytes: safeBudget,
    withinBudget,
    overByBytes: withinBudget ? 0 : safeTotal - safeBudget,
    usedFraction: safeBudget > 0 ? safeTotal / safeBudget : 0,
  };
}

/** Formats a byte count as a human-readable string (B/KB/MB/GB). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const rounded = unit === 0 ? value : Math.round(value * 100) / 100;
  return `${rounded} ${units[unit]}`;
}
