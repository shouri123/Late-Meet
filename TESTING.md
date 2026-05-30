# Testing Guide

This guide explains how to test Late Meet changes before opening a pull request. It covers the recommended unit testing approach, Chrome Extension API mocking, and manual checks for extension-level flows.

## Testing Stack

Late Meet is built with a Vite-based TypeScript setup. The current unit test suite uses Node's built-in test runner with `tsx` so TypeScript test files can run directly.

The active test command is defined in `package.json`:

```json
{
  "scripts": {
    "test": "tsx --test src/audioProcessing.test.ts src/audioChunkQueue.test.ts src/participantDetection.test.ts src/meetingTabs.test.ts src/sessionStorage.test.ts src/dashboardCapture.test.ts src/popupCapture.test.ts src/speakerAttribution.test.ts src/utils/credentials.test.ts"
  }
}
```

Common test-related files may include:

- `src/**/*.test.ts` for unit tests
- `src/test/` or `test/` for shared mocks and setup helpers

## Running Tests Locally

Install dependencies first:

```bash
npm install
```

Run the current test suite:

```bash
npm run test
```

The script runs the listed `.test.ts` files through `tsx --test`. If you add a new test file, also add it to the `test` script unless the project later switches to a glob-based test command.

Before opening a pull request, also run the existing project checks:

```bash
npm run build
npm run lint
npm run type-check
```

Only mark these checks as complete in the PR template if they pass locally.

## Writing Unit Tests

Unit tests should focus on small, isolated behavior that does not require loading the full Chrome extension.

Good candidates for unit tests include:

- Pure helper functions under `src/utils/`
- Text formatting and parsing utilities
- Audio chunk processing helpers
- Transcript transformation logic
- Prompt-building utilities
- Error handling and fallback decision logic

Place tests next to the file being tested or in a nearby test folder. For example:

```text
src/utils/audioProcessing.ts
src/utils/audioProcessing.test.ts
```

A simple utility test might look like this:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { formatDuration } from "./formatDuration";

test("formatDuration formats seconds as minutes and seconds", () => {
  assert.equal(formatDuration(95), "1:35");
});
```

When writing tests, prefer checking observable behavior over implementation details. A test should describe what the function returns, stores, sends, or rejects rather than how the function is internally organized.

## Testing Utilities Under `src/utils/`

For utility files, keep tests small and table-driven when there are multiple input/output cases.

Example:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTranscriptText } from "./normalizeTranscriptText";

const cases: Array<[string, string]> = [
  [" hello  world ", "hello world"],
  ["hello\nworld", "hello world"],
  ["", ""],
];

for (const [input, expected] of cases) {
  test(`normalizeTranscriptText normalizes ${JSON.stringify(input)}`, () => {
    assert.equal(normalizeTranscriptText(input), expected);
  });
}
```

For files such as `audioProcessing.ts`, useful unit tests may cover:

- Empty audio input
- Invalid or unsupported audio chunks
- Correct chunk ordering
- Error handling when transcription fails
- Fallback behavior when the primary transcription provider fails

Avoid requiring a real microphone, real Google Meet tab, or real API key in unit tests.

## Mocking Chrome Extension APIs

Chrome Extension APIs such as `chrome.runtime`, `chrome.storage`, and `chrome.tabCapture` are not available in a normal Node.js test environment. Tests that touch these APIs must mock the minimum Chrome API surface they need.

Use plain functions, in-memory objects, or small helper factories:

```ts
import test from "node:test";
import assert from "node:assert/strict";

test("example with mocked chrome.runtime", async () => {
  const sentMessages: unknown[] = [];

  globalThis.chrome = {
    runtime: {
      async sendMessage(message: unknown) {
        sentMessages.push(message);
        return { success: true };
      },
      onMessage: {
        addListener() {},
        removeListener() {},
      },
    },
  } as unknown as typeof chrome;

  await chrome.runtime.sendMessage({ type: "TRANSCRIPTION_STARTED" });

  assert.deepEqual(sentMessages, [{ type: "TRANSCRIPTION_STARTED" }]);
});
```

Mock only the APIs needed for each test. This keeps tests easier to understand and prevents the mock setup from drifting away from the actual behavior being tested.

### Mocking `chrome.storage.local`

For storage-heavy tests, use an in-memory object:

```ts
const store: Record<string, unknown> = {};

globalThis.chrome = {
  storage: {
    local: {
      async get(key: string) {
        return { [key]: store[key] };
      },

      async set(items: Record<string, unknown>) {
        Object.assign(store, items);
      },
    },
  },
} as unknown as typeof chrome;
```

Use this pattern to verify that the extension reads and writes the expected local state without touching the real browser profile.

### Mocking `chrome.runtime`

Use `chrome.runtime.sendMessage` mocks to verify that a module sends the correct message shape:

