/**
 * Tab State Manager
 *
 * Persists recording/transcription state per Chrome tab.
 * Prevents state loss when users switch between multiple Meet tabs.
 */

export interface TabState {
  tabId: number;
  isRecording: boolean;
  startedAt: number | null;
  transcript: string[];
  meetingTitle: string;
}

const defaultState = (): Omit<TabState, "tabId"> => ({
  isRecording: false,
  startedAt: null,
  transcript: [],
  meetingTitle: "",
});

/** Get state for a specific tab */
export async function getTabState(tabId: number): Promise<TabState> {
  const key = `tab_state_${tabId}`;
  const result = await chrome.storage.session.get(key);
  return result[key] ?? { tabId, ...defaultState() };
}

/** Update state for a specific tab */
export async function setTabState(
  tabId: number,
  updates: Partial<Omit<TabState, "tabId">>
): Promise<void> {
  const key = `tab_state_${tabId}`;
  const current = await getTabState(tabId);
  await chrome.storage.session.set({
    [key]: { ...current, ...updates, tabId },
  });
}

/** Clear state for a specific tab (e.g., when tab closes) */
export async function clearTabState(tabId: number): Promise<void> {
  await chrome.storage.session.remove(`tab_state_${tabId}`);
}

/** Listen for tab close to clean up state */
export function initTabStateCleanup(): void {
  chrome.tabs.onRemoved.addListener((tabId) => {
    clearTabState(tabId).catch(console.error);
  });
}
