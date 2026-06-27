/**
 * @fileoverview API credential storage with AES-GCM encryption.
 *
 * Credentials are stored in two layers:
 * - **`chrome.storage.local`** – encrypted ciphertext (AES-256-GCM), persisted across sessions.
 * - **`chrome.storage.session`** – plaintext cache, cleared on browser close or explicit lock.
 *
 * Encryption uses a passphrase-derived key (PBKDF2 + SHA-256, 100 000 iterations) with a
 * random 16-byte salt stored in local storage. The derived `CryptoKey` is held only in memory
 * and auto-expires after 30 minutes of inactivity.
 */

import { evaluatePassphraseStrength } from "../passphraseStrength";

const ENCRYPTED_MARKER = "enc:";

/** Union of all credential key names managed by this module. */
export type CredentialKey = "openai_api_key" | "elevenlabs_api_key";

/** Bag of optional API credential strings. */
export interface ApiCredentials {
  openai_api_key?: string;
  elevenlabs_api_key?: string;
}

const CREDENTIAL_KEYS: CredentialKey[] = ["openai_api_key", "elevenlabs_api_key"];

function normalizedCredential(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// ---------------------------------------------------------------------------
// SubtleCrypto AES-GCM + PBKDF2 helpers  (passphrase-based derivation)
// ---------------------------------------------------------------------------

const AES_ALGORITHM = "AES-GCM";
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const SALT_STORAGE_KEY = "credential_encryption_salt";
const VAULT_SENTINEL_KEY = "vault_sentinel";
const VAULT_SENTINEL_PLAINTEXT = "late-meet-vault-v1";

let derivedKey: CryptoKey | null = null;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return Uint8Array.from(atob(base64), (c) => c.codePointAt(0)!).buffer;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCodePoint(...new Uint8Array(buf)));
}