```ts
const sentMessages: unknown[] = [];

globalThis.chrome = {
  runtime: {
    async sendMessage(message: unknown) {
      sentMessages.push(message);
      return { success: true };
    },
  },
} as unknown as typeof chrome;

await chrome.runtime.sendMessage({ type: "TRANSCRIPTION_STARTED" });

assert.deepEqual(sentMessages, [{ type: "TRANSCRIPTION_STARTED" }]);
```

For message listeners, keep the listener callback in a variable so the test can call it directly.

### Mocking `chrome.tabCapture`

`chrome.tabCapture` should be mocked in unit tests because real tab audio capture only works inside Chrome with extension permissions.

For success cases, return a fake `MediaStream` or the smallest object needed by the code under test:

```ts
chrome.tabCapture.capture = (_options, callback) => {
  callback({} as MediaStream);
};
```

For failure cases, return `null` and verify that the code handles the error path correctly:

```ts
chrome.tabCapture.capture = (_options, callback) => {
  callback(null);
};
```

## Testing the Audio Pipeline

The audio pipeline should be tested in layers.

Unit tests should cover pure processing logic, validation, fallback decisions, and provider error handling. These tests should not require real tab audio or real API keys.

Manual tests should verify the full browser behavior:

- Join a Google Meet call.
- Start Late Meet.
- Confirm that the extension detects the active meeting.
- Confirm that tab audio capture starts.
- Confirm that transcription begins.
- Confirm that fallback behavior works if the primary transcription provider fails.
- Confirm that stopping the meeting or extension session cleans up capture state.

Do not commit real API keys, meeting audio, transcripts, or private meeting data as test fixtures.

## Testing the Background Service Worker

The Manifest V3 service worker is event-driven, so it can be difficult to test as a long-running process.

For automated tests, extract business logic into functions that can be imported and tested directly. Keep Chrome event wiring thin so tests can focus on message handling, storage updates, and state transitions.

For manual testing:

- Load the unpacked extension in Chrome.
- Open `chrome://extensions`.
- Enable Developer mode.
- Find Late Meet and inspect the service worker.
- Trigger the feature being tested.
- Check the service worker console for errors.

## Testing the Content Script

Content script behavior should be tested through a mix of isolated DOM tests and manual browser checks.

For automated tests, use a DOM-like environment when possible and test functions that detect Google Meet UI state, read page information, or build messages for the service worker.

For manual testing:

- Open a Google Meet page.
- Load or reload the extension.
- Confirm that the content script detects the meeting page.
- Confirm that UI injection or messaging works as expected.
- Navigate away from the meeting and confirm that the extension handles the page change cleanly.

## Manual Testing Checklist

Use this checklist for extension-level changes.

### Meeting Detection

- [ ] The extension detects a Google Meet tab.
- [ ] The extension ignores non-Meet tabs.
- [ ] The extension handles joining, leaving, and rejoining a meeting.
- [ ] The extension does not duplicate listeners or UI after reload.

### Audio Capture

- [ ] Audio capture starts only after the required user action or permission flow.
- [ ] Audio capture uses the active Google Meet tab.
- [ ] Capture stops when the user stops the session.
- [ ] Capture errors are shown or handled clearly.

### Transcription

- [ ] Transcription starts after audio capture begins.
- [ ] ElevenLabs Scribe works when a valid API key is configured.
- [ ] OpenAI Whisper fallback works when the primary transcription path fails.
- [ ] Transcription errors do not crash the extension.

### Dashboard Rendering

- [ ] The dashboard opens correctly.
- [ ] Meeting status is visible and accurate.
- [ ] Transcript or summary updates render without layout issues.
- [ ] Empty, loading, success, and error states are handled.

## CI Checks

Before opening a pull request, check the repository's GitHub Actions workflows under `.github/workflows/`.

The CI pipeline may include checks such as:

- Dependency installation
- TypeScript type checking
- ESLint
- Formatting checks
- Production build
- Unit tests, if configured

Run the same checks locally whenever possible:

```bash
npm run lint
npm run type-check
npm run build
npm run test
```

If a script does not exist yet, mention that in the pull request testing notes instead of marking the check as completed.

## Pull Request Testing Notes

In your PR description, clearly separate automated and manual testing.

Example:

```md
## How Has This Been Tested?

- [x] Built the extension with `npm run build`
- [x] Loaded the extension in Chrome and tested manually
- [ ] Tested on a live Google Meet call
- [ ] Verified no console errors
- [ ] Tested with ElevenLabs API key
- [ ] Tested with OpenAI API key

Additional notes:

- Added unit tests for `src/utils/audioProcessing.ts`.
- Mocked `chrome.storage.local` and `chrome.runtime.sendMessage`.
- Did not test live transcription because API keys were not available.
```

Be honest about what was and was not tested. Clear testing notes help maintainers review changes faster.
