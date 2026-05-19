export interface VoiceActivityTrackerOptions {
  rmsThreshold: number;
}

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

export function isChunkViable(blob: Blob, minBytes = 5000): boolean {
  return !!blob && blob.size >= minBytes;
}