async function deriveKeyFromPassphrase(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------------------
// Auto-lock
// ---------------------------------------------------------------------------

/** Auto-lock timeout: clear the derived key after 30 minutes of inactivity. */
const AUTO_LOCK_TIMEOUT_MS = 30 * 60 * 1000;
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

function resetAutoLockTimer() {
  if (autoLockTimer) clearTimeout(autoLockTimer);
  autoLockTimer = setTimeout(() => {
    lockCredentials();
  }, AUTO_LOCK_TIMEOUT_MS);
}

// ---------------------------------------------------------------------------
// Public API: passphrase management
// ---------------------------------------------------------------------------

/**
 * Returns whether the credential vault is currently unlocked.
 *
 * A vault is unlocked when a derived `CryptoKey` is held in memory (i.e.
 * after a successful {@link unlockCredentials} call and before
 * {@link lockCredentials} is called or the auto-lock timer fires).
 *
 * @returns `true` if the vault is unlocked and encryption/decryption are
 *   available; `false` if locked.
 */
export function isUnlocked(): boolean {
  return derivedKey !== null;
}

/**
 * Returns whether the credential vault has already been set up.
 *
 * The vault is considered initialized once its passphrase salt has been
 * persisted. This lets UI callers enforce first-time passphrase rules without
 * blocking unlock attempts for existing vaults.
 */
export async function isVaultInitialized(): Promise<boolean> {
  const { [SALT_STORAGE_KEY]: storedSalt } = await chrome.storage.local.get([SALT_STORAGE_KEY]);
  return typeof storedSalt === "string" && storedSalt.length > 0;
}

/**
 * Unlocks the credential vault with a user-supplied passphrase.
 *
 * **First-time unlock** (no salt stored yet): generates a fresh random 16-byte
 * salt, derives a new AES-256-GCM key, and persists the salt to
 * `chrome.storage.local`. Always returns `true`.
 *
 * **Subsequent unlocks**: reads the persisted salt, derives the same key, then
 * attempts to decrypt a sample credential to verify the passphrase is correct.
 * Returns `false` if decryption fails (wrong passphrase).
 *
 * On success the derived key is cached in memory and the auto-lock timer is
 * (re-)started.
 *
 * @param passphrase - The user's plaintext passphrase.
 * @returns `true` if the vault was successfully unlocked; `false` if the
 *   passphrase is incorrect.
 */
export async function unlockCredentials(passphrase: string): Promise<boolean> {
  const { [SALT_STORAGE_KEY]: storedSalt } = await chrome.storage.local.get([SALT_STORAGE_KEY]);

  if (typeof storedSalt === "string") {
    const key = await deriveKeyFromPassphrase(passphrase, base64ToArrayBuffer(storedSalt));

    // -------------------------------------------------------------------------
    // Passphrase verification strategy (in priority order):
    //
    // 1. Vault sentinel  — preferred. Written by unlockCredentials() on every
    //    first-time setup (new code path). A small known-plaintext encrypted
    //    with the derived key; decryption succeeds iff the passphrase is correct.
    //    This works even when no API credentials have been saved yet, closing the
    //    "empty vault accepts any passphrase" vulnerability.
    //
    // 2. Legacy fallback — for vaults created before the sentinel was introduced.
    //    If no sentinel exists but encrypted credentials do, decrypt a sample
    //    credential to verify. Also writes the sentinel for future unlocks.
    //
    // 3. Unverifiable empty vault — sentinel absent AND no credentials (old vault,
    //    no keys ever saved). Cannot verify the passphrase; accept and write a
    //    sentinel immediately so the very next unlock is always verifiable.
    // -------------------------------------------------------------------------

    const localData = await chrome.storage.local.get([VAULT_SENTINEL_KEY, ...CREDENTIAL_KEYS]);
    const rawSentinel = localData[VAULT_SENTINEL_KEY];

    if (typeof rawSentinel === "string" && rawSentinel.startsWith(ENCRYPTED_MARKER)) {
      // Path 1 — sentinel present: verify passphrase via sentinel decryption.
      try {
        const combined = base64ToArrayBuffer(rawSentinel.slice(ENCRYPTED_MARKER.length));
        const iv = new Uint8Array(combined.slice(0, IV_LENGTH));
        const ciphertext = combined.slice(IV_LENGTH);
        const decrypted = await crypto.subtle.decrypt({ name: AES_ALGORITHM, iv }, key, ciphertext);
        const plaintext = new TextDecoder().decode(decrypted);
        if (plaintext !== VAULT_SENTINEL_PLAINTEXT) return false;
      } catch {
        return false; // Wrong passphrase — decryption failed.
      }
    } else {
      // Path 2 or 3 — legacy vault without sentinel.
      const encryptedCreds = unmarkEncrypted(localData);

      if (Object.keys(encryptedCreds).length > 0) {
        // Path 2: encrypted credentials exist — verify via credential decryption.
        // Require a key whose ciphertext is non-empty. If every stored ciphertext
        // is empty/malformed ("enc:" with no payload), we cannot verify the
        // passphrase and must reject — accepting here would let an attacker write
        // a sentinel encrypted with a wrong passphrase, silently locking the user out.
        const sampleKey = CREDENTIAL_KEYS.find(
          (k) => encryptedCreds[k] && encryptedCreds[k]!.length > 0
        );

        if (!sampleKey) {
          // Storage has credential keys but all ciphertexts are empty/malformed.
          // Fail closed — do not write sentinel with an unverified passphrase.
          return false;
        }

        try {
          const combined = base64ToArrayBuffer(encryptedCreds[sampleKey]!);
          const iv = new Uint8Array(combined.slice(0, IV_LENGTH));
          const ciphertext = combined.slice(IV_LENGTH);
          await crypto.subtle.decrypt({ name: AES_ALGORITHM, iv }, key, ciphertext);
        } catch {
          return false; // Wrong passphrase — decryption failed.
        }
      }
      // Path 2 fall-through OR Path 3: write sentinel now so all future unlocks
      // use it. For Path 3 (unverifiable empty vault) we trust the passphrase
      // once and then lock it in — any subsequent mistyped passphrase will be
      // caught by the sentinel on the very next unlock attempt.
      derivedKey = key;
      const sentinelCiphertext = ENCRYPTED_MARKER + (await encrypt(VAULT_SENTINEL_PLAINTEXT));
      await chrome.storage.local.set({ [VAULT_SENTINEL_KEY]: sentinelCiphertext });
      resetAutoLockTimer();
      return true;
    }

    derivedKey = key;
    resetAutoLockTimer();
    return true;
  }

  // First-time setup: enforce minimum passphrase strength at the boundary so
  // every caller (options, popup, onboarding) is covered, not just the UI (#655).
  if (!evaluatePassphraseStrength(passphrase).meetsMinimum) {
    return false;
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  await chrome.storage.local.set({ [SALT_STORAGE_KEY]: arrayBufferToBase64(salt.buffer) });
  derivedKey = await deriveKeyFromPassphrase(passphrase, salt.buffer);

  // Write vault sentinel immediately on first-time setup so all future unlocks
  // can verify the passphrase even before any API credentials are saved.
  const sentinelCiphertext = ENCRYPTED_MARKER + (await encrypt(VAULT_SENTINEL_PLAINTEXT));
  await chrome.storage.local.set({ [VAULT_SENTINEL_KEY]: sentinelCiphertext });

  resetAutoLockTimer();
  return true;
}

/**
 * Locks the credential vault immediately.
 *
 * Clears the in-memory derived key and cancels the auto-lock timer.
 * Also purges the plaintext credential cache from `chrome.storage.session`
 * to prevent stale decrypted keys from being read after lock — see the inline
 * comment for the security rationale.
 *
 * This function is synchronous with respect to the key wipe; the session
 * storage removal is async and failures are logged as warnings only.
 */
export function lockCredentials(): void {
  derivedKey = null;
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
  // Purge plaintext API keys from session storage on lock.
  // The session store holds decrypted keys for fast access (avoids re-deriving
  // the PBKDF2 key on every lookup). If we only clear the in-memory derivedKey
  // but leave the session store intact, an attacker who gains access to
  // chrome.storage.session after lock expiry can still read the raw keys
  // without knowing the passphrase.
  chrome.storage.session.remove(CREDENTIAL_KEYS as unknown as string[]).catch((err) => {
    console.warn("[LateMeet][credentials] Failed to purge session keys on lock:", err);
  });
}

// ---------------------------------------------------------------------------
// Encryption / Decryption primitives
// ---------------------------------------------------------------------------

async function encrypt(plaintext: string): Promise<string> {
  if (!derivedKey) throw new Error("Encryption key not available — unlock credentials first");
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: AES_ALGORITHM, iv }, derivedKey, encoded);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return arrayBufferToBase64(combined.buffer);
}

