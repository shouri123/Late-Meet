// Shared Configuration Constants for Late Meet

// AI Model Names
/** The default OpenAI chat model used for meeting summarization and AI features. */
export const DEFAULT_CHAT_MODEL = "gpt-4o-mini";

/** The ElevenLabs speech-to-text model used for audio transcription. */
export const ELEVENLABS_STT_MODEL = "scribe_v2";

/** The OpenAI Whisper model used as the fallback speech-to-text engine. */
export const WHISPER_MODEL = "whisper-1";

// AI Processing Limits
/** Maximum number of characters allowed in a single AI prompt before truncation. */
export const MAX_PROMPT_LENGTH = 2000;

/** Number of transcript entries included in the rolling context window sent to the AI. */
export const TRANSCRIPT_WINDOW_SIZE = 25;

/** Maximum number of tokens the AI may generate for a meeting summary response. */
export const SUMMARIZATION_MAX_TOKENS = 1200;

/** Maximum number of tokens the AI may generate for a late-joiner briefing message. */
export const JOINER_MESSAGE_MAX_TOKENS = 120;

// Audio Pipeline
/** Maximum number of audio chunks that may be queued for processing before back-pressure is applied. */
export const MAX_PENDING_AUDIO_CHUNKS = 8;

/** Interval in milliseconds at which voice-activity detection (VAD) samples audio energy. */
export const VAD_SAMPLE_MS = 250;

/** Interval in milliseconds between waveform visualization updates in the UI. */
export const WAVEFORM_INTERVAL_MS = 100;

/** Number of amplitude buckets used to render the waveform bar graph. */
export const WAVEFORM_BUCKETS = 32;

/** Gain multiplier applied to raw audio amplitude values before rendering the waveform. */
export const WAVEFORM_GAIN = 6;

/** Milliseconds of silence after which an in-progress audio chunk is flushed for transcription. */
export const SILENCE_FLUSH_MS = 1500;

/** Maximum buffered audio duration in milliseconds before the buffer is force-flushed. */
export const MAX_BUFFER_MS = 25000;

// Meeting Behavior
/**
 * Seconds to wait before sending the welcome/catch-up message, avoiding
 * transient lobby or join churn during the first moments of a meeting.
 */
export const MIN_MEETING_DURATION_FOR_WELCOME = 10;

/** Minimum milliseconds between consecutive state broadcast messages to listeners. */
export const BROADCAST_THROTTLE_MS = 500;

/**
 * When true, enables verbose console logging for development.
 * Vite replaces `import.meta.env.DEV` at build time, ensuring production builds
 * never accidentally enable debug output by flipping this constant.
 */
export const DEBUG = import.meta.env?.DEV === true;

/** Maximum number of pending audio chunks before pausing the recorder. */
export const MAX_PENDING_CHUNKS = 20;

/** Timeout in milliseconds for draining pending audio chunks before dropping them. */
export const DRAIN_TIMEOUT_MS = 30000;
