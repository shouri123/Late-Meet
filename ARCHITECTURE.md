# Architecture

This document explains the technical architecture of Late Meet. It is intended for contributors who want to understand how the Chrome Extension pieces work together before changing the message-passing, audio, transcription, or dashboard flows.

Late Meet is a Manifest V3 Chrome Extension that captures audio from a Google Meet tab, transcribes the meeting, and generates useful meeting intelligence such as summaries, action items, and sentiment. The extension follows a local-first model: session data is stored in the browser with `chrome.storage.local`, and users provide their own AI provider API keys.

## High-Level Design

Late Meet is split into several focused extension components:

- `background.ts` coordinates extension state and message passing.
- `offscreen.ts` handles audio capture and audio processing work that needs a document context.
- `content.ts` runs inside Google Meet pages and connects the page to the extension.
- `dashboard.ts` renders meeting intelligence and session output.
- `popup.ts` provides the quick extension popup entry point.
- `options.ts` manages user configuration such as API keys and preferences.

The architecture is designed around Manifest V3 constraints. Because MV3 service workers are event-driven and do not provide a persistent DOM environment, Late Meet uses an Offscreen Document for audio and media-related work.

## Component Roles

### `background.ts` - The Conductor

`background.ts` is the central coordinator for the extension. It listens for messages from the popup, content script, dashboard, and offscreen document, then routes those messages to the correct destination.

In Manifest V3, the background script runs as a service worker. This means it should coordinate state transitions and browser events, but long-running DOM or media work should be delegated to other components such as the Offscreen Document.

Typical responsibilities include:

- Creating or managing the Offscreen Document when audio capture is needed.
- Receiving status updates from `offscreen.ts`.
- Relaying transcript or summary updates to the dashboard.
- Reading and writing session state with `chrome.storage.local`.
- Handling extension lifecycle events.

### `offscreen.ts` - The Audio Engine

`offscreen.ts` runs inside the Offscreen Document. This hidden document exists because some browser and media APIs need a document-like environment that a Manifest V3 service worker cannot provide.

The Offscreen Document is responsible for audio-focused work such as:

- Starting audio capture from the Google Meet tab.
- Receiving the captured `MediaStream`.
- Splitting or preparing audio chunks for transcription.
- Sending audio or transcription progress back to the background service worker.
- Cleaning up audio resources when capture stops.

This separation keeps the service worker lightweight while still allowing Late Meet to use media workflows that are not practical directly inside `background.ts`.

### `content.ts` - The UI Injector

`content.ts` runs in the context of Google Meet pages. It detects whether the current page is a supported meeting page and can inject or coordinate UI elements that need to appear inside the Meet tab.

The content script acts as the bridge between the page and the extension runtime. It should avoid owning core business logic; instead, it should detect page state and send messages to the background service worker when extension-level action is needed.

Typical responsibilities include:

- Detecting Google Meet page state.
- Watching meeting join, leave, or page-change events.
- Sending page status messages to `background.ts`.
- Injecting lightweight UI hooks when needed.

### `dashboard.ts`

`dashboard.ts` powers the main meeting dashboard experience. It displays the current session state, transcript updates, generated summaries, action items, sentiment, and other meeting intelligence.

The dashboard should treat the background service worker and local storage as its source of truth. It should request current state, render it clearly, and update when new messages arrive.

Typical responsibilities include:

- Rendering transcript and summary output.
- Showing loading, empty, success, and error states.
- Displaying action items and sentiment.
- Reading stored session data from `chrome.storage.local`.
- Listening for updates from `background.ts`.

### `popup.ts`

`popup.ts` controls the extension popup that appears when the user clicks the extension icon. The popup is best suited for quick actions and status checks.

Typical responsibilities include:

- Showing whether the current tab is supported.
- Providing quick access to start or stop Late Meet.
- Linking to the dashboard and options page.
- Sending user commands to `background.ts`.

The popup should stay lightweight because it opens and closes frequently.

