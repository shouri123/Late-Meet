import test, { after } from "node:test";
import assert from "node:assert/strict";

import {
  getApiCredentials,
  getElevenLabsApiKey,
  getOpenAiApiKey,
  saveApiCredentials,
  unlockCredentials,
  lockCredentials,
  isUnlocked,
} from "./credentials.ts";

type StorageArea = Record<string, unknown>;

function setupChromeStorage(sessionInitial: StorageArea = {}, localInitial: StorageArea = {}) {
  // Ensure basic mock exists so lockCredentials can run without ReferenceError
  if (!(globalThis as any).chrome) {
    (globalThis as any).chrome = {
      storage: {
        session: {
          async remove() {},
        },
      },
    };
  }

  lockCredentials();

  const session: StorageArea = sessionInitial;
  const local: StorageArea = localInitial;

  function createStorageArea(store: StorageArea) {
    return {
      async get(keys: string | string[]) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        return keyList.reduce<StorageArea>((result, key) => {
          result[key] = store[key];
          return result;
        }, {});
      },
      async set(values: StorageArea) {
        Object.assign(store, values);
      },
      async remove(keys: string | string[]) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          delete store[key];
        }
      },
    };
  }

  (globalThis as any).chrome = {
    storage: {
      session: createStorageArea(session),
      local: createStorageArea(local),
    },
  };

  return { session, local };
}

test("isUnlocked returns false initially", () => {
  setupChromeStorage();
  assert.equal(isUnlocked(), false);
});

test("unlock on first run generates salt and caches key", async () => {
  const { local } = setupChromeStorage();

  assert.equal(isUnlocked(), false);
  const result = await unlockCredentials("test-passphrase");
  assert.equal(result, true);
  assert.equal(isUnlocked(), true);

  assert.ok(typeof local.credential_encryption_salt === "string");
  assert.equal(local.credential_encryption_seed, undefined);
});

test("unlock with wrong passphrase returns false", async () => {
  setupChromeStorage();

  await unlockCredentials("correct-passphrase");
  assert.equal(isUnlocked(), true);

  await saveApiCredentials({ openai_api_key: "secret-key" });

  lockCredentials();
  assert.equal(isUnlocked(), false);

  const result = await unlockCredentials("wrong-passphrase");
  assert.equal(result, false);
  assert.equal(isUnlocked(), false);
});

test("unlock with correct passphrase after lock returns true", async () => {
  setupChromeStorage();

  await unlockCredentials("correct-passphrase");
  await saveApiCredentials({ openai_api_key: "secret-key" });

  lockCredentials();
  const result = await unlockCredentials("correct-passphrase");
  assert.equal(result, true);
  assert.equal(isUnlocked(), true);
});

test("save writes plaintext to session and encrypted to local", async () => {
  const { session, local } = setupChromeStorage();

  await unlockCredentials("test-passphrase");
  await saveApiCredentials({ openai_api_key: "sk-test-123", elevenlabs_api_key: "el-test-456" });

  assert.equal(session.openai_api_key, "sk-test-123");
  assert.equal(session.elevenlabs_api_key, "el-test-456");

  assert.ok(typeof local.openai_api_key === "string");
  assert.ok((local.openai_api_key as string).startsWith("enc:"));
  assert.ok(typeof local.elevenlabs_api_key === "string");
  assert.ok((local.elevenlabs_api_key as string).startsWith("enc:"));
  assert.notEqual(local.openai_api_key, "sk-test-123");
  assert.notEqual(local.elevenlabs_api_key, "el-test-456");
});

test("getApiCredentials returns plaintext from session when available", async () => {
  setupChromeStorage({ openai_api_key: "session-key", elevenlabs_api_key: "session-eleven" }, {});

  const creds = await getApiCredentials();
  assert.equal(creds.openai_api_key, "session-key");
  assert.equal(creds.elevenlabs_api_key, "session-eleven");
});

test("getApiCredentials decrypts local credentials when session is empty", async () => {
  const { session } = setupChromeStorage();

  await unlockCredentials("test-passphrase");
  await saveApiCredentials({ openai_api_key: "persisted-key" });

  delete session.openai_api_key;
  delete session.elevenlabs_api_key;

  const creds = await getApiCredentials();
  assert.equal(creds.openai_api_key, "persisted-key");
});

test("getOpenAiApiKey and getElevenLabsApiKey work correctly", async () => {
  setupChromeStorage({ openai_api_key: "openai-foo", elevenlabs_api_key: "elevenlabs-bar" }, {});

  assert.equal(await getOpenAiApiKey(), "openai-foo");
  assert.equal(await getElevenLabsApiKey(), "elevenlabs-bar");
});

test("clearing credentials removes from both local and session", async () => {
  const { session, local } = setupChromeStorage();

  await unlockCredentials("test-passphrase");
  await saveApiCredentials({ openai_api_key: "will-clear", elevenlabs_api_key: "will-clear" });
  assert.ok(session.openai_api_key);
  assert.ok(local.openai_api_key);

  await saveApiCredentials({ openai_api_key: "", elevenlabs_api_key: "" });

  assert.deepEqual(session.openai_api_key, undefined);
  assert.deepEqual(session.elevenlabs_api_key, undefined);
  assert.deepEqual(local.openai_api_key, undefined);
  assert.deepEqual(local.elevenlabs_api_key, undefined);
});