async function decrypt(encoded: string): Promise<string> {
  if (!derivedKey) throw new Error("Decryption key not available — unlock credentials first");
  const combined = base64ToArrayBuffer(encoded);
  const iv = new Uint8Array(combined.slice(0, IV_LENGTH));
  const ciphertext = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv },
    derivedKey,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

async function encryptCredentials(credentials: ApiCredentials): Promise<ApiCredentials> {
  if (!derivedKey) throw new Error("Encryption key not available — unlock credentials first");

  const encrypted: ApiCredentials = {};
  for (const [k, v] of Object.entries(credentials)) {
    if (v) {
      encrypted[k as CredentialKey] = await encrypt(v);
    }
  }
  return encrypted;
}

async function decryptCredentials(encrypted: ApiCredentials): Promise<ApiCredentials> {
  if (!derivedKey) return {};

  const decrypted: ApiCredentials = {};
  for (const k of CREDENTIAL_KEYS) {
    const v = encrypted[k];
    if (v) {
      try {
        decrypted[k] = await decrypt(v);
      } catch {
        // Decryption failure — key rotated or invalid; skip
      }
    }
  }
  return decrypted;
}

function markEncrypted(data: ApiCredentials): ApiCredentials {
  const marked: ApiCredentials = {};
  for (const k of CREDENTIAL_KEYS) {
    const v = data[k];
    if (v) {
      marked[k] = ENCRYPTED_MARKER + v;
    }
  }
  return marked;
}

