// Shared Configuration Constants for Late Meet

/** The default OpenAI chat model used for meeting summarization and AI features. */
export const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

/** The ElevenLabs speech-to-text model used for audio transcription. */
export const ELEVENLABS_STT_MODEL = "scribe_v2";

/** The OpenAI Whisper model used as the fallback speech-to-text engine. */
export const WHISPER_MODEL = "whisper-1";

/**
 * When true, enables verbose console logging for development.
 * Vite replaces `import.meta.env.DEV` at build time, ensuring production builds
 * never accidentally enable debug output by flipping this constant.
 */
export const DEBUG = import.meta.env.DEV === true;
