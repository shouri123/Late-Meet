/**
 * @fileoverview URL Validator
 *
 * Validates API endpoint URLs to ensure secure connections.
 * Prevents sending meeting data to non-HTTPS endpoints or to
 * unexpected third-party hosts.
 */

/**
 * Domains that are unconditionally trusted as Late-Meet API targets.
 * Used when `requireAllowlist` is enabled in {@link validateApiUrl}.
 */
const ALLOWED_DOMAINS = [
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
];

/**
 * Validates that a URL string is well-formed, uses HTTPS, and optionally
 * belongs to the trusted API domain allowlist.
 *
 * Three-stage validation:
 * 1. **Format check** – the string must parse as a valid URL.
 * 2. **Protocol check** – the scheme must be `https:`.
 * 3. **Allowlist check** *(optional)* – the hostname must exactly match or be
 *    a subdomain of one of the entries in {@link ALLOWED_DOMAINS}.
 *
 * @param url - The URL string to validate.
 * @param options.requireAllowlist - When `true`, also verifies the hostname is
 *   in the trusted domain list. Defaults to `false`.
 * @returns An object with `valid: true` on success, or `valid: false` and a
 *   human-readable `error` string describing the first failure encountered.
 *
 * @example
 * const result = validateApiUrl("http://api.openai.com/v1/chat/completions");
 * // { valid: false, error: "API URL must use HTTPS. Got: http:" }
 *
 * @example
 * const result = validateApiUrl("https://my-proxy.example.com/v1", { requireAllowlist: true });
 * // { valid: false, error: 'Domain "my-proxy.example.com" is not in the allowed API domains list' }
 */
export function validateApiUrl(
  url: string,
  options: { requireAllowlist?: boolean } = {},
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
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
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
 * Asserts that a URL is valid before making a fetch request, throwing a
 * descriptive error if validation fails.
 *
 * This is a convenience wrapper around {@link validateApiUrl} for call sites
 * that prefer the throw-on-failure pattern over checking a return value.
 * The error message is prefixed with `[Late-Meet Security]` to make security
 * violations easy to locate in logs.
 *
 * @param url - The URL string to validate (HTTPS-only, no allowlist check).
 * @throws `Error` with a `[Late-Meet Security]` prefix if the URL is invalid
 *   or not HTTPS.
 *
 * @example
 * assertValidApiUrl(userSuppliedEndpoint); // throws if invalid
 * const res = await fetch(userSuppliedEndpoint, options);
 */
export function assertValidApiUrl(url: string): void {
  const result = validateApiUrl(url);
  if (!result.valid) {
    throw new Error(`[Late-Meet Security] ${result.error}`);
  }
}
