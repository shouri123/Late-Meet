import { State } from "./types";

export const PENDING_SESSION_KEY = "pendingSession";
export const SAVED_SESSIONS_LEGACY_KEY = "savedSessions";
export const SAVED_SESSION_INDEX_KEY = "savedSessionIndex";
export const MAX_SAVED_SESSIONS = 20;
export const STORAGE_SOFT_LIMIT_BYTES = 8_500_000;

export type StoredSession = State & {
  id: string;
  savedAt: number;
  duration?: number;
};

type StorageArea = Pick<chrome.storage.StorageArea, "get" | "set" | "remove"> & {
  getBytesInUse?: chrome.storage.StorageArea["getBytesInUse"];
};

/**
 * Normalizes a raw timestamp value to a numeric Unix millisecond timestamp.
 * Accepts numbers directly, numeric strings, and ISO date strings. Returns
 * `null` when the value cannot be converted to a finite number.
 * @param value - The raw timestamp to normalize.
 * @returns A finite numeric timestamp, or `null` if conversion fails.
 */
function normalizeTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  if (Number.isFinite(parsed)) return parsed;

  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Coerces an unknown value to a `StoredSession` if it has the required fields,
 * normalizing the `savedAt` timestamp in the process. Returns `null` when the
 * value does not conform to the expected shape.
 * @param value - The raw value to validate and coerce.
 * @returns A `StoredSession` object or `null`.
 */
function asStoredSession(value: unknown): StoredSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Partial<StoredSession> & { savedAt?: unknown };
  if (typeof session.id !== "string" || session.id.trim() === "") {
    return null;
  }
  const savedAt = normalizeTimestamp(session.savedAt);
  if (savedAt === null) {
    return null;
  }
  if (session.duration !== undefined && typeof session.duration !== "number") {
    return null;
  }
  if (session.transcript !== undefined && !Array.isArray(session.transcript)) {
    return null;
  }
  if (session.timeline !== undefined && !Array.isArray(session.timeline)) {
    return null;
  }
  return { ...session, savedAt } as StoredSession;
}

/**
 * Returns the chrome storage key used to store a specific session's payload.
 * @param sessionId - The unique session identifier.
 * @returns A storage key string of the form `savedSession:<sessionId>`.
 */
export function getSavedSessionKey(sessionId: string): string {
  return `savedSession:${sessionId}`;
}

/**
 * Estimates the serialized byte size of a value using `JSON.stringify` and
 * UTF-8 encoding via `TextEncoder`.
 * @param value - Any serializable value to measure.
 * @returns The estimated byte count.
 */
export function estimateStorageBytes(value: unknown): number {
  const serialized = JSON.stringify(value ?? null);
  return new TextEncoder().encode(serialized).byteLength;
}

/**
 * Checks whether an error originates from a storage quota violation.
 * @param err - The caught error or unknown value to inspect.
 * @returns `true` if the error message matches known quota-related patterns.
 */
export function isStorageQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err || "");
  return /quota|QUOTA_BYTES|storage/i.test(message);
}

/**
 * Creates a lightweight session list item by stripping the transcript and
 * timeline arrays from a full session object, suitable for the session index.
 * @param session - The full `StoredSession` to summarize.
 * @returns A copy of `session` with empty `transcript` and `timeline` arrays.
 */
export function createSessionListItem(session: StoredSession): StoredSession {
  return {
    ...session,
    transcript: [],
    timeline: [],
  };
}

/**
 * Inserts or replaces a session in the index array, keeping at most
 * `maxSessions` entries (newest first).
 * @param index - The current ordered list of session summaries.
 * @param session - The session to upsert.
 * @param maxSessions - Maximum number of sessions to retain. Defaults to `MAX_SAVED_SESSIONS`.
 * @returns A new array with the upserted session at the front, capped at `maxSessions`.
 */
export function upsertSessionIndex(
  index: StoredSession[],
  session: StoredSession,
  maxSessions = MAX_SAVED_SESSIONS,
): StoredSession[] {
  return [createSessionListItem(session), ...index.filter((item) => item.id !== session.id)].slice(
    0,
    maxSessions,
  );
}

