/**
 * @description Options for configuring the VoiceActivityTracker
 * @property {number} rmsThreshold - The minimum RMS (Root Mean Square) level to detect speech
 */
export interface VoiceActivityTrackerOptions {
  rmsThreshold: number;
}

/**
 * @description Tracks voice activity in audio by monitoring RMS levels above a threshold
 * @example
 *   const tracker = new VoiceActivityTracker({ rmsThreshold: 0.1 });
 *   tracker.observe(0.15); // Speech detected
 *   const shouldFlush = tracker.consumeShouldFlush(); // returns true
 */
export class VoiceActivityTracker {
  private readonly rmsThreshold: number;
  private speechObserved = false;

  constructor(options: VoiceActivityTrackerOptions) {
    this.rmsThreshold = options.rmsThreshold;
  }

  observe(rms: number) {
    if (Number.isFinite(rms) && rms >= this.rmsThreshold) {
      this.speechObserved = true;
    }
  }

  consumeShouldFlush() {
    const shouldFlush = this.speechObserved;
    this.speechObserved = false;
    return shouldFlush;
  }
}

/**
 * @description Determines the appropriate file extension for an audio MIME type
 * @param {string} mimeType - The MIME type of the audio (e.g., "audio/webm", "audio/mp3")
 * @returns {string} The file extension without the dot (e.g., "webm", "mp3", "ogg")
 * @example
 *   audioFileExtensionForMimeType("audio/webm;codecs=opus") // returns "webm"
 *   audioFileExtensionForMimeType("audio/mpeg") // returns "mp3"
 *   audioFileExtensionForMimeType("application/ogg") // returns "ogg"
 */
export function audioFileExtensionForMimeType(mimeType: string) {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("mp3")) return "mp3";
  if (normalized.includes("mp4")) return "mp4";
  if (normalized.includes("mpeg")) return "mp3";
  if (normalized.includes("wav")) return "wav";
  if (normalized.includes("flac")) return "flac";
  return "webm";
}

/**
 * @description Checks if an audio blob is large enough to be processed (viability check)
 * @param {Blob} blob - The audio blob to validate
 * @param {number} [minBytes=5000] - Minimum size in bytes required for a viable chunk (defaults to 5000)
 * @returns {boolean} True if blob exists and meets minimum size requirement, false otherwise
 * @example
 *   const blob = new Blob([audioData], { type: "audio/webm" });
 *   isChunkViable(blob) // returns true if blob.size >= 5000
 *   isChunkViable(blob, 10000) // returns true if blob.size >= 10000
 */
export function isChunkViable(blob: Blob, minBytes = 5000): boolean {
  return !!blob && blob.size >= minBytes;
}


// Microphone permission handlers
export async function getMicrophoneStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    console.warn("Microphone access denied gracefully catching:", e);
    return null;
  }
}
