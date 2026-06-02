export interface MeetTabSelection {
  tab: chrome.tabs.Tab;
  meetingId: string;
  meetingUrl: string;
}

const MEET_TAB_URL = "https://meet.google.com/*";

/** Validates the standard Google Meet room ID format: three letters, four letters, three letters separated by dashes. */
const MEET_ID_REGEX = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

export function getMeetingIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "meet.google.com") return null;

    const meetingId = parsed.pathname.split("/").filter(Boolean)[0];
    if (!meetingId || meetingId === "new") return null;

    if (!MEET_ID_REGEX.test(meetingId)) return null;

    return meetingId;
  } catch {
    return null;
  }
}

function toMeetTabSelection(tab: chrome.tabs.Tab | undefined): MeetTabSelection | null {
  const meetingId = getMeetingIdFromUrl(tab?.url);
  if (!tab || tab.id === undefined || !meetingId || !tab.url) return null;

  return {
    tab,
    meetingId,
    meetingUrl: tab.url,
  };
}

export async function resolveManualMeetTab(): Promise<MeetTabSelection> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeMeetTab = toMeetTabSelection(activeTab);
  if (activeMeetTab) return activeMeetTab;

  const meetTabs = (await chrome.tabs.query({ url: MEET_TAB_URL }))
    .map(toMeetTabSelection)
    .filter((tab): tab is MeetTabSelection => Boolean(tab));

  if (meetTabs.length === 0) {
    throw new Error("No Google Meet tab found. Join a meeting first.");
  }

  if (meetTabs.length === 1) {
    return meetTabs[0];
  }

  throw new Error("Multiple Meet tabs are open. Switch to the meeting tab and start again.");
}

export async function resolveDetectedMeetTab(): Promise<MeetTabSelection | null> {
  try {
    return await resolveManualMeetTab();
  } catch {
    return null;
  }
}