/**
 * Returns the number of bytes currently used in the given storage area for the
 * specified keys. Falls back to `0` when `getBytesInUse` is not available.
 * @param storage - The storage area to query.
 * @param keys - A key or array of keys to measure, or `null` for all keys.
 * @returns A promise resolving to the byte count.
 */
async function getBytesInUse(storage: StorageArea, keys?: string | string[] | null) {
  if (!storage.getBytesInUse) return 0;
  try {
    return await storage.getBytesInUse(keys ?? null);
  } catch (err) {
    console.warn("[SessionStorage] Failed to get bytes in use:", err);
    return 0;
  }
}

/**
 * Removes the full payload entries for the given sessions from storage.
 * @param storage - The storage area to modify.
 * @param sessions - Sessions whose payload keys should be deleted.
 */
async function removeSessionPayloads(storage: StorageArea, sessions: StoredSession[]) {
  const keys = sessions.map((session) => getSavedSessionKey(session.id));
  if (keys.length > 0) {
    await storage.remove(keys);
  }
}

/**
 * Prunes the session index until the combined storage usage of existing and
 * incoming data stays within `STORAGE_SOFT_LIMIT_BYTES`. Removed session
 * payloads are deleted from storage immediately.
 * @param storage - The storage area to inspect and mutate.
 * @param index - The current ordered list of session summaries.
 * @param incomingBytes - Estimated byte size of the data about to be written.
 * @returns A promise resolving to the pruned session index.
 */
async function pruneSessionsForQuota(
  storage: StorageArea,
  index: StoredSession[],
  incomingBytes: number,
) {
  const nextIndex = [...index];
  const pruned: StoredSession[] = [];

  while (nextIndex.length > MAX_SAVED_SESSIONS - 1) {
    const session = nextIndex.pop();
    if (session) pruned.push(session);
  }

  // Measure only session-related keys, not all of chrome.storage.local
  const sessionKeys = [SAVED_SESSION_INDEX_KEY, ...nextIndex.map((s) => getSavedSessionKey(s.id))];
  let currentBytes = await getBytesInUse(storage, sessionKeys);
  while (
    currentBytes > 0 &&
    currentBytes + incomingBytes > STORAGE_SOFT_LIMIT_BYTES &&
    nextIndex.length > 0
  ) {
    const session = nextIndex.pop();
    if (!session) break;

    const key = getSavedSessionKey(session.id);
    const payloadBytes = await getBytesInUse(storage, key);
    pruned.push(session);
    currentBytes = Math.max(0, currentBytes - payloadBytes);
  }

  if (pruned.length > 0) {
    await removeSessionPayloads(storage, pruned);
  }

  return nextIndex;
}

/**
 * Saves a session as the current pending (in-progress) meeting session so it
 * can be committed later via `persistPendingMeetingSession`.
 * @param storage - The storage area to write to.
 * @param session - The session data to store as pending.
 */
export async function savePendingMeetingSession(
  storage: StorageArea,
  session: StoredSession,
): Promise<void> {
  await storage.set({ [PENDING_SESSION_KEY]: session });
}

/**
 * Reads the pending session from storage, persists it to the saved session
 * index, and clears the pending slot. Throws if no pending session exists.
 * @param storage - The storage area to read from and write to.
 * @returns A promise resolving to the now-persisted `StoredSession`.
 */
export async function persistPendingMeetingSession(storage: StorageArea): Promise<StoredSession> {
  const values = await storage.get([
    PENDING_SESSION_KEY,
    SAVED_SESSION_INDEX_KEY,
    SAVED_SESSIONS_LEGACY_KEY,
  ]);
  const pendingSession = asStoredSession(values[PENDING_SESSION_KEY]);

  if (!pendingSession) {
    throw new Error("No pending session found to save.");
  }

  const session = await persistMeetingSession(storage, pendingSession);
  await storage.set({ [PENDING_SESSION_KEY]: null });

  return session;
}

/**
 * Persists a meeting session to the saved session index, migrating any legacy
 * session data and pruning old entries when storage is near capacity. No-ops if
 * the session is already present in the index.
 * @param storage - The storage area to read from and write to.
 * @param pendingSession - The session to persist.
 * @returns A promise resolving to the persisted `StoredSession`.
 */
