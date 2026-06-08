// Shared DOM utility helpers used by popup.ts and dashboard.ts

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
 * @param value - The raw string to escape. Null and undefined are treated as empty strings.
 * @returns A string safe for use in HTML contexts.
 */
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * Formats a duration given in seconds into an `HH:MM:SS` string.
 * @param seconds - Total duration in seconds (non-negative integer or float).
 * @returns A zero-padded time string in the format `HH:MM:SS`.
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Validates and narrows a raw topic status string to one of the accepted
 * `Topic.status` union values. Falls back to `"active"` for any unrecognized value.
 * @param status - The raw status string to validate.
 * @returns One of `"active"`, `"completed"`, or `"unresolved"`.
 */
export function sanitizeTopicStatus(status: string): "active" | "completed" | "unresolved" {
  if (status === "completed" || status === "unresolved") return status;
  return "active";
}
