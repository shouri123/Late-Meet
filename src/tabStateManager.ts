import { State } from "./types";

/**
 * Tab State Manager
 *
 * Persists recording/transcription state per Chrome tab.
 * Prevents state loss when users switch between multiple Meet tabs.
 */

export interface TabState extends Partial<State> {
  tabId: number;
}

const defaultState = (): Omit<TabState, "tabId"> => ({
  audioActive: false,
  isActive: false,
  startTime: null,
  transcript: [],
});

/** Get state for a specific tab */
export async function getTabState(tabId: number): Promise<TabState> {
  const key = `tab_state_${tabId}`;
  const result = await chrome.storage.session.get(key);
  const stored = result[key];

  return {
    tabId,
    ...defaultState(),
    ...(stored && typeof stored === "object" ? stored : {}),
  } as TabState;
}
}

/** Update state for a specific tab */
export async function setTabState(
  tabId: number,
  updates: Partial<Omit<TabState, "tabId">>,
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
