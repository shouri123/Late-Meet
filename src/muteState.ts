// Helpers for syncing Google Meet's microphone mute button with the offscreen
// recorder (issue #631). The DOM observation lives in content.ts; the pure
// parsing logic lives here so it can be unit-tested without a Meet page.

/** Selectors for Meet's microphone toggle button, most reliable first. */
export const MUTE_BUTTON_SELECTORS = [
  "[data-is-muted]",
  'button[aria-label*="microphone" i]',
  '[role="button"][aria-label*="microphone" i]',
  'button[aria-label*="micrófono" i]',
  'button[aria-label*="micro" i]',
];

export interface MuteStateInput {
  /** Value of the button's `data-is-muted` attribute, if present. */
  dataIsMuted?: string | null;
  /** The button's `aria-label`, used as a fallback when the attribute is absent. */
  ariaLabel?: string | null;
}

/**
 * Determines whether the local microphone is muted from a Meet mic button's
 * attributes. Prefers the explicit `data-is-muted` attribute; otherwise infers
 * from the aria-label ("Turn on microphone"/"Unmute" ⇒ currently muted, "Turn
 * off microphone"/"Mute" ⇒ currently unmuted). Returns `null` when it can't tell.
 */
export function parseMuteState({ dataIsMuted, ariaLabel }: MuteStateInput): boolean | null {
  if (typeof dataIsMuted === "string") {
    const value = dataIsMuted.trim().toLowerCase();
    if (value === "true") return true;
    if (value === "false") return false;
  }

  if (typeof ariaLabel === "string") {
    const label = ariaLabel.trim().toLowerCase();
    if (label) {
      // Check "unmute"/"turn on" before "mute"/"turn off" since "mute" is a
      // substring of "unmute".
      if (label.includes("unmute") || label.includes("turn on microphone")) return true;
      if (label.includes("turn off microphone") || label.includes("mute")) return false;
    }
  }

  return null;
}