export async function persistMeetingSession(
  storage: StorageArea,
  pendingSession: StoredSession,
): Promise<StoredSession> {
  const values = await storage.get([SAVED_SESSION_INDEX_KEY, SAVED_SESSIONS_LEGACY_KEY]);
  const legacySessions = Array.isArray(values[SAVED_SESSIONS_LEGACY_KEY])
    ? (values[SAVED_SESSIONS_LEGACY_KEY].map(asStoredSession).filter(Boolean) as StoredSession[])
    : [];
  const indexedSessions = Array.isArray(values[SAVED_SESSION_INDEX_KEY])
    ? (values[SAVED_SESSION_INDEX_KEY].map(asStoredSession).filter(Boolean) as StoredSession[])
    : [];
  const currentIndex =
    indexedSessions.length > 0 ? indexedSessions : legacySessions.map(createSessionListItem);

  const sessionKey = getSavedSessionKey(pendingSession.id);
  const incomingBytes = estimateStorageBytes({
    [sessionKey]: pendingSession,
    [SAVED_SESSION_INDEX_KEY]: upsertSessionIndex(currentIndex, pendingSession),
  });
  let prunedIndex = currentIndex;
  try {
    prunedIndex = await pruneSessionsForQuota(storage, currentIndex, incomingBytes);
  } catch (err) {
    console.error("[SessionStorage] Failed to prune sessions for quota:", err);
  }
  const nextIndex = upsertSessionIndex(prunedIndex, pendingSession);

  await storage.set({
    [sessionKey]: pendingSession,
    [SAVED_SESSION_INDEX_KEY]: nextIndex,
  });

  // One-time cleanup: remove legacy sessions key after successful migration
  if (Array.isArray(values[SAVED_SESSIONS_LEGACY_KEY])) {
    await storage.remove(SAVED_SESSIONS_LEGACY_KEY);
  }

  return pendingSession;
}

/**
 * Clears the pending meeting session from storage without persisting it.
 * @param storage - The storage area to modify.
 */
export async function discardPendingMeetingSession(storage: StorageArea): Promise<void> {
  await storage.set({ [PENDING_SESSION_KEY]: null });
}

/**
 * Retrieves all saved meeting sessions from the session index, falling back to
 * the legacy sessions list if the index is empty.
 * @param storage - The storage area to read from.
 * @returns A promise resolving to an array of `StoredSession` objects.
 */
export async function getSavedMeetingSessions(storage: StorageArea): Promise<StoredSession[]> {
  const values = await storage.get([SAVED_SESSION_INDEX_KEY, SAVED_SESSIONS_LEGACY_KEY]);
  const indexedSessions = Array.isArray(values[SAVED_SESSION_INDEX_KEY])
    ? (values[SAVED_SESSION_INDEX_KEY].map(asStoredSession).filter(Boolean) as StoredSession[])
    : [];

  if (indexedSessions.length > 0) {
    return indexedSessions;
  }

  return Array.isArray(values[SAVED_SESSIONS_LEGACY_KEY])
    ? (values[SAVED_SESSIONS_LEGACY_KEY].map(asStoredSession).filter(Boolean) as StoredSession[])
    : [];
}

/**
 * Retrieves a single saved meeting session by its ID, checking the indexed
 * store first and then the legacy sessions list.
 * @param storage - The storage area to read from.
 * @param sessionId - The unique identifier of the session to fetch.
 * @returns A promise resolving to the `StoredSession`, or `null` if not found.
 */
export async function getSavedMeetingSession(
  storage: StorageArea,
  sessionId: string,
): Promise<StoredSession | null> {
  const sessionKey = getSavedSessionKey(sessionId);
  const values = await storage.get([sessionKey, SAVED_SESSIONS_LEGACY_KEY]);
  const indexedSession = asStoredSession(values[sessionKey]);
  if (indexedSession) return indexedSession;

  const legacySessions = Array.isArray(values[SAVED_SESSIONS_LEGACY_KEY])
    ? (values[SAVED_SESSIONS_LEGACY_KEY].map(asStoredSession).filter(Boolean) as StoredSession[])
    : [];

  return legacySessions.find((session) => session.id === sessionId) ?? null;
}

/**
 * Deletes a saved meeting session from both the session index and the legacy
 * sessions list, and removes its payload from storage.
 * @param storage - The storage area to modify.
 * @param sessionId - The unique identifier of the session to delete.
 */