### `options.ts`

`options.ts` manages user settings. This includes API keys, provider configuration, and any preferences that affect transcription or summarization behavior.

Because Late Meet uses a bring-your-own-key model, the options page is important for keeping provider configuration local and user-controlled.

Typical responsibilities include:

- Saving OpenAI and ElevenLabs API keys.
- Reading existing settings from `chrome.storage.local`.
- Validating required configuration.
- Giving users a place to update or clear settings.

## Audio Capture Without a Bot Participant

Late Meet uses the Chrome `tabCapture` API to capture audio from the active Google Meet browser tab. This is different from joining the meeting with a separate bot account.

With `chrome.tabCapture`, the extension captures audio that is already playing in the user's Meet tab. No extra participant is added to the call, and there is no external meeting bot joining on behalf of the user.

The basic flow is:

1. The user opens or joins a Google Meet call.
2. Late Meet verifies that the active tab is a supported Meet tab.
3. The background service worker asks the Offscreen Document to start capture.
4. The Offscreen Document calls `chrome.tabCapture`.
5. The captured audio stream is processed for transcription.

This approach keeps the experience browser-native, but it also means the extension depends on Chrome-only extension APIs and the permissions required for tab audio capture.

## Message-Passing Flow

The extension components communicate through Chrome runtime messages and local storage updates.

```text
+------------------+
| Google Meet Tab  |
| content.ts       |
+--------+---------+
         |
         | meeting detected / page status
         v
+------------------+       create/manage       +------------------+
| background.ts    | -------------------------> | offscreen.ts     |
| Service Worker   |                            | Audio Engine     |
| "Conductor"      | <------------------------- |                  |
+---+----------+---+       status updates       +--------+---------+
    |          |                                      |
    |          | chrome.tabCapture audio stream       v
    |          |                              +------------------+
    |          |                              | Audio Chunks     |
    |          |                              +--------+---------+
    |          |                                       |
    |          | STT request                           v
    |          |                              +------------------+
    |          |                              | ElevenLabs       |
    |          |                              | Scribe API       |
    |          |                              +--------+---------+
    |          |                                       |
    |          | transcript                            v
    |          |                              +------------------+
    |          |                              | OpenAI GPT       |
    |          |                              | summaries,       |
    |          |                              | action items,    |
    |          |                              | sentiment        |
    |          |                              +--------+---------+
    |          |                                       |
    |          | processed output                      |
    v          v                                       v
+-------------------------------------------------------------+
| chrome.storage.local                                        |
| Local session state, settings, transcripts, generated output |
+-----------------------------+-------------------------------+
                              |
                              | read / render updates
                              v
                     +------------------+
                     | dashboard.ts     |
                     | Meeting output   |
                     +------------------+

+------------------+       user commands       +------------------+
| popup.ts         | -------------------------> | background.ts    |
+------------------+                            +------------------+

+------------------+       settings            +------------------+
| options.ts       | -------------------------> | chrome.storage   |
+------------------+                            +------------------+
```

## Audio and Transcription Pipeline

Late Meet's meeting intelligence pipeline starts with tab audio and ends with structured output for the dashboard.

1. `content.ts` or `popup.ts` signals that a supported meeting session should start.
2. `background.ts` prepares the extension state and ensures the Offscreen Document is available.
3. `offscreen.ts` starts audio capture with `chrome.tabCapture`.
4. The captured `MediaStream` is prepared into audio chunks.
5. Audio chunks are sent to the transcription provider.
6. ElevenLabs Scribe converts speech to text.
7. If configured fallback behavior is needed, OpenAI Whisper may be used for transcription.
8. Transcript text is sent to OpenAI GPT models for higher-level processing.
9. GPT output is transformed into summaries, action items, sentiment, and other dashboard-friendly data.
10. `background.ts` persists session state in `chrome.storage.local`.
11. `dashboard.ts` reads and renders the updated meeting output.

