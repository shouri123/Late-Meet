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

test("credentials prefer session values over local values", async () => {
  setupChromeStorage(
    { openai_api_key: "session-openai" },
    { openai_api_key: "local-openai", elevenlabs_api_key: "local-elevenlabs" },
  );

  assert.deepEqual(await getApiCredentials(), {
    openai_api_key: "session-openai",
    elevenlabs_api_key: "local-elevenlabs",
  });
});

test("local credentials are synced into session as a migration fallback", async () => {
  const { session } = setupChromeStorage(
    {},
    { openai_api_key: "local-openai", elevenlabs_api_key: "local-elevenlabs" },
  );

  assert.equal(await getOpenAiApiKey(), "local-openai");
  assert.equal(await getElevenLabsApiKey(), "local-elevenlabs");
  assert.deepEqual(session, {
    openai_api_key: "local-openai",
    elevenlabs_api_key: "local-elevenlabs",
  });
});

test("saving credentials writes the same values to local and session storage", async () => {
  const { session, local } = setupChromeStorage();

  await saveApiCredentials({ openai_api_key: " openai ", elevenlabs_api_key: " elevenlabs " });

  assert.deepEqual(session, { openai_api_key: "openai", elevenlabs_api_key: "elevenlabs" });
  assert.deepEqual(local, { openai_api_key: "openai", elevenlabs_api_key: "elevenlabs" });
});

test("clearing credentials deletes them from both local and session storage", async () => {
  const { session, local } = setupChromeStorage(
    { openai_api_key: "openai", elevenlabs_api_key: "elevenlabs" },
    { openai_api_key: "openai", elevenlabs_api_key: "elevenlabs" },
  );

  await saveApiCredentials({ openai_api_key: "", elevenlabs_api_key: "" });

  assert.deepEqual(session, {});
  assert.deepEqual(local, {});
});

test("saving partial credentials does not wipe out omitted keys", async () => {
  const { session, local } = setupChromeStorage(
    { openai_api_key: "existing-openai", elevenlabs_api_key: "existing-eleven" },
    { openai_api_key: "existing-openai", elevenlabs_api_key: "existing-eleven" },
  );

  // Omit elevenlabs_api_key entirely from the object
  await saveApiCredentials({ openai_api_key: "new-openai" });

  assert.deepEqual(session, {
    openai_api_key: "new-openai",
    elevenlabs_api_key: "existing-eleven",
  });
  assert.deepEqual(local, { openai_api_key: "new-openai", elevenlabs_api_key: "existing-eleven" });
});
