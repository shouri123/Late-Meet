const SIGNATURE_PREFIX = "lateMeet:backup:v1:";

/**
 * Computes a SHA-256 hex digest over the namespace prefix + JSON-serialised
 * payload. The prefix ensures a valid hash can only be produced via this
 * extension's export path, not from an arbitrary JSON file.
 */
export async function signBackup(payload: unknown): Promise<string> {
  const data = SIGNATURE_PREFIX + JSON.stringify(payload);
  const encoded = new TextEncoder().encode(data);
  const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Strips `__signature` from the parsed JSON, recomputes the hash over the
 * remaining payload, and returns whether they match.
 * Returns false if `__signature` is absent or not a string.
 */
export async function verifyBackup(json: Record<string, unknown>): Promise<boolean> {
  const { __signature, ...payload } = json;
  if (typeof __signature !== "string") return false;
  return (await signBackup(payload)) === __signature;
}
