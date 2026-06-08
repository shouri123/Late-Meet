/**
 * URL Validator
 *
 * Validates API endpoint URLs to ensure secure connections.
 * Prevents sending meeting data to non-HTTPS endpoints.
 */

const ALLOWED_DOMAINS = [
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
];

/**
 * Validate that a URL is HTTPS and optionally from an allowed domain.
 */
export function validateApiUrl(
  url: string,
  options: { requireAllowlist?: boolean } = {}
): { valid: boolean; error?: string } {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `API URL must use HTTPS. Got: ${parsed.protocol}`,
    };
  }

  if (options.requireAllowlist) {
    const isAllowed = ALLOWED_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
    if (!isAllowed) {
      return {
        valid: false,
        error: `Domain "${parsed.hostname}" is not in the allowed API domains list`,
      };
    }
  }

  return { valid: true };
}

/**
 * Assert that a URL is valid before making a fetch request.
 * Throws an error if the URL is invalid.
 */
export function assertValidApiUrl(url: string): void {
  const result = validateApiUrl(url);
  if (!result.valid) {
    throw new Error(`[Late-Meet Security] ${result.error}`);
  }
}
