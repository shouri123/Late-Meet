// Helpers for the microphone-selection feature (issue #624). The pure logic
// (filtering, labelling, constraint building) lives here so it can be unit-tested
// without a browser; the actual enumerateDevices()/getUserMedia() calls happen in
// the options page and the offscreen document.

/** Setting value meaning "use the system default microphone" (no device pin). */
export const DEFAULT_MICROPHONE_ID = "";

export interface AudioInputOption {
  deviceId: string;
  label: string;
}

/** Keeps only real audio-input devices (drops other kinds and blank ids). */
export function filterAudioInputDevices(devices: MediaDeviceInfo[]): MediaDeviceInfo[] {
  return devices.filter((device) => device.kind === "audioinput" && device.deviceId !== "");
}

/**
 * Produces a user-facing label for a microphone. Falls back to a stable
 * positional name when the OS label is unavailable (e.g. permission not granted),
 * and gives Chrome's synthetic "default"/"communications" ids friendly names.
 */
export function formatMicrophoneLabel(
  device: Pick<MediaDeviceInfo, "label" | "deviceId">,
  index: number,
): string {
  const label = device.label?.trim();
  if (label) return label;
  if (device.deviceId === "default") return "System default microphone";
  if (device.deviceId === "communications") return "Communications microphone";
  return `Microphone ${index + 1}`;
}

/** Maps a raw device list to dropdown-ready options with resolved labels. */
export function toMicrophoneOptions(devices: MediaDeviceInfo[]): AudioInputOption[] {
  return filterAudioInputDevices(devices).map((device, index) => ({
    deviceId: device.deviceId,
    label: formatMicrophoneLabel(device, index),
  }));
}

/** Normalizes a stored/selected device id, returning the default for bad input. */
export function normalizeMicrophoneId(value: unknown): string {
  return typeof value === "string" ? value.trim() : DEFAULT_MICROPHONE_ID;
}

/**
 * Builds the `audio` track constraints for `getUserMedia`. The standard
 * processing flags are always applied; a specific device is pinned with `exact`
 * only when a non-default id is supplied.
 */
export function buildMicrophoneConstraints(deviceId?: string): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  const id = normalizeMicrophoneId(deviceId);
  if (id) {
    constraints.deviceId = { exact: id };
  }

  return constraints;
}
