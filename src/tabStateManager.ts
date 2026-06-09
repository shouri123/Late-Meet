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

// Fallback in-memory storage for test/unsupported environments
const memorySessionStorage = new Map<string, any>();

async function getSessionStorage() {
  if (typeof chrome !== "undefined" && chrome.storage?.session) {
    return chrome.storage.session;
  }
  return {
    get: async (key: string) => {
      return { [key]: memorySessionStorage.get(key) };
    },
    set: async (items: Record<string, any>) => {
      for (const [k, v] of Object.entries(items)) {
        memorySessionStorage.set(k, v);
      }
    },
    remove: async (key: string) => {
      memorySessionStorage.delete(key);
    },
  };
}

/** Get state for a specific tab */
export async function getTabState(tabId: number): Promise<TabState> {
  const key = `tab_state_${tabId}`;
  const session = await getSessionStorage();
  const result = (await session.get(key)) as any;
  return result[key] ?? { tabId, ...defaultState() };
}

/** Update state for a specific tab */
export async function setTabState(
  tabId: number,
  updates: Partial<Omit<TabState, "tabId">>,
): Promise<void> {
  const key = `tab_state_${tabId}`;
  const current = await getTabState(tabId);
  const session = await getSessionStorage();
  await session.set({
    [key]: { ...current, ...updates, tabId },
  });
}

/** Clear state for a specific tab (e.g., when tab closes) */
export async function clearTabState(tabId: number): Promise<void> {
  const session = await getSessionStorage();
  await session.remove(`tab_state_${tabId}`);
}

/** Listen for tab close to clean up state */
export function initTabStateCleanup(): void {
  chrome.tabs.onRemoved.addListener((tabId) => {
    clearTabState(tabId).catch(console.error);
  });
}