function unmarkEncrypted(data: Record<string, unknown>): ApiCredentials {
  const unmarked: ApiCredentials = {};
  for (const k of CREDENTIAL_KEYS) {
    const v = data[k];
    if (typeof v === "string" && v.startsWith(ENCRYPTED_MARKER)) {
      unmarked[k] = v.slice(ENCRYPTED_MARKER.length);
    }
  }
  return unmarked;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieves all stored API credentials, decrypting from local storage if
 * necessary and caching the plaintext in session storage for fast subsequent
 * reads.
 *
 * Read priority:
 * 1. **`chrome.storage.session`** – fastest; already-decrypted values written
 *    by a previous call or {@link saveApiCredentials}.
 * 2. **`chrome.storage.local`** (encrypted) – decrypted on-the-fly using the
 *    in-memory derived key. The decrypted values are then synced back to
 *    session storage to avoid re-decryption on the next call.
 *
 * Also resets the auto-lock timer when the vault is unlocked, extending the
 * idle timeout on each credential access.
 *
 * @returns An {@link ApiCredentials} object. Keys absent from both storage
 *   areas are simply omitted (not set to `undefined` or `null`).
 */
export async function getApiCredentials(): Promise<ApiCredentials> {
  // Reset auto-lock timer on credential access (extends timeout on activity)
  if (derivedKey) resetAutoLockTimer();

  const [sessionCredentials, localCredentials] = await Promise.all([
    chrome.storage.session.get(CREDENTIAL_KEYS),
    chrome.storage.local.get(CREDENTIAL_KEYS),
  ]);

  const credentials: ApiCredentials = {};
  const sessionSync: ApiCredentials = {};

  for (const key of CREDENTIAL_KEYS) {
    const sessionValue = normalizedCredential(sessionCredentials[key]);
    if (sessionValue) {
      credentials[key] = sessionValue;
    }
  }

  const encryptedLocal = unmarkEncrypted(localCredentials);
  if (Object.keys(encryptedLocal).length > 0) {
    const decryptedLocal = await decryptCredentials(encryptedLocal);
    for (const key of CREDENTIAL_KEYS) {
      const v = decryptedLocal[key];
      if (v && !credentials[key]) {
        credentials[key] = v;
        sessionSync[key] = v;
      }
    }
  }

  if (Object.keys(sessionSync).length > 0) {
    await chrome.storage.session.set(sessionSync);
  }

  return credentials;
}

/**
 * Retrieves the stored OpenAI API key.
 *
 * Convenience wrapper around {@link getApiCredentials} for callers that only
 * need the OpenAI key.
 *
 * @returns The OpenAI API key string, or `null` if none is stored.
 *
 * @example
 * const key = await getOpenAiApiKey();
 * if (!key) throw new Error("OpenAI key not configured — open extension options");
 */
export async function getOpenAiApiKey(): Promise<string | null> {
  const credentials = await getApiCredentials();
  return credentials.openai_api_key || null;
}

/**
 * Retrieves the stored ElevenLabs API key.
 *
 * Convenience wrapper around {@link getApiCredentials} for callers that only
 * need the ElevenLabs key.
 *
 * @returns The ElevenLabs API key string, or `null` if none is stored.
 *
 * @example
 * const key = await getElevenLabsApiKey();
 * if (key) {
 *   // Use ElevenLabs for higher-quality transcription
 * }
 */
export async function getElevenLabsApiKey(): Promise<string | null> {
  const credentials = await getApiCredentials();
  return credentials.elevenlabs_api_key || null;
}

/**
 * Persists API credentials to both `chrome.storage.local` (encrypted) and
 * `chrome.storage.session` (plaintext cache).
 *
 * Only keys explicitly present in the `credentials` object are processed —
 * omitted keys are left untouched. This allows callers to update a single key
 * without affecting the other.
 *
 * - Non-empty string values are **encrypted and saved** to local storage and
 *   written in plaintext to the session cache.
 * - Empty / whitespace-only strings signal intent to **delete** the key from
 *   both storage areas.
 *
 * @param credentials - A partial {@link ApiCredentials} object. Only include
 *   the keys you want to update or delete.
 * @returns A Promise that resolves when all storage operations are complete.
 * @throws If the vault is locked and a non-empty credential value is provided
 *   (encryption requires an unlocked vault).
 *
 * @example
 * // Save a new OpenAI key without touching the ElevenLabs key:
 * await saveApiCredentials({ openai_api_key: "sk-..." });
 *
 * // Clear the ElevenLabs key:
 * await saveApiCredentials({ elevenlabs_api_key: "" });
 */
export async function saveApiCredentials(credentials: ApiCredentials): Promise<void> {
  const saveData: ApiCredentials = {};
  const removeKeys: CredentialKey[] = [];

  for (const key of CREDENTIAL_KEYS) {
    // Only process keys that are explicitly present in the input credentials object
    if (key in credentials) {
      const value = normalizedCredential(credentials[key]);
      if (value) {
        saveData[key] = value;
      } else {
        removeKeys.push(key);
      }
    }
  }

  if (Object.keys(saveData).length > 0) {
    const encrypted = markEncrypted(await encryptCredentials(saveData));
    await Promise.all([chrome.storage.session.set(saveData), chrome.storage.local.set(encrypted)]);
  }

  if (removeKeys.length > 0) {
    await Promise.all([
      chrome.storage.session.remove(removeKeys),
      chrome.storage.local.remove(removeKeys),
    ]);
  }
}
