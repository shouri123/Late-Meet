# Architecture

Late Meet is a **Manifest V3 Chrome Extension** built with TypeScript and Vite 5. It captures meeting audio directly from the browser tab, transcribes it using AI, and presents real-time intelligence through a side panel dashboard — all without adding bots to your call.

## High-Level Overview

![Late Meet Architecture](assets/diagrams/architecture.svg)

[![Open Interactive Diagram](https://img.shields.io/badge/Open%20Interactive%20Diagram-Click%20Here-coral?style=for-the-badge&logo=googlechrome)](https://htmlpreview.github.io/?https://github.com/shouri123/Late-Meet/blob/main/docs/assets/diagrams/architecture.html)

## Core Components

| Component                     | File(s)                                           | Responsibility                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Background Service Worker** | `background.ts`                                   | Central state machine. Detects Meet tabs, routes audio to STT APIs, coordinates LLM summarization, manages session lifecycle, and handles participant tracking.   |
| **Offscreen Audio Engine**    | `offscreen.ts`, `offscreen.html`                  | Runs a hidden offscreen document for `chrome.tabCapture`. Captures audio via `MediaRecorder`, processes chunks, and forwards blobs to the background worker.      |
| **Content Script**            | `content.ts`, `content.css`                       | Injects floating UI elements into Google Meet pages. Handles the "Start Copilot" button, late-joiner briefing overlays, and chat automation for welcome messages. |
| **Side Panel Dashboard**      | `dashboard.ts`, `dashboard.html`, `dashboard.css` | Real-time intelligence display. Shows live summary, topics, decisions, action items, sentiment analysis, and meeting timeline.                                    |
| **Popup**                     | `popup.ts`, `popup.html`, `popup.css`             | Quick-access extension controls. Start/stop copilot, view meeting status, navigate to dashboard.                                                                  |
| **Options Page**              | `options.ts`, `options.html`, `options.css`       | API key configuration. Users enter their ElevenLabs and OpenAI keys (BYOK model).                                                                                 |
| **Audio Processing**          | `audioProcessing.ts`                              | Utility functions for audio format handling and MIME type detection.                                                                                              |
| **Type Definitions**          | `types.ts`                                        | TypeScript interfaces for meeting state, participants, timeline entries, etc.                                                                                     |

## 🔄 Data Flow

Every meeting session follows this end-to-end pipeline — from the moment you join a call to the final dashboard output.

| Step | Component                   | Action                                                                       |
| :--: | --------------------------- | ---------------------------------------------------------------------------- |
|  1   | 🌐 **Google Meet tab**      | User joins a meeting                                                         |
|  2   | 📄 **Content script**       | Detects meeting → injects **Start Copilot** button                           |
|  3   | 👆 **User**                 | Clicks Start → message sent to background worker                             |
|  4   | ⚙️ **Background**           | Creates offscreen document → begins `tabCapture` stream                      |
|  5   | 🎙️ **Offscreen document**   | Captures audio chunks via `MediaRecorder` → produces blobs                   |
|  6   | 🔊 **ElevenLabs Scribe**    | Receives audio blobs → returns transcribed text (Whisper fallback if needed) |
|  7   | 📝 **Background**           | Appends transcript → maintains rolling context window                        |
|  8   | 🤖 **OpenAI GPT**           | Processes transcript → generates structured intelligence                     |
|  9   | 💾 **chrome.storage.local** | Structured results saved locally                                             |
|  10  | 📊 **Side panel dashboard** | Polls storage → renders live updates                                         |
|  11  | ✅ **User**                 | Meeting ends → chooses **Save** or **Discard**                               |

### What OpenAI GPT generates at Step 8

| Output              | Description                                          |
| ------------------- | ---------------------------------------------------- |
| 📋 **Summary**      | Concise overview of what was discussed               |
| 🏷️ **Topics**       | Key subjects and themes extracted from the meeting   |
| ✅ **Action items** | Tasks identified with implicit or explicit ownership |
| 🎯 **Decisions**    | Conclusions and commitments made during the meeting  |
| 💬 **Sentiment**    | Tone and confidence analysis across the conversation |

> 💡 **For contributors:** The separation of responsibilities must be preserved — audio work belongs in `offscreen.ts`, coordination in `background.ts`, and display logic in `dashboard.ts`. See [Contributor Guidelines](#-contributor-guidelines-for-architecture-changes) before making pipeline changes.

---

## 📡 Message Passing Flow

Late Meet components never call each other directly — they communicate exclusively through **Chrome runtime messages** and **local storage updates**. This keeps each component decoupled and testable in isolation.

### Communication Overview

| Sender          | Receiver               | Message Type        | Trigger                              |
| --------------- | ---------------------- | ------------------- | ------------------------------------ |
| `content.ts`    | `background.ts`        | Page status         | Meeting detected / page changed      |
| `popup.ts`      | `background.ts`        | User command        | Start / Stop copilot clicked         |
| `background.ts` | `offscreen.ts`         | Capture control     | Create / destroy audio stream        |
| `offscreen.ts`  | `background.ts`        | Status update       | Audio chunks ready / capture stopped |
| `background.ts` | `dashboard.ts`         | Intelligence update | New transcript / summary ready       |
| `options.ts`    | `chrome.storage.local` | Settings write      | API keys saved                       |
| `dashboard.ts`  | `chrome.storage.local` | Settings read       | Dashboard loads / refreshes          |

### Key Rules for Message Passing

> [!IMPORTANT]
> **Never call component functions directly.** All cross-component communication must go through `chrome.runtime.sendMessage` or `chrome.storage` updates. Direct imports between components break the MV3 architecture.

- **background.ts is the only hub** — all messages route through it, not directly between components
- **content.ts only sends, never receives** complex state — it detects and reports, background.ts decides
- **dashboard.ts only reads** — it should never write business logic back to background.ts
- **offscreen.ts is isolated** — it only talks to background.ts, never directly to content.ts or dashboard.ts
- **options.ts writes to storage directly** — it does not need to go through background.ts for settings saves

---

## Privacy Model

- **BYOK**: Users supply their own API keys. No shared credentials.
- **Local-only storage**: All data lives in `chrome.storage.local`. Zero cloud sync.
- **No telemetry**: No analytics, no tracking, no usage data collection.
- **Invisible**: No bot participant added to the meeting. Audio captured via Chrome's native `tabCapture` API.
- **User-controlled lifecycle**: Data can be discarded at any time.

## Technology Stack

| Category           | Technology                                                |
| ------------------ | --------------------------------------------------------- |
| Extension Platform | Chrome Manifest V3                                        |
| Language           | TypeScript                                                |
| Build Tool         | Vite 5 with `@crxjs/vite-plugin`                          |
| Styling            | Vanilla CSS (monochrome design system)                    |
| Storage            | `chrome.storage.local`                                    |
| Transcription      | ElevenLabs Scribe v2 (primary), OpenAI Whisper (fallback) |
| Summarization      | OpenAI GPT models (configurable)                          |
| Audio Capture      | Chrome `tabCapture` + Offscreen Documents API             |

## ⚙️ Manifest V3 Decisions

Late Meet is built exclusively for **Manifest V3** — the current and future standard for Chrome Extensions. MV3 introduces important architectural constraints that directly shape how Late Meet is designed.

### Service Worker Instead of Persistent Background Page

MV3 replaces the old persistent background page with an **event-driven service worker**. This means `background.ts` can be stopped by Chrome at any time when idle — it is not a permanently running process.

> **What this means for contributors:** Never rely on in-memory state surviving between events. Always persist important state to `chrome.storage.local` and re-read it when needed. Design message handlers to be stateless and self-contained.

### Offscreen Document for Media Work

Chrome's MV3 service workers cannot access media APIs like `MediaRecorder` or `chrome.tabCapture` directly — they require a document context. Late Meet solves this by spinning up a hidden **Offscreen Document** (`offscreen.ts`) whenever audio capture is needed.

> **What this means for contributors:** All audio capture and media processing must stay inside `offscreen.ts`. Do not attempt to move media work into the service worker — it will not work in MV3.

### Chrome-Specific APIs

Late Meet relies on Chrome-only APIs including `chrome.tabCapture`, `chrome.storage.local`, and `chrome.sidePanel`. These are intentional choices for the current Google Meet + Chrome implementation.

> **What this means for contributors:** Always verify that any new browser API you use is available in MV3 and check whether it requires new permissions in `manifest.json`. Document any new permission additions clearly in your PR.

## 🧭 Contributor Guidelines for Architecture Changes

> 📖 New to contributing? Start with the [Contributor Guide](CONTRIBUTOR_GUIDE.md) first for the full contribution workflow, then come back here for architecture-specific rules.

Before making any architecture-level change, read this section carefully. Late Meet follows a strict **separation of concerns** — each component owns a specific layer and should not bleed into others.

### ✅ Preferred Patterns

| Component              | Owns                                              |
| ---------------------- | ------------------------------------------------- |
| `content.ts`           | Page detection, UI injection, Meet page state     |
| `background.ts`        | Orchestration, message routing, session lifecycle |
| `offscreen.ts`         | Audio capture, MediaRecorder, stream processing   |
| `dashboard.ts`         | Display rendering, storage reads, live updates    |
| `popup.ts`             | Quick user actions, status display                |
| `options.ts`           | User configuration, API key management            |
| `chrome.storage.local` | All persistent session state                      |

### ❌ Patterns to Avoid

- **Long-running media work in the service worker** — use the Offscreen Document instead
- **Server-side storage for meeting data** — Late Meet is local-first; never add cloud persistence without an explicit project decision
- **Dashboard rendering logic in background.ts** — keep display concerns in `dashboard.ts`
- **Calling AI providers from multiple components** — all provider calls should be coordinated through `background.ts`
- **Adding new permissions silently** — every new `manifest.json` permission must be justified and documented in the PR

### 💡 General Advice

- When in doubt about where logic belongs, follow the existing message-passing pattern
- Keep components focused — if a file is growing too large, that's a signal to extract a utility
- Test message-passing changes on a real Google Meet tab, not just in isolation

## 🐛 Debugging Tips

Use Chrome's built-in extension tools when debugging architecture-level issues.

### Setup

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked** → select the `dist/` folder
4. Use the **Inspect** links to open DevTools for each component

> 📽️ For a visual walkthrough of the full setup process, see [docs/DEMO.md](DEMO.md)

### Component-Specific Debugging

| Component       | How to inspect                                                               |
| --------------- | ---------------------------------------------------------------------------- |
| `background.ts` | Click **Service Worker** link on the extension card in `chrome://extensions` |
| `popup.ts`      | Right-click the extension icon → **Inspect popup**                           |
| `dashboard.ts`  | Open the side panel → right-click → **Inspect**                              |
| `options.ts`    | Open the options page → right-click → **Inspect**                            |
| `content.ts`    | Open DevTools on the Google Meet tab → **Console**                           |
| `offscreen.ts`  | Appears as a separate target in `chrome://inspect/#other`                    |

### Common Debugging Tips

- **Message-passing issues** — log the message `type`, `sender`, and intended destination at both ends
- **Storage issues** — use `chrome.storage.local.get(null, console.log)` in the service worker console to dump all stored keys
- **Audio capture issues** — always test on a real Google Meet tab; mock environments won't trigger `tabCapture` correctly
- **Service worker stopped** — if background logs aren't appearing, click **Service Worker** in `chrome://extensions` to wake it up
