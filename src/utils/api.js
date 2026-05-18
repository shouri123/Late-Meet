// OpenAI and ElevenLabs API wrappers for Meeting Copilot

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

/**
 * Get the stored OpenAI API key
 */
export async function getApiKey() {
  const result = await chrome.storage.local.get("openai_api_key");
  return result.openai_api_key || null;
}

/**
 * Call OpenAI Chat Completions API
 * @param {string} systemPrompt - System prompt for the AI
 * @param {string} userPrompt - User prompt with transcript data
 * @param {string} apiKey - OpenAI API key
 * @param {string} model - Model to use (default: gpt-4o-mini)
 */
export async function chatCompletion(systemPrompt, userPrompt, apiKey, model = "gpt-4o-mini") {
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
      ],
      temperature: 0.2, // Lowered from 0.3 for more consistent, precise extraction
      max_tokens: 3000, // Increased from 2000 for richer responses
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  try {
    return JSON.parse(content);
  } catch {
    console.error("Failed to parse OpenAI response:", content);
    return null;
  }
}

/**
 * Transcribe audio using OpenAI Whisper API (multilingual)
 */
export async function whisperTranscribe(audioBlob, apiKey) {
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

  const data = await response.json();
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
export async function elevenlabsTranscribe(audioBlob, apiKey) {
  if (!apiKey) throw new Error("ElevenLabs API key not configured");

  const elevenlabs = new ElevenLabsClient({ apiKey });
  const file = new File([audioBlob], "audio.webm", { type: "audio/webm" });

  const response = await elevenlabs.speechToText.convert({
    file: file,
    model_id: "scribe_v1", // Scribe v1 is the primary STT model
  });

  return {
    text: response.text,
    language: "unknown", // ElevenLabs SDK response format
    segments: [],
    duration: 0,
  };
}
