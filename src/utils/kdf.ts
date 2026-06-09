// Key-derivation parameters for credential encryption (issue #656).
//
// The PBKDF2 iteration count used to be a hardcoded 100 000. It is now stored
// alongside the salt so it can vary per install and be raised over time without
// breaking existing data: new installs use the OWASP-recommended count, while
// installs that only have a legacy salt (no stored iterations) keep decrypting
// with the original 100 000.

export const CURRENT_KDF_VERSION = 1;

/** OWASP 2023 recommendation for PBKDF2-HMAC-SHA256. Used for new installs. */
export const CURRENT_PBKDF2_ITERATIONS = 600_000;

/** Iteration count implied by installs that predate stored KDF parameters. */
export const LEGACY_PBKDF2_ITERATIONS = 100_000;

/**
 * Resolves the PBKDF2 iteration count to use from the stored value. A valid
 * positive number is honoured exactly (so data encrypted with it still
 * decrypts); anything missing or invalid falls back to the legacy count.
 */
export function resolveKdfIterations(storedIterations: unknown): number {
  if (
    typeof storedIterations === "number" &&
    Number.isFinite(storedIterations) &&
    storedIterations > 0
  ) {
    return Math.floor(storedIterations);
  }
  return LEGACY_PBKDF2_ITERATIONS;
}
