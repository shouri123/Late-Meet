const ENCRYPTED_MARKER = "enc:";

export type CredentialKey = "openai_api_key" | "elevenlabs_api_key";

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
// Public API: passphrase management
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

export function isUnlocked(): boolean {
  return derivedKey !== null;
}

export async function unlockCredentials(passphrase: string): Promise<boolean> {
  const { [SALT_STORAGE_KEY]: storedSalt } = await chrome.storage.local.get([SALT_STORAGE_KEY]);

  if (typeof storedSalt === "string") {
    const key = await deriveKeyFromPassphrase(passphrase, base64ToArrayBuffer(storedSalt));
    const encryptedLocal = await chrome.storage.local.get(CREDENTIAL_KEYS);
    const encryptedCreds = unmarkEncrypted(encryptedLocal);
    if (Object.keys(encryptedCreds).length > 0) {
      try {
        const sampleKey = CREDENTIAL_KEYS.find((k) => encryptedCreds[k]);
        if (sampleKey && encryptedCreds[sampleKey]) {
          const combined = base64ToArrayBuffer(encryptedCreds[sampleKey]);
          const iv = new Uint8Array(combined.slice(0, IV_LENGTH));
          const ciphertext = combined.slice(IV_LENGTH);
          await crypto.subtle.decrypt({ name: AES_ALGORITHM, iv }, key, ciphertext);
        }
      } catch {
        return false;
      }
    }
    derivedKey = key;
    resetAutoLockTimer();
    return true;
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  await chrome.storage.local.set({ [SALT_STORAGE_KEY]: arrayBufferToBase64(salt.buffer) });
  derivedKey = await deriveKeyFromPassphrase(passphrase, salt.buffer);
  resetAutoLockTimer();
  return true;
}

export function lockCredentials(): void {
  derivedKey = null;
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
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
    const resolvedValue = sessionValue;

    if (resolvedValue) {
      credentials[key] = resolvedValue;
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

export async function getOpenAiApiKey(): Promise<string | null> {
  const credentials = await getApiCredentials();
  return credentials.openai_api_key || null;
}

export async function getElevenLabsApiKey(): Promise<string | null> {
  const credentials = await getApiCredentials();
  return credentials.elevenlabs_api_key || null;
}

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
