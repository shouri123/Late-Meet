// Vault passphrase strength rules and feedback (issue #655). Pure logic so it can
// be unit-tested and reused by the options page / onboarding without DOM access.

/** Minimum length required to create (set up) a credential-vault passphrase. */
export const MIN_PASSPHRASE_LENGTH = 8;

export type StrengthLabel = "Too short" | "Weak" | "Fair" | "Good" | "Strong";

export interface PassphraseStrength {
  /** Whether the passphrase satisfies the minimum length to set up a vault. */
  meetsMinimum: boolean;
  /** 0 (too short) … 4 (strong). */
  score: number;
  label: StrengthLabel;
  /** Human-readable tips for strengthening the passphrase. */
  suggestions: string[];
}

const LABELS: StrengthLabel[] = ["Too short", "Weak", "Fair", "Good", "Strong"];

/**
 * Evaluates a vault passphrase: enforces a minimum length and scores strength
 * from length tiers plus character-class variety (lower, upper, digit, symbol).
 */
export function evaluatePassphraseStrength(passphrase: unknown): PassphraseStrength {
  const value = typeof passphrase === "string" ? passphrase : "";
  const length = value.length;

  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  const suggestions: string[] = [];
  if (length < MIN_PASSPHRASE_LENGTH) {
    suggestions.push(`Use at least ${MIN_PASSPHRASE_LENGTH} characters`);
  }
  if (!hasLower || !hasUpper) suggestions.push("Mix upper- and lower-case letters");
  if (!hasDigit) suggestions.push("Add a number");
  if (!hasSymbol) suggestions.push("Add a symbol");

  if (length < MIN_PASSPHRASE_LENGTH) {
    return { meetsMinimum: false, score: 0, label: LABELS[0], suggestions };
  }

  let score = 1;
  if (length >= 12) score += 1;
  if (length >= 16) score += 1;
  if (variety >= 3) score += 1;
  score = Math.min(score, 4);

  return { meetsMinimum: true, score, label: LABELS[score], suggestions };
}
