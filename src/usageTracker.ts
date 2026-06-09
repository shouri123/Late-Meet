// ——— API Cost & Token Usage Tracker ———
// Persists daily stats in chrome.storage.local under the key "usageStats".

/** Pricing per 1,000 tokens in USD (input / output). */
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  // Whisper is billed per minute of audio, tracked separately
  "whisper-1": { input: 0, output: 0 },
};

/**
 * ElevenLabs STT (Scribe v2) estimated cost per audio second.
 * Based on ~$0.40/hour on the Starter plan ≈ $0.000111/second.
 */
const ELEVENLABS_STT_PRICE_PER_SECOND = 0.000111;

/** Whisper is billed at $0.006 per minute of audio. */
const WHISPER_PRICE_PER_SECOND = 0.006 / 60;

export interface DayStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  audioSeconds: number;
  estimatedCost: number;
}

/** Returns today's date string key in local YYYY-MM-DD format. */
export function getTodayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Reads the entire usageStats map from local storage. */
export async function getUsageStats(): Promise<Record<string, DayStats>> {
  const result = await chrome.storage.local.get("usageStats");
  return (result.usageStats as Record<string, DayStats>) || {};
}

interface UsageDelta {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  /** Seconds of audio processed by OpenAI Whisper. */
  whisperSeconds?: number;
  /** Seconds of audio processed by ElevenLabs STT. */
  elevenlabsSeconds?: number;
  /** The model used for this chat completion (for pricing lookup). */
  model?: string;
}

// Module-level queue to serialize local storage writes and prevent race conditions
let writeQueue = Promise.resolve();

/**
 * Atomically increments today's stats in chrome.storage.local.
 * All fields are optional — only supplied deltas are applied.
 */
export async function updateUsageStats(delta: UsageDelta): Promise<void> {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        const key = getTodayKey();
        const stats = await getUsageStats();
        const today = stats[key] ?? {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          audioSeconds: 0,
          estimatedCost: 0,
        };

        const pt = delta.promptTokens ?? 0;
        const ct = delta.completionTokens ?? 0;
        const tt = delta.totalTokens ?? pt + ct;
        const ws = delta.whisperSeconds ?? 0;
        const es = delta.elevenlabsSeconds ?? 0;

        today.promptTokens += pt;
        today.completionTokens += ct;
        today.totalTokens += tt;
        today.audioSeconds += ws + es;

        // Chat completion cost
        const model = delta.model ?? "gpt-4o-mini";
        const pricing = OPENAI_PRICING[model] ?? OPENAI_PRICING["gpt-4o-mini"];
        const chatCost = (pt / 1000) * pricing.input + (ct / 1000) * pricing.output;

        // Audio transcription cost
        const whisperCost = ws * WHISPER_PRICE_PER_SECOND;
        const elevenlabsCost = es * ELEVENLABS_STT_PRICE_PER_SECOND;

        today.estimatedCost += chatCost + whisperCost + elevenlabsCost;

        stats[key] = today;
        await chrome.storage.local.set({ usageStats: stats });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}
