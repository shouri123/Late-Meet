import test from "node:test";
import assert from "node:assert/strict";

import { VAD_FFT_SIZE, computeRms, shouldRunVadAnalysis } from "./vadTuning.ts";

// ─── computeRms ────────────────────────────────────────────────────────────────

test("computeRms returns 0 for silence (all samples at the 128 midpoint)", () => {
  const silent = new Uint8Array(256).fill(128);
  assert.equal(computeRms(silent), 0);
});

test("computeRms returns 0 for an empty buffer", () => {
  assert.equal(computeRms(new Uint8Array(0)), 0);
});

test("computeRms approaches 1 for a full-scale square wave", () => {
  const loud = new Uint8Array(256);
  for (let i = 0; i < loud.length; i += 1) loud[i] = i % 2 === 0 ? 0 : 255;
  assert.ok(computeRms(loud) > 0.99);
});

test("computeRms grows with amplitude", () => {
  const quiet = new Uint8Array(128).fill(128);
  quiet[0] = 138; // small deviation
  const louder = new Uint8Array(128).fill(128);
  louder[0] = 200; // larger deviation
  assert.ok(computeRms(louder) > computeRms(quiet));
});

// ─── shouldRunVadAnalysis ──────────────────────────────────────────────────────

test("shouldRunVadAnalysis always analyses while silent", () => {
  for (let tick = 1; tick <= 6; tick += 1) {
    assert.equal(shouldRunVadAnalysis(false, tick), true);
  }
});

test("shouldRunVadAnalysis analyses every other tick while speech is active", () => {
  assert.equal(shouldRunVadAnalysis(true, 1), true);
  assert.equal(shouldRunVadAnalysis(true, 2), false);
  assert.equal(shouldRunVadAnalysis(true, 3), true);
  assert.equal(shouldRunVadAnalysis(true, 4), false);
});

// ─── VAD_FFT_SIZE ──────────────────────────────────────────────────────────────

test("VAD_FFT_SIZE is a valid analyser size and smaller than the old 1024", () => {
  assert.ok(VAD_FFT_SIZE < 1024);
  assert.ok(VAD_FFT_SIZE >= 32);
  // Must be a power of two for AnalyserNode.fftSize.
  assert.equal(VAD_FFT_SIZE & (VAD_FFT_SIZE - 1), 0);
});
