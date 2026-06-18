// OpenAI and ElevenLabs API wrappers for Meeting Copilot

import { getOpenAiApiKey } from "./credentials";

const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";
const ELEVENLABS_USER_URL = "https://api.elevenlabs.io/v1/user";

// ── Helper Functions ───────────────────────────────────────────────────────

/**
 * Retries a `fetch` call with exponential backoff on transient failures.
 *
 * Retries are triggered on HTTP 429 (Too Many Requests) and any 5xx server
 * error. Network-level errors (e.g. offline) also trigger a retry. All other
 * non-OK statuses are returned as-is without retrying.
 *
 * @param url - The URL to fetch.
 * @param options - Standard `RequestInit` options passed directly to `fetch`.
 * @param retries - Maximum number of retry attempts after the initial request (default: `3`).
 * @param backoff - Initial delay in milliseconds before the first retry; doubles on each
 *   subsequent attempt (default: `1000`).
 * @returns A resolved `Response` once a request succeeds or a non-retryable status is received.
 * @throws The last caught error if all retry attempts are exhausted.
 *
 * @example
 * const res = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
 *   method: "POST",
 *   headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
 *   body: JSON.stringify(payload),
 * });
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  backoff = 1000,
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    // Retry only on 429 (Too Many Requests) or 5xx (Server Errors)
    if (!response.ok && (response.status === 429 || response.status >= 500) && retries > 0) {
      throw new Error(`Status ${response.status}`);
    }
    return response;
  } catch (error) {
    if (retries <= 0) throw error;
    console.warn(`Retrying request to ${url}... (${retries} attempts left)`);
    await new Promise((resolve) => setTimeout(resolve, backoff));
    return fetchWithRetry(url, options, retries - 1, backoff * 2);
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

/** A single time-stamped segment returned by the Whisper transcription API. */
export interface WhisperSegment {
  /** Zero-based sequential segment index. */
  id: number;
  /** Segment start time in seconds relative to the audio start. */
  start: number;
  /** Segment end time in seconds relative to the audio start. */
  end: number;
  /** Transcribed text for this segment. */
  text: string;
}

/** Full transcription result returned by the Whisper API (`verbose_json` format). */
export interface TranscriptionResult {
  /** Complete transcribed text of the audio. */
  text: string;
  /** Detected language of the audio (ISO 639-1 code, e.g. `"en"`). */
  language: string;
  /** Fine-grained time-stamped segments. */
  segments: WhisperSegment[];
  /** Total audio duration in seconds. */
  duration: number;
}

/** A single message in an OpenAI chat completion conversation. */
export interface ChatMessage {
  /** Conversation role: `"system"` for instructions, `"user"` for input, `"assistant"` for model output. */
  role: "system" | "user" | "assistant";
  /** Text content of the message. */
  content: string;
}

/** Minimal shape of the OpenAI chat completion response used by this extension. */
export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      /** Generated text from the model. */
      content: string;
    };
  }>;
}

// ── API Functions ──────────────────────────────────────────────────────────

/**
 * Retrieves the stored OpenAI API key from secure credential storage.
 *
 * @returns The OpenAI API key string, or `null` if none is saved.
 *
 * @example
 * const key = await getApiKey();
 * if (!key) throw new Error("OpenAI key not configured");
 */
export async function getApiKey(): Promise<string | null> {
  return getOpenAiApiKey();
}

/**
 * Validates an OpenAI API key by making a lightweight request to the
 * `/v1/models` endpoint. The request times out after 5 seconds.
 *
 * @param apiKey - The API key string to validate. Returns `false` immediately for empty values.
 * @returns `true` if the key is accepted by the OpenAI API, `false` otherwise.
 *
 * @example
 * const isValid = await validateOpenAIKey("sk-...");
 * if (!isValid) showError("Invalid OpenAI key");
 */
export async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetchWithRetry(OPENAI_MODELS_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    return response.ok;
  } catch (error: any) {
    console.error("OpenAI validation failed after retries:", error);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validates an ElevenLabs API key by making a lightweight request to the
 * `/v1/user` endpoint. The request times out after 5 seconds.
 *
 * @param apiKey - The API key string to validate. Returns `false` immediately for empty values.
 * @returns `true` if the key is accepted by the ElevenLabs API, `false` otherwise.
 *
 * @example
 * const isValid = await validateElevenLabsKey("xi-...");
 * if (!isValid) showError("Invalid ElevenLabs key");
 */
export async function validateElevenLabsKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetchWithRetry(ELEVENLABS_USER_URL, {
      method: "GET",
      headers: { "xi-api-key": apiKey },
      signal: controller.signal,
    });
    return response.ok;
  } catch (error: any) {
    console.error("ElevenLabs validation failed after retries:", error);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
