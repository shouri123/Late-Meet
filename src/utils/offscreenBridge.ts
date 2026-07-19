/**
 * @fileoverview Offscreen Bridge
 *
 * Routes heavy audio processing to the offscreen document to prevent main
 * thread blocking in the extension popup and service worker.
 *
 * Chrome Manifest V3 service workers cannot directly capture or process audio.
 * This module transparently creates the offscreen document on first use and
 * forwards audio chunks to it via `chrome.runtime.sendMessage`.
 *
 * @see {@link https://developer.chrome.com/docs/extensions/reference/offscreen/ chrome.offscreen API}
 */

/** Message payload sent to the offscreen document for audio processing. */
type OffscreenMessage = {
  type: "PROCESS_AUDIO_CHUNK";
  /** Raw audio data to process. */
  chunk: ArrayBuffer;
  /** Chrome tab ID that is the audio source, used for per-tab state tracking. */
  tabId: number;
};

/**
 * Sends a raw audio chunk to the offscreen document for transcription processing.
 *
 * If the offscreen document does not yet exist, it is created automatically
 * before the message is dispatched. Subsequent calls reuse the existing
 * document. The function resolves once the message has been sent; it does
 * **not** wait for the offscreen document to finish processing the chunk.
 *
 * @deprecated No active callsites — reserved for future use. The current audio
 *   pipeline uses the "OFFSCREEN_AUDIO_CHUNK" message type in background.ts instead.
 * @param chunk - An `ArrayBuffer` containing the raw audio data (e.g. a PCM
 *   or WebM segment captured via `chrome.tabCapture`).
 * @param tabId - The ID of the Chrome tab that is the audio source. Used by
 *   the offscreen document to route results back to the correct meeting session.
 * @returns A Promise that resolves when the message has been dispatched.
 *
 * @example
 * // In the service worker, after receiving audio from tabCapture:
 * await sendChunkToOffscreen(audioBuffer, tab.id);
 */
export async function sendChunkToOffscreen(chunk: ArrayBuffer, tabId: number): Promise<void> {
  await ensureOffscreenDocument();

  await chrome.runtime.sendMessage({
    type: "PROCESS_AUDIO_CHUNK",
    chunk,
    tabId,
  } as OffscreenMessage);
}

/**
 * Ensures that exactly one offscreen document (`offscreen.html`) is running.
 *
 * Queries the existing extension contexts for an offscreen document at the
 * canonical URL. If one is already present the function returns immediately.
 * Otherwise it calls `chrome.offscreen.createDocument` with the
 * `AUDIO_PLAYBACK` reason, which is required for `tabCapture`-based audio
 * processing under Manifest V3.
 *
 * @returns A Promise that resolves when the document is confirmed to exist.
 *
 * @internal Not exported — callers should use {@link sendChunkToOffscreen}.
 */
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
