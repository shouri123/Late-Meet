// Shared TypeScript Interfaces for Late Meet

export interface Topic {
  name: string;
  status: "active" | "completed" | "unresolved";
  duration?: string;
  startTime?: string;
}

export interface TranscriptEntry {
  id?: string;
  speaker: string;
  text: string;
  timestamp: number;
  timestampLabel?: string;
}

export interface TimelineEvent {
  event: string;
  timestamp: number;
  elapsed: number;
}

export interface SummaryItem {
  text: string;
  chunkId?: string;
  timestamp?: string;
  timestampLabel?: string;
}

export interface Decision {
  text: string;
  by?: string;
  chunkId?: string;
  timestamp?: string;
  timestampLabel?: string;
  classification?: "tentative" | "finalized";
}

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

export interface KeyInsight {
  text: string;
  confidenceScore: number;
}

export interface Contradiction {
  issue: string;
  persists: boolean;
}

export interface State {
  id?: string;
  savedAt?: string | number;
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
  participantCount?: number;
}

export interface MeetingStorageInfo {
  id: string;
  title: string;
  date: string;
  totalBytes: number;
  transcriptBytes: number;
  summaryBytes: number;
  actionItemBytes: number;
}

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
