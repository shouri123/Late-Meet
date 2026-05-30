import { State } from "./types";

export const PENDING_SESSION_KEY = "pendingSession";
export const SAVED_SESSIONS_LEGACY_KEY = "savedSessions";
export const SAVED_SESSION_INDEX_KEY = "savedSessionIndex";
export const MAX_SAVED_SESSIONS = 20;
export const STORAGE_SOFT_LIMIT_BYTES = 8_500_000;

export type StoredSession = State & {
  id: string;
  savedAt: number;
};

type StorageArea = Pick<chrome.storage.StorageArea, "get" | "set" | "remove"> & {
  getBytesInUse?: chrome.storage.StorageArea["getBytesInUse"];
};

function asStoredSession(value: unknown): StoredSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Partial<StoredSession>;
  if (!session.id || !session.savedAt) return null;
  return session as StoredSession;
}

export function getSavedSessionKey(sessionId: string): string {
  return `savedSession:${sessionId}`;
}

export function estimateStorageBytes(value: unknown): number {
  const serialized = JSON.stringify(value ?? null);
  return new TextEncoder().encode(serialized).byteLength;
}

export function isStorageQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err || "");
  return /quota|QUOTA_BYTES|storage/i.test(message);
}

export function createSessionListItem(session: StoredSession): StoredSession {
  return {
    ...session,
    transcript: [],
    timeline: [],
  };
}

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

async function getBytesInUse(storage: StorageArea, keys?: string | string[] | null) {
  if (!storage.getBytesInUse) return 0;
  return storage.getBytesInUse(keys ?? null);
}

async function removeSessionPayloads(storage: StorageArea, sessions: StoredSession[]) {
  const keys = sessions.map((session) => getSavedSessionKey(session.id));
  if (keys.length > 0) {
    await storage.remove(keys);
  }
}

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

  let currentBytes = await getBytesInUse(storage, null);
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

export async function savePendingMeetingSession(
  storage: StorageArea,
  session: StoredSession,
): Promise<void> {
  await storage.set({ [PENDING_SESSION_KEY]: session });
}

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

  if (currentIndex.some((session) => session.id === pendingSession.id)) {
    return pendingSession;
  }

  const sessionKey = getSavedSessionKey(pendingSession.id);
  const incomingBytes = estimateStorageBytes({
    [sessionKey]: pendingSession,
    [SAVED_SESSION_INDEX_KEY]: upsertSessionIndex(currentIndex, pendingSession),
  });
  const prunedIndex = await pruneSessionsForQuota(storage, currentIndex, incomingBytes);
  const nextIndex = upsertSessionIndex(prunedIndex, pendingSession);

  await storage.set({
    [sessionKey]: pendingSession,
    [SAVED_SESSION_INDEX_KEY]: nextIndex,
  });

  return pendingSession;
}

export async function discardPendingMeetingSession(storage: StorageArea): Promise<void> {
  await storage.set({ [PENDING_SESSION_KEY]: null });
}

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

export async function deleteSavedMeetingSession(
  storage: StorageArea,
  sessionId: string,
): Promise<void> {
  const values = await storage.get([SAVED_SESSION_INDEX_KEY, SAVED_SESSIONS_LEGACY_KEY]);
  const indexedSessions = Array.isArray(values[SAVED_SESSION_INDEX_KEY])
    ? (values[SAVED_SESSION_INDEX_KEY].map(asStoredSession).filter(Boolean) as StoredSession[])
    : [];
  const legacySessions = Array.isArray(values[SAVED_SESSIONS_LEGACY_KEY])
    ? values[SAVED_SESSIONS_LEGACY_KEY].filter(
        (session: Partial<StoredSession>) => session.id !== sessionId,
      )
    : [];

  await storage.remove(getSavedSessionKey(sessionId));
  await storage.set({
    [SAVED_SESSION_INDEX_KEY]: indexedSessions.filter((session) => session.id !== sessionId),
    [SAVED_SESSIONS_LEGACY_KEY]: legacySessions,
  });
}
