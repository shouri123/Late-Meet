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

export function debounceSpeakerAttribution<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
): { invoke: (...args: Parameters<T>) => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const invoke = (...args: Parameters<T>) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      callback(...args);
    }, delay);
  };

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return { invoke, cancel };
}
