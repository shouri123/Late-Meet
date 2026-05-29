import { MeetTabSelection } from "./meetingTabs";

export interface DashboardCaptureStartPayload {
  tabId: number;
  meetingId: string;
  meetingUrl: string | null;
  streamId: string;
  includeMicrophone: boolean;
}

export interface DashboardCaptureStartResponse {
  success?: boolean;
  error?: string;
}

export interface DashboardCaptureStartResult {
  meetingId: string;
  response: DashboardCaptureStartResponse;
}

interface DashboardCaptureStartOptions {
  resolveMeetTab: () => Promise<MeetTabSelection>;
  getMediaStreamId: (tabId: number) => Promise<string>;
  requestMicrophonePermission: () => Promise<boolean>;
  startAudioCapture: (
    payload: DashboardCaptureStartPayload,
  ) => Promise<DashboardCaptureStartResponse>;
}

export async function startDashboardAudioCapture({
  resolveMeetTab,
  getMediaStreamId,
  requestMicrophonePermission,
  startAudioCapture,
}: DashboardCaptureStartOptions): Promise<DashboardCaptureStartResult> {
  const { tab: meetTab, meetingId, meetingUrl } = await resolveMeetTab();

  if (meetTab.id === undefined) {
    throw new Error("Target Meet tab is missing an id");
  }

  const streamId = await getMediaStreamId(meetTab.id);

  if (!streamId) {
    throw new Error('Capture permission denied. Try clicking "Start Audio" again.');
  }

  try {
    await requestMicrophonePermission();
  } catch {
    // Microphone capture is optional; the offscreen document can still record tab audio.
  }

  const response = await startAudioCapture({
    tabId: meetTab.id,
    meetingId,
    meetingUrl: meetingUrl || meetTab.url || null,
    streamId,
    includeMicrophone: true,
  });

  if (!response?.success) {
    throw new Error(response?.error || "Failed to start audio");
  }

  return { meetingId, response };
}
