// OpenAI and ElevenLabs API wrappers for Meeting Copilot

import { getOpenAiApiKey } from "./credentials";

const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";
const ELEVENLABS_USER_URL = "https://api.elevenlabs.io/v1/user";

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

/**
 * @description Retrieves the stored OpenAI API key from browser storage
 * @returns {Promise<string | null>} The API key if available, or null if not set
 * @example
 *   const key = await getApiKey();
 *   if (key) console.log("API key is configured");
 */
export async function getApiKey(): Promise<string | null> {
  return getOpenAiApiKey();
}

/**
 * @description Validates if an OpenAI API key is valid and active
 * @param {string} apiKey - The OpenAI API key to validate
 * @returns {Promise<boolean>} True if valid, false otherwise (times out after 5 seconds)
 * @example
 *   const isValid = await validateOpenAIKey("sk-xxxxx");
 *   if (isValid) console.log("API key is working!");
 */

export async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(OPENAI_MODELS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    return response.ok;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error("OpenAI validation timed out");
    } else {
      console.error("OpenAI validation error:", error);
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * @description Validates if an ElevenLabs API key is valid and accessible
 * @param {string} apiKey - The ElevenLabs API key to validate
 * @returns {Promise<boolean>} True if the key is valid and accessible, false otherwise (times out after 5 seconds)
 * @example
 *   const isValid = await validateElevenLabsKey("xxxxx-api-key");
 *   if (isValid) console.log("ElevenLabs API key is working!");
 */

export async function validateElevenLabsKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(ELEVENLABS_USER_URL, {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
      signal: controller.signal,
    });
    if (response.ok) {
      return true;
    }
    // Any non-OK response (including 401 Unauthorized) means the key is not usable
    // for this extension's STT functionality — reject it during validation.
    return false;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error("ElevenLabs validation timed out");
    } else {
      console.error("ElevenLabs validation error:", error);
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
