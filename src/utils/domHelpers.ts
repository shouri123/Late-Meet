/**
 * @fileoverview Shared DOM utility helpers used by `popup.ts` and `dashboard.ts`.
 *
 * Keep this module free of Chrome extension APIs so it can be unit-tested in
 * a plain Node/jsdom environment without needing a browser context.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

/**
 * Escapes HTML special characters in a string to prevent XSS when inserting
 * user-controlled text into the DOM via `innerHTML`.
 *
 * Handles the five characters that are meaningful in an HTML context (`&`,
 * `<`, `>`, `"`, `'`). `null` and `undefined` are coerced to an empty string
 * via the nullish-coalescing operator before escaping.
 *
 * @param value - The raw string (or nullish value) to escape.
 * @returns An HTML-safe string where special characters are replaced with
 *   their corresponding named HTML entities.
 *
 * @example
 * element.innerHTML = `<span>${escapeHtml(user.displayName)}</span>`;
 * // Input:  'Alice <script>alert(1)</script>'
 * // Output: 'Alice &lt;script&gt;alert(1)&lt;/script&gt;'
 */
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * Formats a duration given in seconds into a zero-padded `HH:MM:SS` string.
 *
 * Hours are not capped — a duration of 7 200 seconds produces `"02:00:00"`,
 * and a duration of 36 000 seconds produces `"10:00:00"`. Sub-second
 * precision is discarded via `Math.floor`.
 *
 * @param seconds - Total duration in seconds. Should be a non-negative number;
 *   negative values produce unexpected results.
 * @returns A time string in the format `"HH:MM:SS"` with each segment
 *   zero-padded to at least two digits.
 *
 * @example
 * formatDuration(0);     // "00:00:00"
 * formatDuration(90);    // "00:01:30"
 * formatDuration(3661);  // "01:01:01"
 * formatDuration(86399); // "23:59:59"
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Validates and narrows a raw topic status string to one of the accepted
 * `Topic.status` union values (`"active" | "completed" | "unresolved"`).
 *
 * Any value that is not explicitly `"completed"` or `"unresolved"` — including
 * unknown strings, empty strings, and non-string types passed as strings —
 * falls back to `"active"`. This makes the function safe to call directly on
 * data arriving from `chrome.storage` or the AI response without additional
 * type guards.
 *
 * @param status - The raw status string to validate and narrow.
 * @returns `"completed"` or `"unresolved"` if the input matches exactly;
 *   `"active"` for any other value.
 *
 * @example
 * sanitizeTopicStatus("completed");    // "completed"
 * sanitizeTopicStatus("unresolved");   // "unresolved"
 * sanitizeTopicStatus("pending");      // "active"  (unknown → default)
 * sanitizeTopicStatus("");             // "active"
 */
export function sanitizeTopicStatus(status: string): "active" | "completed" | "unresolved" {
  if (status === "completed" || status === "unresolved") return status;
  return "active";
}
