/**
 * Name Normalization Utilities
 *
 * Handles Unicode normalization and locale-aware comparison
 * for participant names in international meetings.
 */

/**
 * Normalize a participant name for consistent comparison.
 * Handles Unicode characters from all scripts.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFC") // Canonical Unicode form
    .trim()
    .toLowerCase();
}

/**
 * Compare two names accounting for Unicode and locale differences.
 * Returns true if names are equivalent.
 */
export function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na.localeCompare(nb, undefined, { sensitivity: "base" }) === 0;
}

/**
 * Find a participant by name in a list, handling Unicode.
 */
export function findParticipant(name: string, participants: string[]): string | undefined {
  const normalized = normalizeName(name);
  return participants.find(
    (p) => normalizeName(p).localeCompare(normalized, undefined, { sensitivity: "base" }) === 0,
  );
}

/**
 * Sanitize a display name for safe rendering (prevent XSS).
 */
export function sanitizeDisplayName(name: string): string {
  return name
    .normalize("NFC")
    .slice(0, 100) // Truncate before encoding to avoid splitting entities
    .replace(
      /[<>&"']/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&`#39`;",
        })[c] ?? c,
    );
}
