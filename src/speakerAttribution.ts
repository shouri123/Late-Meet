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
