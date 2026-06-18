// Pure helpers for the offscreen voice-activity-detection (VAD) loop. Extracted
// so the CPU-sensitive math and throttling decision are unit-testable without a
// Web Audio context (issue #632).

/**
 * FFT size for the shared analyser node. The VAD/waveform code only reads the
 * time-domain waveform, so a smaller window is plenty for an RMS estimate and
 * halves both the analyser's internal work and the per-tick read/loop cost
 * versus the previous 1024.
 */
export const VAD_FFT_SIZE = 512;

/**
 * Computes the root-mean-square (loudness) of a byte time-domain waveform, where
 * 128 is silence. Returns 0 for an empty buffer.
 */
export function computeRms(buffer: Uint8Array): number {
  if (buffer.length === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const normalized = (buffer[i] - 128) / 128;
    sumSquares += normalized * normalized;
  }

  return Math.sqrt(sumSquares / buffer.length);
}

/**
 * Decides whether a VAD tick should run the (relatively expensive) analyser read
 * + RMS pass. While speech is sustained we only analyse on every other tick to
 * cut CPU during continuous talking; while silent we always analyse so the
 * natural-pause flush stays responsive.
 *
 * @param speechActive - Whether the previous analysed tick detected speech.
 * @param tickCounter - Monotonic VAD tick counter.
 */
export function shouldRunVadAnalysis(speechActive: boolean, tickCounter: number): boolean {
  if (!speechActive) return true;
  return tickCounter % 2 !== 0;
}
