// Shared TypeScript Interfaces for Late Meet

export interface Topic {
  name: string;
  status: "active" | "completed";
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
}

export interface ActionItem {
  task: string;
  owner?: string;
  deadline?: string;
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
  keyInsights: string[];
  questionsRaised: string[];
  participants: string[];
  initialParticipants: string[];
  lateJoiners: string[];
  timeline: TimelineEvent[];
  transcript: TranscriptEntry[];
  audioActive: boolean;
  targetTabId?: number | null;
  lastSummarizedAt?: number;
  duration?: number;
  pendingJoiners?: any;
  participantCount?: number;
  id?: string;
  savedAt?: number;
}
