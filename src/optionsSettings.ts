// Pure helpers for the Options "Save" flow.
//
// These encode the behavior required by issue #526: non-secret settings are
// always validated and persisted regardless of credential-unlock state, and the
// passphrase is only relevant when saving encrypted API keys. Keeping this logic
// out of the DOM click handler makes it unit-testable.

export const SUMMARIZATION_INTERVAL_DEFAULT = 30;
export const SUMMARIZATION_INTERVAL_MIN = 10;
export const SUMMARIZATION_INTERVAL_MAX = 300;

export const VAD_THRESHOLD_DEFAULT = 0.012;
export const VAD_THRESHOLD_MIN = 0.001;
export const VAD_THRESHOLD_MAX = 1;

/**
 * Clamps the summarization interval (minutes) into the supported range, falling
 * back to the default for non-finite input. Fractional values are truncated.
 */
export function clampSummarizationInterval(value: number): number {
  if (!Number.isFinite(value)) return SUMMARIZATION_INTERVAL_DEFAULT;
  return Math.min(
    SUMMARIZATION_INTERVAL_MAX,
    Math.max(SUMMARIZATION_INTERVAL_MIN, Math.trunc(value)),
  );
}

/**
 * Clamps the VAD threshold into the supported range, falling back to the default
 * for non-finite input.
 */
export function clampVadThreshold(value: number): number {
  if (!Number.isFinite(value)) return VAD_THRESHOLD_DEFAULT;
  return Math.min(VAD_THRESHOLD_MAX, Math.max(VAD_THRESHOLD_MIN, value));
}

export type SaveTone = "success" | "info" | "error";

export interface SaveStatus {
  message: string;
  tone: SaveTone;
}

export interface SaveStatusInput {
  /** Whether credential encryption is currently unlocked. */
  unlocked: boolean;
  /** Whether API credentials were (re)written during this save. */
  credentialsSaved: boolean;
  /** Which key failed validation, if any (only meaningful when unlocked). */
  invalidKey?: "openai" | "elevenlabs" | null;
}

/**
 * Resolves the status message shown after a save. Non-secret settings are always
 * persisted before this runs, so every branch reports the settings as saved; the
 * difference is whether credentials were updated, blocked by a lock, or invalid.
 */
export function resolveSaveStatus({
  unlocked,
  credentialsSaved,
  invalidKey = null,
}: SaveStatusInput): SaveStatus {
  if (unlocked && invalidKey) {
    return {
      tone: "error",
      message:
        invalidKey === "openai"
          ? "Settings saved, but the OpenAI API key is invalid."
          : "Settings saved, but the ElevenLabs API key is invalid.",
    };
  }

  if (credentialsSaved) {
    return { tone: "success", message: "Settings saved successfully!" };
  }

  return {
    tone: "info",
    message: "Settings saved. Unlock credential encryption to update API keys.",
  };
}

/**
 * Whether the save flow should attempt to write API credentials. Credentials are
 * only touched while encryption is unlocked, so a locked Options page can still
 * persist non-secret settings without overwriting stored keys (issue #526).
 */
export function shouldSaveCredentials(unlocked: boolean): boolean {
  return unlocked;
}
