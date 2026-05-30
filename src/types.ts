// Shared TypeScript Interfaces for Late Meet

export interface Topic {
  name: string;
  status: "active" | "completed" | "unresolved";
  duration?: string;
  startTime?: string;
}

export interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: number;
}

export interface TimelineEvent {
  event: string;
  timestamp: number;
  elapsed: number;
}

export interface Decision {
  text: string;
  by?: string;
  timestamp?: string;
  classification?: "tentative" | "finalized";
}

export interface ActionItem {
  task: string;
  owner?: string;
  deadline?: string;
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
  audioActive: boolean;
  currentSpeaker?: string | null;
  targetTabId?: number | null;
  lastSummarizedAt?: number;
  duration?: number;
  participantCount?: number;
  id?: string;
  savedAt?: number;
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
