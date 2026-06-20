import { DEBUG } from "../config";

export function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.log(...args);
  }
}
