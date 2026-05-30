export type CredentialKey = "openai_api_key" | "elevenlabs_api_key";

export interface ApiCredentials {
  openai_api_key?: string;
  elevenlabs_api_key?: string;
}

const CREDENTIAL_KEYS: CredentialKey[] = ["openai_api_key", "elevenlabs_api_key"];

function normalizedCredential(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function getApiCredentials(): Promise<ApiCredentials> {
  const [sessionCredentials, localCredentials] = await Promise.all([
    chrome.storage.session.get(CREDENTIAL_KEYS),
    chrome.storage.local.get(CREDENTIAL_KEYS),
  ]);

  const credentials: ApiCredentials = {};
  const sessionSync: ApiCredentials = {};

  for (const key of CREDENTIAL_KEYS) {
    const sessionValue = normalizedCredential(sessionCredentials[key]);
    const localValue = normalizedCredential(localCredentials[key]);
    const resolvedValue = sessionValue || localValue;

    if (resolvedValue) {
      credentials[key] = resolvedValue;
    }

    if (!sessionValue && localValue) {
      sessionSync[key] = localValue;
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

  const operations: Promise<unknown>[] = [];

  if (Object.keys(saveData).length > 0) {
    operations.push(chrome.storage.session.set(saveData), chrome.storage.local.set(saveData));
  }

  if (removeKeys.length > 0) {
    operations.push(
      chrome.storage.session.remove(removeKeys),
      chrome.storage.local.remove(removeKeys),
    );
  }

  await Promise.all(operations);
}
