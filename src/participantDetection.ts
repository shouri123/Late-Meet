export const MAX_PARTICIPANT_NAME_LEN = 120;

const EXCLUDED_PARTICIPANT_LABELS = new Set([
  "Audio on",
  "Camera off",
  "Camera on",
  "Meeting host",
  "More options",
  "Mute",
  "Muted",
  "Pin",
  "Presentation",
  "Unmute",
  "Unpin",
  "You",
]);

export interface ParticipantNameCandidate {
  ariaLabel?: string | null;
  selfName?: string | null;
  text?: string | null;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripExcludedLabels(value: string): string {
  let cleaned = cleanText(value);
  if (!cleaned) return "";

  for (const label of EXCLUDED_PARTICIPANT_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    cleaned = cleaned.replace(regex, " ");
  }

  cleaned = cleaned.replace(/(^|\s)[-/]+(?=\s|$)/g, " ");

  return cleanText(cleaned);
}

export function participantNameFromCandidate(candidate: ParticipantNameCandidate): string | null {
  const selfName = cleanText(candidate.selfName || "");
  const text = stripExcludedLabels(candidate.text || "");
  const ariaLabel = cleanText(candidate.ariaLabel || "");

  const participantAriaName = ariaLabel.startsWith("Participant:")
    ? ariaLabel.replace(/^Participant:\s*/, "")
    : "";

  const rawName = selfName || participantAriaName || text;
  const name = cleanText(rawName);

  const maxParticipantNameLength =
    typeof MAX_PARTICIPANT_NAME_LEN === "number" && Number.isFinite(MAX_PARTICIPANT_NAME_LEN)
      ? MAX_PARTICIPANT_NAME_LEN
      : 120;

  if (!name || name.length > maxParticipantNameLength || name.includes("…")) {
    return null;
  }

  if (EXCLUDED_PARTICIPANT_LABELS.has(name)) {
    return null;
  }

  return name;
}

export function collectParticipantNames(candidates: ParticipantNameCandidate[]): string[] {
  const names = new Set<string>();

  for (const candidate of candidates) {
    const name = participantNameFromCandidate(candidate);
    if (name) names.add(name);
  }

  const participantNames = [...names];
  return participantNames.length > 0 ? participantNames : ["You"];
}
