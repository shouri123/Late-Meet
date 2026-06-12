// Shared TypeScript Interfaces for Late Meet

/** Represents a discussion topic tracked during a meeting. */
export interface Topic {
  name: string;
  status: "active" | "completed" | "unresolved";
  duration?: string;
  startTime?: string;
}

/** A single entry in the live meeting transcript. */
export interface TranscriptEntry {
  id?: string;
  speaker: string;
  text: string;
  timestamp: number;
  timestampLabel?: string;
}

/** A timestamped event recorded on the meeting timeline. */
export interface TimelineEvent {
  event: string;
  timestamp: number;
  elapsed: number;
}

/** A chunk of summarized meeting content, optionally linked to a transcript chunk. */
export interface SummaryItem {
  text: string;
  chunkId?: string;
  timestamp?: string;
  timestampLabel?: string;
}

/** A decision made during the meeting, with optional attribution and classification. */
export interface Decision {
  text: string;
  by?: string;
  chunkId?: string;
  timestamp?: string;
  timestampLabel?: string;
  classification?: "tentative" | "finalized";
}

/** An action item extracted from the meeting, with optional owner, deadline, and confidence. */
export interface ActionItem {
  task: string;
  owner?: string;
  deadline?: string;
  chunkId?: string;
  timestamp?: string;
  timestampLabel?: string;
  confidence?: "high" | "medium" | "low";
  isSpeculative?: boolean;
}

/** A key insight surfaced from the meeting along with a confidence score. */
export interface KeyInsight {
  text: string;
  confidenceScore: number;
}

/** A detected contradiction or unresolved conflict from the meeting discussion. */
export interface Contradiction {
  issue: string;
  persists: boolean;
}

/** Full application state for an active or saved meeting session. */
export interface State {
  id?: string;
  savedAt?: number;
  isActive: boolean;
  meetingId: string | null;
  meetingUrl: string | null;
  startTime: number | null;
  summary: string;
  topics: Topic[];
  decisions: Decision[];
  actionItems: ActionItem[];
  currentTopic: string;
  sentiment: string;
  keyInsights: KeyInsight[];
  unresolvedDiscussions: string[];
  contradictions: Contradiction[];
  questionsRaised: string[];
  participants: string[];
  initialParticipants: string[];
  lateJoiners: string[];
  timeline: TimelineEvent[];
  transcript: TranscriptEntry[];
  summaryItems: SummaryItem[];
  audioActive: boolean;
  currentSpeaker?: string | null;
  targetTabId?: number | null;
  lastSummarizedAt?: number;
  duration?: number;
  pendingJoiners?: string[];
  participantCount?: number;
  /** Tracks original array lengths before truncation for UI indicators. */
  truncatedCounts?: Record<string, number>;
}

/** Storage metadata summary for a single saved meeting, used in storage usage reports. */
export interface MeetingStorageInfo {
  id: string;
  title: string;
  date: string;
  totalBytes: number;
  transcriptBytes: number;
  summaryBytes: number;
  actionItemBytes: number;
}

/** Aggregated statistics about extension storage usage across all saved meetings. */
export interface StorageStats {
  totalBytes: number;
  quotaBytes: number;
  percentUsed: number;
  transcriptBytes: number;
  summaryBytes: number;
  actionItemBytes: number;
  settingsBytes: number;
  meetingCount: number;
  largestMeetings: MeetingStorageInfo[];
  warningThreshold: number;
}

// ============================================================
// Storage Types — for type-safe chrome.storage operations
// ============================================================

/** A single meeting session stored by the extension */
export interface MeetingSession {
  id: string;
  tabId: number;
  meetingUrl: string;
  meetingTitle: string;
  startTime: number; // Unix timestamp (ms)
  endTime: number | null; // null if recording is still active
  durationMs: number | null;
  participants: string[];
  transcript: StoredTranscriptEntry[];
  summary: string | null;
  language: string; // BCP 47 language tag (e.g., "en-US")
  schemaVersion: number; // For migration support
}

/** A single transcript entry with speaker, text, and confidence (stored form) */
export interface StoredTranscriptEntry {
  speaker: string;
  text: string;
  timestamp: number; // Offset from meeting start in ms
  confidence?: number; // 0.0 to 1.0
}

/** Root schema for chrome.storage.local */
export interface StorageSchema {
  apiKey: string | null;
  encryptedApiKey: string | null;
  sessions: MeetingSession[];
  preferences: ExtensionPreferences;
  schemaVersion: number;
}

/** User preferences for the extension */
export interface ExtensionPreferences {
  autoStart: boolean;
  language: string;
  showTranscriptInMeeting: boolean;
  summaryStyle: "brief" | "detailed" | "bullets";
  theme: "light" | "dark" | "system";
}
