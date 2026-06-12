/**
 * @fileoverview Centralized XSS sanitization utilities
 * @security All dynamic data rendered via innerHTML MUST use these functions
 */

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Use for ALL untrusted data before innerHTML insertion.
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
 * Validates and sanitizes CSS class names
 * Prevents class injection attacks
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
 * Sanitizes data-* attribute values
 * Prevents attribute injection
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
