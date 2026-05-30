import test from "node:test";
import assert from "node:assert/strict";

import {
  getApiCredentials,
  getElevenLabsApiKey,
  getOpenAiApiKey,
  saveApiCredentials,
} from "./credentials.ts";

type StorageArea = Record<string, unknown>;

function setupChromeStorage(sessionInitial: StorageArea = {}, localInitial: StorageArea = {}) {
  const session: StorageArea = { ...sessionInitial };
  const local: StorageArea = { ...localInitial };

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

test("save writes plaintext to session and encrypted to local", async () => {
  const { session, local } = setupChromeStorage();

  await saveApiCredentials({ openai_api_key: "sk-test-123", elevenlabs_api_key: "el-test-456" });

  // Session should have plaintext
  assert.equal(session.openai_api_key, "sk-test-123");
  assert.equal(session.elevenlabs_api_key, "el-test-456");

  // Local should have encrypted (enc: prefixed) data
  assert.ok(typeof local.openai_api_key === "string");
  assert.ok((local.openai_api_key as string).startsWith("enc:"));
  assert.ok(typeof local.elevenlabs_api_key === "string");
  assert.ok((local.elevenlabs_api_key as string).startsWith("enc:"));
  // Encrypted payload must not equal plaintext
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

  // Save first — this populates both session (plaintext) and local (encrypted)
  await saveApiCredentials({ openai_api_key: "persisted-key" });

  // Simulate session loss by deleting session keys (but keep the encryption key)
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

  // Save first
  await saveApiCredentials({ openai_api_key: "will-clear", elevenlabs_api_key: "will-clear" });
  assert.ok(session.openai_api_key);
  assert.ok(local.openai_api_key);

  // Clear
  await saveApiCredentials({ openai_api_key: "", elevenlabs_api_key: "" });

  assert.deepEqual(session.openai_api_key, undefined);
  assert.deepEqual(session.elevenlabs_api_key, undefined);
  assert.deepEqual(local.openai_api_key, undefined);
  assert.deepEqual(local.elevenlabs_api_key, undefined);
});

test("saving credentials trims whitespace", async () => {
  const { session, local } = setupChromeStorage();

  await saveApiCredentials({
    openai_api_key: "  spaced-key  ",
    elevenlabs_api_key: "  spaced-eleven  ",
  });

  assert.equal(session.openai_api_key, "spaced-key");
  assert.equal(session.elevenlabs_api_key, "spaced-eleven");
  assert.ok((local.openai_api_key as string).startsWith("enc:"));
});
