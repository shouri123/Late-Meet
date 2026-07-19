/**
 * @fileoverview Centralized XSS sanitization utilities.
 *
 * All dynamic data rendered via `innerHTML` MUST pass through one of these
 * functions before insertion. Never bypass these helpers even for data that
 * "looks safe" — the source may change, and defense-in-depth is critical.
 *
 * @security
 */

/**
 * Escapes HTML special characters in an arbitrary value to prevent XSS attacks.
 *
 * Accepts any type and converts it to a safe HTML string:
 * - `null` / `undefined` → `""`
 * - `string` → escaped as-is
 * - `number`, `boolean`, `symbol`, `bigint` → converted via `String()`
 * - objects / arrays → serialized via `JSON.stringify()`
 *
 * Internally delegates to a temporary `<div>` element so that the browser's
 * own HTML serialiser handles all edge cases (including supplementary Unicode
 * code points).
 *
 * @param value - The raw, potentially untrusted value to escape.
 * @returns An HTML-safe string where `&`, `<`, `>`, `"`, and `'` are replaced
 *   with their corresponding HTML entities.
 *
 * @example
 * element.innerHTML = escapeHtml(userInput);
 * // '<script>alert(1)</script>' → '&lt;script&gt;alert(1)&lt;/script&gt;'
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (typeof value === "string") {
    str = value;
  } else if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    str = String(value);
  } else {
    str = JSON.stringify(value);
  }
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Validates a class name string against an explicit allowlist to prevent
 * CSS class injection attacks.
 *
 * If the supplied `value` is not present in `allowed`, the first entry of
 * `allowed` is returned as a safe default. This guarantees the caller always
 * receives a valid, known class name.
 *
 * @param value - The raw class name to validate. Non-string primitives are
 *   coerced with `String()`; objects / arrays fall back to `allowed[0]`.
 * @param allowed - A non-empty array of permitted class name strings.
 * @returns The validated class name string (always a member of `allowed`).
 * @throws `Error` if `allowed` is empty or not an array.
 *
 * @example
 * const cls = sanitizeClassName(userRole, ["badge-admin", "badge-user", "badge-guest"]);
 * element.className = cls; // guaranteed to be one of the three values
 */
export function sanitizeClassName(value: unknown, allowed: string[]): string {
  if (!Array.isArray(allowed) || allowed.length === 0) {
    throw new Error("sanitizeClassName: allowed array must not be empty");
  }
  if (value === null || value === undefined) return allowed[0];
  let str: string;
  if (typeof value === "string") {
    str = value;
  } else if (typeof value === "number" || typeof value === "boolean") {
    str = String(value);
  } else {
    str = "";
  }
  return allowed.includes(str) ? str : allowed[0];
}

/**
 * Sanitizes a value for safe use as an HTML `data-*` attribute value,
 * preventing attribute injection attacks.
 *
 * Escapes the five most dangerous HTML/attribute characters (`'`, `"`, `<`,
 * `>`, `&`) into their named or numeric HTML entities. The resulting string
 * is safe to embed directly inside a quoted HTML attribute.
 *
 * Type handling mirrors {@link escapeHtml}: primitives are coerced with
 * `String()`, objects/arrays with `JSON.stringify()`, and null/undefined
 * produce `""`.
 *
 * @param value - The raw, potentially untrusted value to sanitize.
 * @returns An attribute-safe string with special characters replaced by HTML entities.
 *
 * @example
 * element.setAttribute("data-title", sanitizeDataAttr(meetingTitle));
 * // 'O\'Brien & "Associates"' → 'O&#39;Brien &amp; &quot;Associates&quot;'
 */
export function sanitizeDataAttr(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (typeof value === "string") {
    str = value;
  } else if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    str = String(value);
  } else {
    str = JSON.stringify(value);
  }
  return str.replace(/['"<>&]/g, (match) => {
    const escapeMap: Record<string, string> = {
      "'": "&#39;",
      '"': "&quot;",
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
    };
    return escapeMap[match] || match;
  });
}