export async function deleteSavedMeetingSession(
  storage: StorageArea,
  sessionId: string,
): Promise<void> {
  const values = await storage.get([SAVED_SESSION_INDEX_KEY, SAVED_SESSIONS_LEGACY_KEY]);
  const indexedSessions = Array.isArray(values[SAVED_SESSION_INDEX_KEY])
    ? (values[SAVED_SESSION_INDEX_KEY].map(asStoredSession).filter(Boolean) as StoredSession[])
    : [];
  const hadLegacy = Array.isArray(values[SAVED_SESSIONS_LEGACY_KEY]);

  await storage.remove(getSavedSessionKey(sessionId));

  const update: Record<string, unknown> = {
    [SAVED_SESSION_INDEX_KEY]: indexedSessions.filter((session) => session.id !== sessionId),
  };
  // Only rewrite the legacy key when it actually exists, so deleting a session
  // doesn't resurrect the `savedSessions` key removed during migration (#677).
  if (hadLegacy) {
    update[SAVED_SESSIONS_LEGACY_KEY] = (
      values[SAVED_SESSIONS_LEGACY_KEY] as Partial<StoredSession>[]
    ).filter((session) => session.id !== sessionId);
  }
  await storage.set(update);
}

export async function deleteMultipleSavedMeetingSessions(
  storage: StorageArea,
  sessionIds: string[],
): Promise<void> {
  if (!Array.isArray(sessionIds) || sessionIds.length === 0) return;

  const values = await storage.get([SAVED_SESSION_INDEX_KEY, SAVED_SESSIONS_LEGACY_KEY]);
  const indexedSessions = Array.isArray(values[SAVED_SESSION_INDEX_KEY])
    ? (values[SAVED_SESSION_INDEX_KEY].map(asStoredSession).filter(Boolean) as StoredSession[])
    : [];
  const hadLegacy = Array.isArray(values[SAVED_SESSIONS_LEGACY_KEY]);

  // Remove payload keys
  const keys = sessionIds.map((id) => getSavedSessionKey(id));
  await storage.remove(keys);

  // Update index(s)
  const nextIndex = indexedSessions.filter((s) => !sessionIds.includes(s.id));

  const update: Record<string, unknown> = { [SAVED_SESSION_INDEX_KEY]: nextIndex };
  // Only rewrite the legacy key when it actually exists (#677).
  if (hadLegacy) {
    update[SAVED_SESSIONS_LEGACY_KEY] = (
      values[SAVED_SESSIONS_LEGACY_KEY] as Partial<StoredSession>[]
    ).filter((s) => !sessionIds.includes(s.id as string));
  }
  await storage.set(update);
}

export async function deleteAllSavedMeetingSessions(storage: StorageArea): Promise<void> {
  const values = await storage.get([SAVED_SESSION_INDEX_KEY, SAVED_SESSIONS_LEGACY_KEY]);
  const indexedSessions = Array.isArray(values[SAVED_SESSION_INDEX_KEY])
    ? (values[SAVED_SESSION_INDEX_KEY].map(asStoredSession).filter(Boolean) as StoredSession[])
    : [];
  const hadLegacy = Array.isArray(values[SAVED_SESSIONS_LEGACY_KEY]);
  const legacySessions = hadLegacy
    ? ((values[SAVED_SESSIONS_LEGACY_KEY] as unknown[])
        .map(asStoredSession)
        .filter(Boolean) as StoredSession[])
    : [];

  const allIds = [...indexedSessions, ...legacySessions].map((s) => s.id);
  const keys = allIds.map((id) => getSavedSessionKey(id));
  if (keys.length > 0) await storage.remove(keys);

  await storage.set({ [SAVED_SESSION_INDEX_KEY]: [] });
  // Drop the migrated legacy key when present rather than resurrecting it as [] (#677).
  if (hadLegacy) {
    await storage.remove(SAVED_SESSIONS_LEGACY_KEY);
  }
}

/**
 * Writes a value to `chrome.storage.local` under the given key.
 * Errors (including quota errors) are rethrown so callers can detect and react
 * to them — e.g. using `isStorageQuotaError` to identify quota exhaustion.
 * @param key - The storage key to write to.
 * @param value - The value to store.
 */
export async function safeLocalStore(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}
