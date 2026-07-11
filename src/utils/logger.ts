const ENABLED = false;

export function debugLog(...args: unknown[]) {
  if (ENABLED) {
    console.log(...args);
  }
}