test("saving credentials trims whitespace", async () => {
  const { session, local } = setupChromeStorage();

  await unlockCredentials("test-passphrase");
  await saveApiCredentials({
    openai_api_key: "  spaced-key  ",
    elevenlabs_api_key: "  spaced-eleven  ",
  });

  assert.equal(session.openai_api_key, "spaced-key");
  assert.equal(session.elevenlabs_api_key, "spaced-eleven");
  assert.ok((local.openai_api_key as string).startsWith("enc:"));
});

test("encrypted credentials survive simulated restart with same passphrase", async () => {
  const session1: StorageArea = {};
  const local1: StorageArea = {};
  setupChromeStorage(session1, local1);

  await unlockCredentials("survival-passphrase");
  await saveApiCredentials({ openai_api_key: "survive-key" });

  lockCredentials();
  const session2: StorageArea = {};
  setupChromeStorage(session2, local1);

  await unlockCredentials("survival-passphrase");
  const creds = await getApiCredentials();
  assert.equal(creds.openai_api_key, "survive-key");
});

test("wrong passphrase after restart returns no credentials", async () => {
  const session1: StorageArea = {};
  const local1: StorageArea = {};
  setupChromeStorage(session1, local1);

  await unlockCredentials("correct-passphrase");
  await saveApiCredentials({ openai_api_key: "my-secret-key" });

  lockCredentials();
  const session2: StorageArea = {};
  setupChromeStorage(session2, local1);

  const result = await unlockCredentials("wrong-passphrase");
  assert.equal(result, false);

  const creds = await getApiCredentials();
  assert.equal(creds.openai_api_key, undefined);
});

// ---------------------------------------------------------------------------
// Regression tests for: unlockCredentials accepts any passphrase when vault
// is initialized but no API credentials have been saved yet.
// Vault sentinel fix — see credentials.ts unlockCredentials() for details.
// ---------------------------------------------------------------------------

test("wrong passphrase rejected on empty vault (sentinel fix)", async () => {
  const { local } = setupChromeStorage();

  // First-time setup with correct passphrase — no API keys saved.
  await unlockCredentials("correct-passphrase");
  assert.equal(isUnlocked(), true);
  assert.ok(local["vault_sentinel"], "sentinel must be written on first-time setup");
  lockCredentials();

  // Attempt to unlock with a wrong passphrase — must be rejected.
  const result = await unlockCredentials("WRONG-passphrase");
  assert.equal(result, false, "wrong passphrase must return false even when no API keys are saved");
  assert.equal(isUnlocked(), false);
});

test("correct passphrase accepted on empty vault after sentinel written", async () => {
  setupChromeStorage();

  await unlockCredentials("my-passphrase");
  lockCredentials();

  // Should accept the correct passphrase even with no API credentials saved.
  const result = await unlockCredentials("my-passphrase");
  assert.equal(result, true);
  assert.equal(isUnlocked(), true);
});

test("credentials saved after empty-vault unlock are recoverable with correct passphrase", async () => {
  const { local } = setupChromeStorage();

  // Setup vault, save no credentials, lock.
  await unlockCredentials("secure-pass");
  lockCredentials();

  // Unlock again (sentinel path), save credentials, lock.
  await unlockCredentials("secure-pass");
  await saveApiCredentials({ openai_api_key: "sk-sentinel-test" });
  lockCredentials();

  // Fresh session — credentials must be recoverable with correct passphrase.
  setupChromeStorage({}, local);
  const result = await unlockCredentials("secure-pass");
  assert.equal(result, true);

  const creds = await getApiCredentials();
  assert.equal(creds.openai_api_key, "sk-sentinel-test");
});

test("unlock on first run writes vault_sentinel to local storage", async () => {
  const { local } = setupChromeStorage();

  await unlockCredentials("test-passphrase");

  assert.ok(typeof local["vault_sentinel"] === "string", "vault_sentinel must exist after first unlock");
  assert.ok(
    (local["vault_sentinel"] as string).startsWith("enc:"),
    "vault_sentinel must be encrypted (enc: prefix)",
  );
});

test("encryption operations are blocked without derived key", async () => {
  setupChromeStorage();
  assert.equal(isUnlocked(), false);

  await chrome.storage.local.set({
    openai_api_key: "enc:somegarbage",
    credential_encryption_salt: "dGVzdC1zYWx0",
  });

  const creds = await getApiCredentials();
  assert.equal(creds.openai_api_key, undefined);
});

test("saving partial credentials does not wipe out omitted keys", async () => {
  const { session, local } = setupChromeStorage(
    { openai_api_key: "existing-openai", elevenlabs_api_key: "existing-eleven" },
    { openai_api_key: "existing-openai", elevenlabs_api_key: "existing-eleven" },
  );

  await unlockCredentials("test-passphrase");

  // Omit elevenlabs_api_key entirely from the object
  await saveApiCredentials({ openai_api_key: "new-openai" });

  assert.deepEqual(session, {
    openai_api_key: "new-openai",
    elevenlabs_api_key: "existing-eleven",
  });
  assert.equal(local.elevenlabs_api_key, "existing-eleven");
  assert.ok((local.openai_api_key as string).startsWith("enc:"));
});

after(() => {
  lockCredentials();
});
