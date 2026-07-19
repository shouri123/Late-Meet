import { StorageStats, MeetingStorageInfo } from "../types";

const DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024; // 10MB — chrome.storage.local default
const DEFAULT_WARNING_THRESHOLD = 80;

/**
 * Estimates the serialized byte size of an arbitrary value.
 *
 * Uses `JSON.stringify` + `Blob` to approximate how much space the value
 * occupies in `chrome.storage.local`. This is an estimation, not the exact
 * storage overhead, but is accurate enough for quota-monitoring purposes.
 *
 * @param value - Any JSON-serializable value.
 * @returns Estimated byte count as a number.
 */
function roughBytes(value: unknown): number {
  return new Blob([JSON.stringify(value)]).size;
}

/**
 * Converts a raw byte count into a human-readable size string.
 *
 * Selects the most appropriate unit (B, KB, or MB) based on magnitude:
 * - Values under 1 024 bytes → `"N B"`
 * - Values under 1 MiB → `"N.N KB"` (one decimal place)
 * - Values ≥ 1 MiB → `"N.NN MB"` (two decimal places)
 *
 * @param bytes - Non-negative byte count to format.
 * @returns A formatted string such as `"512 B"`, `"3.4 KB"`, or `"1.25 MB"`.
 *
 * @example
 * formatBytes(0);        // "0 B"
 * formatBytes(1500);     // "1.5 KB"
 * formatBytes(2097152);  // "2.00 MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Computes a comprehensive snapshot of `chrome.storage.local` usage.
 *
 * Reads the entire local storage area in a single call and categorises
 * usage into transcripts, summaries, action items, and settings. Also
 * builds a per-meeting breakdown, sorted largest-first.
 *
 * Storage topology supported:
 * - **Indexed sessions** – a `savedSessionIndex` array whose entries each
 *   have a corresponding `savedSession:<id>` key holding the full session.
 * - **Legacy sessions** – a flat `savedSessions` array (older format).
 *
 * The `totalBytes` field is sourced from `chrome.storage.local.getBytesInUse`
 * when available (most accurate), falling back to summing `roughBytes` across
 * all keys.
 *
 * @returns A {@link StorageStats} object containing total/quota bytes,
 *   per-category byte counts, meeting count, and the five largest meetings.
 *
 * @example
 * const stats = await getStorageStats();
 * console.log(`${stats.percentUsed}% of quota used`);
 * console.log(formatBytes(stats.transcriptBytes) + " in transcripts");
 */
export async function getStorageStats(): Promise<StorageStats> {
  // Get everything in local storage in a single query to also measure settings + API keys
  const allItems = await chrome.storage.local.get(null);

  // Extract saved sessions using the index and legacy lists from allItems
  const SAVED_SESSION_INDEX_KEY = "savedSessionIndex";
  const SAVED_SESSIONS_LEGACY_KEY = "savedSessions";

  const indexedSessions = Array.isArray(allItems[SAVED_SESSION_INDEX_KEY])
    ? allItems[SAVED_SESSION_INDEX_KEY]
    : [];

  const legacySessions = Array.isArray(allItems[SAVED_SESSIONS_LEGACY_KEY])
    ? allItems[SAVED_SESSIONS_LEGACY_KEY]
    : [];

  const sessionListItems = indexedSessions.length > 0 ? indexedSessions : legacySessions;

  const sessions = sessionListItems
    .map((session: any) => {
      if (!session || !session.id) return session;
      const key = `savedSession:${session.id}`;
      const fullSession = allItems[key];
      if (fullSession && typeof fullSession === "object") {
        return fullSession;
      }
      return session;
    })
    .filter(Boolean);

  // --- Per-category byte counting ---
  let transcriptBytes = 0;
  let summaryBytes = 0;
  let actionItemBytes = 0;
  let settingsBytes = 0;

  const SETTINGS_KEYS = new Set(["settings", "openai_api_key", "elevenlabs_api_key"]);

  for (const [key, value] of Object.entries(allItems)) {
    if (SETTINGS_KEYS.has(key)) {
      settingsBytes += roughBytes(value);
    }
  }

  // Per-session breakdown using the StoredSession shape from sessionStorage.ts
  const meetingInfos: MeetingStorageInfo[] = sessions.map((session) => {
    const tBytes = roughBytes(session.transcript ?? []);
    const sBytes = roughBytes(session.summary ?? "");
    const aBytes = roughBytes(session.actionItems ?? []);
    const total = roughBytes(session);

    transcriptBytes += tBytes;
    summaryBytes += sBytes;
    actionItemBytes += aBytes;

    const savedAt = session.savedAt ? new Date(session.savedAt) : null;
    const dateStr = savedAt
      ? savedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : "Unknown date";

    return {
      id: session.id,
      title: session.meetingId
        ? `Meeting — ${session.meetingId}`
        : `Session ${session.id.slice(0, 8)}`,
      date: dateStr,
      totalBytes: total,
      transcriptBytes: tBytes,
      summaryBytes: sBytes,
      actionItemBytes: aBytes,
    };
  });

  meetingInfos.sort((a, b) => b.totalBytes - a.totalBytes);

  const totalBytes = await new Promise<number>((resolve) => {
    if (chrome.storage.local.getBytesInUse) {
      chrome.storage.local.getBytesInUse(null, resolve);
    } else {
      resolve(Object.values(allItems).reduce((sum: number, v: unknown) => sum + roughBytes(v), 0));
    }
  });

  const quotaBytes = DEFAULT_QUOTA_BYTES;

  return {
    totalBytes,
    quotaBytes,
    percentUsed: Math.min(100, Math.round((totalBytes / quotaBytes) * 100)),
    transcriptBytes,
    summaryBytes,
    actionItemBytes,
    settingsBytes,
    meetingCount: sessions.length,
    largestMeetings: meetingInfos.slice(0, 5),
    warningThreshold: DEFAULT_WARNING_THRESHOLD,
  };
}

// Reuse the existing delete helpers from sessionStorage.ts
export {
  deleteSavedMeetingSession,
  deleteMultipleSavedMeetingSessions,
  deleteAllSavedMeetingSessions,
} from "../sessionStorage";
