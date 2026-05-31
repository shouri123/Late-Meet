import { participantNameFromCandidate } from "./participantDetection";

export const DEFAULT_TRANSCRIPT_SPEAKER = "Audio";

export function normalizeActiveSpeakerName(value: unknown): string | null {
  return participantNameFromCandidate({
    text: typeof value === "string" ? value : "",
  });
}

export function resolveTranscriptSpeaker(value: string | null | undefined): string {
  return normalizeActiveSpeakerName(value) || DEFAULT_TRANSCRIPT_SPEAKER;
}

// Speaker detection debouncing utility
export function debounceSpeakerAttribution(callback: (...args: any[]) => void, delay: number) {
  let timer: any = null;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}
