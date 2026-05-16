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
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('flac')) return 'flac';
  return 'webm';
}