The exact implementation may evolve, but contributors should preserve the separation of responsibilities: audio work belongs in the Offscreen Document, coordination belongs in the background service worker, and display logic belongs in the dashboard.

## AI Provider Flow

Late Meet uses a BYOK model, meaning users bring their own OpenAI and ElevenLabs API keys.

### ElevenLabs Scribe

ElevenLabs Scribe is used for speech-to-text transcription. Audio captured from the Google Meet tab is prepared and sent to Scribe so meeting speech can become transcript text.

Provider calls should handle errors gracefully. If transcription fails, the extension should surface a useful error or use the configured fallback path rather than crashing the meeting session.

### OpenAI GPT Models

OpenAI GPT models process transcript text into useful meeting intelligence. Depending on the feature, this may include:

- Late-joiner summaries
- General meeting summaries
- Action items
- Sentiment or tone analysis
- Follow-up notes

Long meetings can exceed model token limits, so transcript processing should be designed around chunking, rolling context, or incremental summarization instead of assuming the entire meeting can always be sent at once.

## Local-First Storage

Late Meet stores session data locally with `chrome.storage.local`. This supports the project's local-first privacy model.

Data that may be stored locally includes:

- User settings
- API provider configuration
- Meeting session state
- Transcript text
- Generated summaries
- Action items
- Error or status information

The extension should not require a Late Meet server to store meeting data. Contributors should avoid adding server-side persistence unless the project explicitly decides to change its privacy model.

When adding new storage keys:

- Keep key names clear and specific.
- Avoid storing secrets outside the intended settings flow.
- Do not store unnecessary meeting data.
- Clean up temporary state when a meeting session ends.
- Preserve compatibility with existing stored data when possible.

## Manifest V3 Decisions

Late Meet is built for Manifest V3 because it is the current Chrome Extension standard. MV3 affects the architecture in several important ways.

### Service Worker Instead of Persistent Background Page

Manifest V3 uses a background service worker instead of a persistent background page. Service workers are event-driven and may be stopped when idle.

Because of this, `background.ts` should not be treated as a permanently running process. It should handle events, route messages, manage state carefully, and rely on storage or messages when state must survive worker restarts.

### Offscreen Document for Media Work

Some APIs and workflows require a document context. Audio processing is one of the areas where a normal service worker is not always enough.

Late Meet uses an Offscreen Document so audio capture and related media processing can happen in a hidden document while the extension remains compliant with MV3.

### Chrome-Specific APIs

Late Meet uses Chrome-specific extension APIs such as `chrome.tabCapture`, `chrome.storage.local`, and extension runtime messaging. These APIs are central to the current Google Meet and Chrome-only implementation.

Contributors should be careful when adding browser APIs. Check whether the API is available in Manifest V3 and whether it requires new permissions in `manifest.json`.

## Contributor Guidelines for Architecture Changes

When making architecture-level changes, keep the existing message-passing pipeline in mind.

Prefer these patterns:

- Keep page detection in `content.ts`.
- Keep orchestration and message routing in `background.ts`.
- Keep audio capture and media processing in `offscreen.ts`.
- Keep display rendering in `dashboard.ts`.
- Keep quick user actions in `popup.ts`.
- Keep user configuration in `options.ts`.
- Store session state locally with `chrome.storage.local`.

Avoid these patterns unless there is a strong reason:

- Putting long-running media work directly in the service worker.
- Adding server-side storage for meeting data.
- Mixing dashboard rendering logic into the background service worker.
- Calling AI providers directly from multiple unrelated components.
- Adding permissions without documenting why they are needed.

## Debugging Tips

Use Chrome's extension tools when debugging the architecture:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load the unpacked extension.
4. Inspect the service worker for `background.ts` logs.
5. Inspect the relevant extension page for popup, dashboard, or options logs.
6. Test on a real Google Meet tab when changing capture or content-script behavior.

For message-passing issues, log the message type, sender, and destination. For storage issues, check the expected `chrome.storage.local` keys before and after the user action.
