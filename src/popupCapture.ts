import { MeetTabSelection } from "./meetingTabs";

export interface PopupCaptureStartPayload {
  tabId: number;
  meetingId: string;
  meetingUrl: string | null;
  streamId: string;
  includeMicrophone: boolean;
}

export interface PopupCaptureStartResponse {
  success?: boolean;
  error?: string;
}

export interface PopupCaptureStartResult {
  meetingId: string;
  microphoneEnabled: boolean;
  response: PopupCaptureStartResponse;
}

interface PopupCaptureStartOptions {
  resolveMeetTab: () => Promise<MeetTabSelection>;
  getMediaStreamId: (tabId: number) => Promise<string>;
  requestMicrophonePermission: () => Promise<boolean>;
  startAudioCapture: (payload: PopupCaptureStartPayload) => Promise<PopupCaptureStartResponse>;
}

export async function startPopupAudioCapture({
  resolveMeetTab,
  getMediaStreamId,
  requestMicrophonePermission,
  startAudioCapture,
}: PopupCaptureStartOptions): Promise<PopupCaptureStartResult> {
  const { tab: meetTab, meetingId, meetingUrl } = await resolveMeetTab();

  if (meetTab.id === undefined) {
    throw new Error("Target Meet tab is missing an id");
  }

  const streamId = await getMediaStreamId(meetTab.id);

  if (!streamId) {
    throw new Error(
      "Capture permission denied. Try clicking the extension icon again on the Meet tab.",
    );
  }

  let microphoneEnabled: boolean;
  try {
    microphoneEnabled = await requestMicrophonePermission();
  } catch {
    microphoneEnabled = false;
  }

  const response = await startAudioCapture({
    tabId: meetTab.id,
    meetingId,
    meetingUrl: meetingUrl || meetTab.url || null,
    streamId,
    includeMicrophone: microphoneEnabled,
  });

  if (!response?.success) {
    throw new Error(response?.error || "Failed to start audio capture");
  }

  return { meetingId, microphoneEnabled, response };
}
