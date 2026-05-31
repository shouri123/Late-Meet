import test from "node:test";
import assert from "node:assert/strict";

import { createAudioCaptureStopPlan } from "./audioCaptureLifecycle.ts";

test("stop plan preserves finalization after an offscreen acknowledgement clears live state", () => {
  const state = { audioActive: true };
  const plan = createAudioCaptureStopPlan(state.audioActive);

  state.audioActive = false;

  assert.equal(plan.shouldSavePendingSession, true);
  assert.equal(plan.shouldNotifySessionEnded, true);
});

test("stop plan does not create a pending session when capture was already inactive", () => {
  const plan = createAudioCaptureStopPlan(false);

  assert.equal(plan.shouldSavePendingSession, false);
  assert.equal(plan.shouldNotifySessionEnded, false);
});
