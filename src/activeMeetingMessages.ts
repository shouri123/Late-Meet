import { getMeetingIdFromUrl } from "./meetingTabs";

interface ActiveMeetingMessageSource {
  senderTabId?: number;
  senderUrl?: string;
  targetTabId?: number | null;
  meetingId?: string | null;
}

export function isMessageFromActiveMeeting({
  senderTabId,
  senderUrl,
  targetTabId,
  meetingId,
}: ActiveMeetingMessageSource): boolean {
  if (senderTabId === undefined || targetTabId == null || senderTabId !== targetTabId) {
    return false;
  }

  const senderMeetingId = getMeetingIdFromUrl(senderUrl);
  if (!senderMeetingId) return false;

  return !meetingId || meetingId === "unknown" || senderMeetingId === meetingId;
}
