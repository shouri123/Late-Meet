// OpenAI and ElevenLabs API wrappers for Meeting Copilot

// @ts-ignore: Could not find a declaration file for module '@elevenlabs/elevenlabs-js'
// @ts-ignore
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { getOpenAiApiKey } from "./credentials";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

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
 * @description Sends a chat message to OpenAI API and receives a JSON response
 * @param {string} systemPrompt - System instructions that define the AI's behavior
 * @param {string} userPrompt - The user's message or question
 * @param {string} apiKey - OpenAI API key for authentication
 * @param {string} [model="gpt-4o-mini"] - The AI model to use (defaults to gpt-4o-mini)
 * @returns {Promise<Record<string, unknown> | null>} Parsed JSON response, or null if parsing fails
 * @throws {Error} If API key is not provided or API call fails
 * @example
 *   const response = await chatCompletion(
 *     "You are a helpful assistant",
 *     "What is 2 + 2?",
 *     "sk-xxxxx"
 *   );
 */
export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  model: string = "gpt-4o-mini",
): Promise<Record<string, unknown> | null> {
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ] as ChatMessage[],
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${err}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices[0]?.message?.content;

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    console.error("Failed to parse OpenAI response:", content);
    return null;
  }
}

/**
 * @description Transcribes audio using OpenAI's Whisper API
 * @param {Blob} audioBlob - Audio data as a Blob object
 * @param {string} apiKey - OpenAI API key for authentication
 * @returns {Promise<TranscriptionResult>} Transcribed text, language, segments, and duration
 * @throws {Error} If API key is missing or transcription fails
 * @example
 *   const audioBlob = new Blob([data], { type: "audio/webm" });
 *   const result = await whisperTranscribe(audioBlob, "sk-xxxxx");
 *   console.log(result.text); // "Hello, how are you?"
 */
export async function whisperTranscribe(
  audioBlob: Blob,
  apiKey: string,
): Promise<TranscriptionResult> {
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");

  const response = await fetch(OPENAI_WHISPER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper API error: ${response.status} — ${err}`);
  }

  const data = (await response.json()) as {
    text: string;
    language: string;
    segments?: WhisperSegment[];
    duration: number;
  };

  return {
    text: data.text,
    language: data.language,
    segments: data.segments || [],
    duration: data.duration,
  };
}

/**
 * @description Transcribes audio using ElevenLabs Speech-to-Text API
 * @param {Blob} audioBlob - Audio data as a Blob object
 * @param {string} apiKey - ElevenLabs API key for authentication
 * @returns {Promise<TranscriptionResult>} Transcribed text (language set to "unknown" for ElevenLabs)
 * @throws {Error} If API key is missing or transcription fails
 * @example
 *   const audioBlob = new Blob([data], { type: "audio/webm" });
 *   const result = await elevenlabsTranscribe(audioBlob, "xxxxx-api-key");
 *   console.log(result.text);
 */
export async function elevenlabsTranscribe(
  audioBlob: Blob,
  apiKey: string,
): Promise<TranscriptionResult> {
  if (!apiKey) throw new Error("ElevenLabs API key not configured");

  const elevenlabs = new ElevenLabsClient({ apiKey });
  const file = new File([audioBlob], "audio.webm", { type: "audio/webm" });

  const response = await elevenlabs.speechToText.convert({
    file: file,
    modelId: "scribe_v1",
  });

  return {
    text: response.text,
    language: "unknown",
    segments: [],
    duration: 0,
  };
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
    if (response.status === 401) {
      const data = await response.json();
      return data?.detail?.status === "missing_permissions";
    }
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
