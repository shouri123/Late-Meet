// OpenAI and ElevenLabs API wrappers for Meeting Copilot

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

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
 * Get the stored OpenAI API key
 */
export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.session.get("openai_api_key");
  return (result.openai_api_key as string) || null;
}
/**
 * Call OpenAI Chat Completions API
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
 * Transcribe audio using OpenAI Whisper API
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
 * Transcribe audio using ElevenLabs Speech-to-Text API
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
