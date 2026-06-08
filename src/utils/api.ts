// OpenAI and ElevenLabs API wrappers for Meeting Copilot

import { getOpenAiApiKey } from "./credentials";

const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";
const ELEVENLABS_USER_URL = "https://api.elevenlabs.io/v1/user";

// ── Helper Functions ───────────────────────────────────────────────────────

/**
 * @description Helper to retry fetch requests with exponential backoff
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

export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  segments: WhisperSegment[];
  duration: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// ── API Functions ──────────────────────────────────────────────────────────

export async function getApiKey(): Promise<string | null> {
  return getOpenAiApiKey();
}

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
