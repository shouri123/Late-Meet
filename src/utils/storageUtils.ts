import { getSavedMeetingSession, getSavedMeetingSessions } from "../sessionStorage";
import { StorageStats, MeetingStorageInfo } from "../types";

const DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024; // 10MB — chrome.storage.local default
const DEFAULT_WARNING_THRESHOLD = 80;

function roughBytes(value: unknown): number {
  return new Blob([JSON.stringify(value)]).size;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function getStorageStats(): Promise<StorageStats> {
  const sessionListItems = await getSavedMeetingSessions(chrome.storage.local);
  const sessions = await Promise.all(
    sessionListItems.map(async (session) => {
      return (await getSavedMeetingSession(chrome.storage.local, session.id)) ?? session;
    }),
  );

  // Get everything in local storage to also measure settings + API keys
  const allItems = await chrome.storage.local.get(null);

  // --- Per-category byte counting ---
  let transcriptBytes = 0;
  let summaryBytes = 0;
  let actionItemBytes = 0;
  let settingsBytes = 0;

  // Settings keys used in background.ts:
  //   "settings"         → getSettings()
  //   "openai_api_key"   → getApiKey()
  //   "elevenlabs_api_key" → transcribeChunk()
  const SETTINGS_KEYS = new Set(["settings", "openai_api_key", "elevenlabs_api_key"]);

  for (const [key, value] of Object.entries(allItems)) {
    if (SETTINGS_KEYS.has(key)) {
      settingsBytes += roughBytes(value);
    }
    // Session-related keys are measured per-session below
  }

  // Per-session breakdown using the StoredSession shape from sessionStorage.ts
  const meetingInfos: MeetingStorageInfo[] = sessions.map((session) => {
    const tBytes = roughBytes(session.transcript ?? []);
    const sBytes = roughBytes(session.summary ?? "");
    const aBytes = roughBytes(session.actionItems ?? []);
    const total = roughBytes(session); // whole session object

    transcriptBytes += tBytes;
    summaryBytes += sBytes;
    actionItemBytes += aBytes;

    // Use meetingId or id, and format the date from savedAt
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

  // Sort largest first, keep top 5 for the dashboard list
  meetingInfos.sort((a, b) => b.totalBytes - a.totalBytes);

  // Use getBytesInUse for the most accurate total (it measures actual storage overhead)
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

// Reuse the existing deleteSavedMeetingSession from sessionStorage.ts
export { deleteSavedMeetingSession } from "../sessionStorage";
