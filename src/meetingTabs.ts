export interface MeetTabSelection {
  tab: chrome.tabs.Tab;
  meetingId: string;
  meetingUrl: string;
}

const MEET_ID_REGEX = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;
const ZOOM_ID_REGEX = /^[0-9]{9,12}$/;

export function getMeetingIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    // Google Meet
    if (parsed.hostname === "meet.google.com") {
      const meetingId = parsed.pathname.split("/").filter(Boolean)[0];
      if (!meetingId || meetingId === "new") return null;
      if (!MEET_ID_REGEX.test(meetingId)) return null;
      return meetingId;
    }

    // Zoom Web Client
    if (parsed.hostname === "zoom.us" || parsed.hostname.endsWith(".zoom.us")) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.includes("wc")) {
        const meetingId = segments.find((seg) => ZOOM_ID_REGEX.test(seg));
        if (meetingId) return meetingId;
      }
    }

    return null;
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

  const meetQuery = chrome.tabs.query({ url: "https://meet.google.com/*" });
  const zoomQuery1 = chrome.tabs.query({ url: "https://*.zoom.us/wc/*" });
  const zoomQuery2 = chrome.tabs.query({ url: "https://zoom.us/wc/*" });

  const [meetTabsList, zoomTabsList1, zoomTabsList2] = await Promise.all([
    meetQuery,
    zoomQuery1,
    zoomQuery2,
  ]);

  const allTabs = [...meetTabsList, ...zoomTabsList1, ...zoomTabsList2];
  const uniqueTabs = Array.from(new Map(allTabs.map((t) => [t.id, t])).values());

  const meetTabs = uniqueTabs
    .map(toMeetTabSelection)
    .filter((tab): tab is MeetTabSelection => Boolean(tab));

  if (meetTabs.length === 0) {
    throw new Error("No Google Meet or Zoom tab found. Join a meeting first.");
  }

  if (meetTabs.length === 1) {
    return meetTabs[0];
  }

  throw new Error(
    "Multiple Meet or Zoom tabs are open. Switch to the meeting tab and start again.",
  );
}

export async function resolveDetectedMeetTab(): Promise<MeetTabSelection | null> {
  try {
    return await resolveManualMeetTab();
  } catch {
    return null;
  }
}
