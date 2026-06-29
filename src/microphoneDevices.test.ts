import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MICROPHONE_ID,
  buildMicrophoneConstraints,
  filterAudioInputDevices,
  formatMicrophoneLabel,
  normalizeMicrophoneId,
  toMicrophoneOptions,
} from "./microphoneDevices.ts";

function device(partial: Partial<MediaDeviceInfo>): MediaDeviceInfo {
  return {
    deviceId: "",
    kind: "audioinput",
    label: "",
    groupId: "",
    toJSON() {
      return this;
    },
    ...partial,
  } as MediaDeviceInfo;
}

// ─── filterAudioInputDevices ───────────────────────────────────────────────────

test("filterAudioInputDevices keeps only audio inputs with a real device id", () => {
  const devices = [
    device({ deviceId: "mic-1", kind: "audioinput" }),
    device({ deviceId: "cam-1", kind: "videoinput" }),
    device({ deviceId: "spk-1", kind: "audiooutput" }),
    device({ deviceId: "", kind: "audioinput" }),
  ];

  const result = filterAudioInputDevices(devices);
  assert.deepEqual(
    result.map((d) => d.deviceId),
    ["mic-1"],
  );
});

// ─── formatMicrophoneLabel ─────────────────────────────────────────────────────

test("formatMicrophoneLabel prefers the OS label", () => {
  assert.equal(formatMicrophoneLabel({ label: "Blue Yeti", deviceId: "x" }, 0), "Blue Yeti");
});

test("formatMicrophoneLabel falls back to friendly names when label is blank", () => {
  assert.equal(
    formatMicrophoneLabel({ label: "", deviceId: "default" }, 0),
    "System default microphone",
  );
  assert.equal(
    formatMicrophoneLabel({ label: "   ", deviceId: "communications" }, 1),
    "Communications microphone",
  );
  assert.equal(formatMicrophoneLabel({ label: "", deviceId: "abc" }, 2), "Microphone 3");
});

// ─── toMicrophoneOptions ───────────────────────────────────────────────────────

test("toMicrophoneOptions maps filtered devices to labelled options", () => {
  const options = toMicrophoneOptions([
    device({ deviceId: "mic-1", label: "Headset" }),
    device({ deviceId: "cam-1", kind: "videoinput", label: "Webcam" }),
    device({ deviceId: "mic-2", label: "" }),
  ]);

  assert.deepEqual(options, [
    { deviceId: "mic-1", label: "Headset" },
    { deviceId: "mic-2", label: "Microphone 2" },
  ]);
});

// ─── normalizeMicrophoneId ─────────────────────────────────────────────────────

test("normalizeMicrophoneId trims strings and defaults non-strings", () => {
  assert.equal(normalizeMicrophoneId("  mic-1  "), "mic-1");
  assert.equal(normalizeMicrophoneId(""), DEFAULT_MICROPHONE_ID);
  assert.equal(normalizeMicrophoneId(undefined), DEFAULT_MICROPHONE_ID);
  assert.equal(normalizeMicrophoneId(42), DEFAULT_MICROPHONE_ID);
});

// ─── buildMicrophoneConstraints ────────────────────────────────────────────────

test("buildMicrophoneConstraints always applies the processing flags", () => {
  const constraints = buildMicrophoneConstraints();
  assert.equal(constraints.echoCancellation, true);
  assert.equal(constraints.noiseSuppression, true);
  assert.equal(constraints.autoGainControl, true);
  assert.equal("deviceId" in constraints, false);
});

test("buildMicrophoneConstraints pins a specific device with exact when provided", () => {
  const constraints = buildMicrophoneConstraints("mic-1");
  assert.deepEqual(constraints.deviceId, { exact: "mic-1" });
});

test("buildMicrophoneConstraints omits deviceId for the default selection", () => {
  assert.equal("deviceId" in buildMicrophoneConstraints(""), false);
  assert.equal("deviceId" in buildMicrophoneConstraints("   "), false);
});
