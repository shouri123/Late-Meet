/**
 * @fileoverview Name Normalization Utilities
 *
 * Handles Unicode normalization and locale-aware comparison
 * for participant names in international meetings.
 *
 * All public functions accept UTF-16 strings as produced by the DOM or the
 * Google Meet participant API. Names from different locales (CJK, Arabic,
 * Devanagari, etc.) are handled transparently via the `Intl.Collator`
 * engine embedded in `localeCompare`.
 */

/**
 * Normalizes a participant name for consistent storage and comparison.
 *
 * Applies three transformations in order:
 * 1. **NFC normalization** – canonicalizes composed vs. decomposed Unicode
 *    code points (e.g. `é` stored as two code points → single code point).
 * 2. **Trimming** – removes leading and trailing whitespace.
 * 3. **Lowercasing** – folds case for case-insensitive comparison.
 *
 * @param name - A raw participant name string (may contain any Unicode script).
 * @returns The normalized name string.
 *
 * @example
 * normalizeName("  Ångström  "); // "ångström"
 * normalizeName("José");         // "josé"  (NFC form, lowercased)
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFC") // Canonical Unicode form
    .trim()
    .toLowerCase();
}

/**
 * Checks whether two participant name strings are equivalent, accounting
 * for Unicode normalization and locale-specific accent differences.
 *
 * Uses `localeCompare` with `sensitivity: "base"` so that accented variants
 * of the same base letter (e.g. `"e"` vs `"é"`) are considered equal. This
 * is intentional for name-matching — favour false positives over missing a
 * returning participant due to an accent mismatch.
 *
 * @param a - First name string.
 * @param b - Second name string.
 * @returns `true` if the names are considered equivalent; `false` otherwise.
 *
 * @example
 * namesMatch("jose", "José");   // true
 * namesMatch("Alice", "alice"); // true
 * namesMatch("Alice", "Bob");   // false
 */
export function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  return na.localeCompare(nb, undefined, { sensitivity: "base" }) === 0;
}

/**
 * Searches a list of participant name strings for one that is equivalent to
 * the given `name`, using the same Unicode-aware matching as {@link namesMatch}.
 *
 * Returns the original (un-normalized) string from the list so the caller can
 * use the canonical form stored in state rather than the potentially differently
 * formatted lookup key.
 *
 * @param name - The name to search for.
 * @param participants - The list of known participant name strings to search.
 * @returns The matching participant name from the list, or `undefined` if not found.
 *
 * @example
 * findParticipant("josé", ["Alice", "José", "Bob"]); // "José"
 * findParticipant("Eve", ["Alice", "Bob"]);           // undefined
 */
export function findParticipant(name: string, participants: string[]): string | undefined {
  const normalized = normalizeName(name);
  return participants.find(
    (p) => normalizeName(p).localeCompare(normalized, undefined, { sensitivity: "base" }) === 0,
  );
}

/**
 * Sanitizes a participant display name for safe insertion into HTML,
 * guarding against XSS via `innerHTML` assignment.
 *
 * Processing steps:
 * 1. **NFC normalize** – ensures consistent Unicode representation.
 * 2. **Truncate to 100 characters** – prevents excessively long names from
 *    breaking UI layout. Truncation happens *before* entity encoding to avoid
 *    splitting a multi-char HTML entity mid-string.
 * 3. **Escape HTML special characters** – replaces `<`, `>`, `&`, `"`, and
 *    `'` with their corresponding named/numeric HTML entities.
 *
 * @param name - The raw display name string (may be from an untrusted source).
 * @returns An HTML-safe display name, at most 100 characters long before encoding.
 *
 * @example
 * sanitizeDisplayName('<script>alert(1)</script>');
 * // "&lt;script&gt;alert(1)&lt;/script&gt;"
 *
 * sanitizeDisplayName("O'Brien & Associates");
 * // "O&#39;Brien &amp; Associates"
 */
export function sanitizeDisplayName(name: string): string {
  return name
    .normalize("NFC")
    .slice(0, 100) // Truncate before encoding to avoid splitting entities
    .replace(
      /[<>&"']/g,
      (c) =>
        (
          ({
            "<": "&lt;",
            ">": "&gt;",
            "&": "&amp;",
            '"': "&quot;",
            "'": "&#39;",
          }) as Record<string, string>
        )[c] ?? c,
    );
}
