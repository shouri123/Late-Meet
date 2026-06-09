/**
 * Offscreen Bridge
 *
 * Routes heavy audio processing to the offscreen document
 * to prevent main thread blocking in the extension popup.
 */

type OffscreenMessage = {
  type: "PROCESS_AUDIO_CHUNK";
  chunk: ArrayBuffer;
  tabId: number;
};

/** Send an audio chunk to the offscreen document for processing */
export async function sendChunkToOffscreen(chunk: ArrayBuffer, tabId: number): Promise<void> {
  await ensureOffscreenDocument();

  await chrome.runtime.sendMessage({
    type: "PROCESS_AUDIO_CHUNK",
    chunk,
    tabId,
  } as OffscreenMessage);
}

/** Ensure the offscreen document exists */
async function ensureOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: offscreenUrl,
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: "Process audio chunks for transcription",
  });
}
