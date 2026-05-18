<div align="center">
  <img src="src/icons/icon128.png" alt="Late Meet Logo" width="120" />

# Late Meet — Privacy-First AI Meeting Copilot

**Catch up instantly when you join a meeting late — without bots, servers, or transcript storage.**

[![GSSoC 2026](https://img.shields.io/badge/GSSoC-2026-orange?style=for-the-badge&logo=git&logoColor=white)](https://gssoc.girlscript.tech/)
[![Version](https://img.shields.io/badge/Version-1.1.0-black?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/shouri123/Late-Meet)
[![License](https://img.shields.io/badge/License-MIT-black?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Google_Meet-black?style=for-the-badge&logo=googlemeet)](https://meet.google.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-black?style=for-the-badge)](CONTRIBUTING.md)

</div>

---

> [!IMPORTANT]
> **Repository Scope Notice:** The website linked in this project's metadata is **not** part of this repository.
>
> - Please **do not** open issues regarding UI/UX design changes or bugs for the website here.
> - This repository is dedicated exclusively to the **Late Meet Chrome Extension**.
> - All contributions, bug reports, and features must focus entirely on the Chrome Extension source code.

---

## 📌 Table of Contents

- [🌟 The Problem](#-the-problem)
- [💡 Our Solution](#-our-solution)
- [✨ Key Features](#-key-features)
- [🏗️ Architecture & How It Works](#%EF%B8%8F-architecture--how-it-works)
- [📁 Project Directory Structure](#-project-directory-structure)
- [⚙️ Installation & Developer Setup](#%EF%B8%8F-installation--developer-setup)
- [🛠️ Technology Stack](#%EF%B8%8F-technology-stack)
- [🧡 GSSoC 2026 Contribution Guide](#-gssoc-2026-contribution-guide)
- [🚀 Active & Open GSSoC 2026 Issues](#-active--open-gssoc-2026-issues)
- [🗺️ Project Roadmap](#%EF%B8%8F-project-roadmap)
- [🐛 Known Issues](#-known-issues)
- [🔒 Security & Privacy First](#-security--privacy-first)
- [📜 License](#-license)

---

## 🌟 The Problem

Joining a meeting late or losing focus for a moment leaves participants disconnected and scrambling for context. Existing AI note-takers add an obnoxious **"Bot has joined"** participant to your call, invade your team's privacy by storing transcripts on remote servers, and often generate massive, unreadable blocks of text instead of punchy, actionable insights.

---

## 💡 Our Solution

**Late Meet** lives entirely natively within your browser. Without adding any disruptive bots to the call, it securely captures audio directly from the Chrome tab. It leverages **ElevenLabs' Scribe API** for state-of-the-art multilingual transcription and **OpenAI GPT models** for intelligent summarization, presenting a stunning, high-performance side-panel dashboard.

We designed this with a **local-first philosophy**: all meeting data is processed locally using `chrome.storage.local` during the session, and you only need your own API keys. No external databases. No user tracking.

---

## ✨ Key Features

- **Invisible & Native:** Uses modern Chrome `tabCapture` and Offscreen APIs to intercept audio securely without adding bots to the participant list.
- **High-Fidelity Transcription:** Utilizes the **ElevenLabs Speech-to-Text API (Scribe)** for industry-leading accuracy and robust multilingual support, gracefully falling back to OpenAI Whisper if needed.
- **Late-Joiner Briefings:** Instantly catches up late participants with targeted, private overlays summarizing missed context via hardened UI automation.
- **Proactive Intelligence:** Automatically detects meetings and initializes host-first (1+N) participant tracking for accurate reporting.
- **Bring Your Own Key (BYOK):** Full control over your data. Supply your own ElevenLabs and OpenAI API keys via the extension options.
- **Premium Interface:** A visually striking deep-monochrome UI with glassmorphism effects, smooth animations, and zero clutter.

---

## 🏗️ Architecture & How It Works

The extension is built natively on Manifest V3 using **TypeScript and Vite 5** for a modern, optimized build process.

```
┌─────────────────────────────────────────────────────────┐
│                    Google Meet Tab                      │
│                  (meet.google.com)                      │
└──────────────┬──────────────────────────────────────────┘
               │ Audio stream via chrome.tabCapture
               ▼
┌──────────────────────────┐    ┌─────────────────────────┐
│   Offscreen Document     │    │    Content Script       │
│   (offscreen.ts)         │    │    (content.ts)         │
│                          │    │                         │
│  • Audio chunk capture   │    │  • Floating UI buttons  │
│  • MediaRecorder API     │    │  • Late-joiner overlays │
│  • Stream processing     │    │  • Chat automation      │
└──────────┬───────────────┘    └──────────┬──────────────┘
           │ Audio blobs                   │ UI events
           ▼                               ▼
┌─────────────────────────────────────────────────────────┐
│              Background Service Worker                  │
│              (background.ts — The Conductor)            │
│                                                         │
│  • Central state manager        • Meeting detection     │
│  • Audio routing to STT APIs    • Participant tracking  │
│  • LLM summarization calls      • Late-joiner briefings │
│  • Session lifecycle mgmt       • Message coordination  │
└──────┬───────────────┬──────────────────┬───────────────┘
       │               │                  │
       ▼               ▼                  ▼
┌──────────┐   ┌──────────────┐   ┌──────────────────────┐
│ElevenLabs│   │   OpenAI     │   │ chrome.storage.local │
│ Scribe   │   │   GPT API   │   │                       │
│ STT API  │   │              │   │  • Transcripts       │
│          │   │  • Summaries │   │  • Summaries         │
│ Fallback:│   │  • Insights  │   │  • Action items      │
│ Whisper  │   │  • Actions   │   │  • API keys          │
└──────────┘   └──────────────┘   └──────────────────────┘
                                              │
                                              ▼
                                      ┌──────────────────┐
                                      │  Side Panel UI   │
                                      │  (dashboard.ts)  │
                                      │                  │
                                      │  • Live summary  │
                                      │  • Topics        │
                                      │  • Action items  │
                                      │  • Sentiment     │
                                      │  • Timeline      │
                                      └──────────────────┘
```

1. **`background.ts` (The Conductor):** Acts as the central state manager. It detects Meet tabs, routes audio chunks to ElevenLabs for transcription, and coordinates intelligence queries with OpenAI.
2. **`offscreen.html` & `offscreen.ts` (The Audio Engine):** Runs a hidden offscreen document for `chrome.tabCapture`. It processes audio in chunks, ensuring zero data loss and handling raw media streams.
3. **`content.ts` (The UI Injector):** Injects floating buttons and briefing overlays. It features a hardened chat automation engine to reliably deliver welcome messages to late joiners.
4. **AI Intelligence Layer:** Uses ElevenLabs STT for capturing speech and dynamic GPT models (like `gpt-4o-mini`) for processing text into structured insights, including Decisions, Action Items, and Strategic Sentiment.
5. **Local Storage:** Securely stores session data in `chrome.storage.local`. After each meeting, you decide to Save or Discard—nothing leaves your browser without your consent.

> 📖 For a detailed technical deep-dive, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 📁 Project Directory Structure

```
├── .github/                     # GitHub Issue & PR templates, and workflows
│   ├── ISSUE_TEMPLATE/          # Structured templates for Bugs & Features
│   └── workflows/               # Automated CI (lint, formatting, stale management)
├── docs/                        # Project technical documentation
├── src/                         # Chrome Extension Source Code (TypeScript)
│   ├── icons/                   # Native branding and UI icons
│   ├── utils/                   # Shared utility logic (API, Prompts, etc.)
│   ├── audioProcessing.ts       # Audio stream and formatting handlers
│   ├── background.ts            # Extension service worker (Conductor)
│   ├── content.ts & content.css # Content scripts injected into Google Meet
│   ├── dashboard.ts & html      # Real-time side-panel dashboard UI
│   ├── options.ts & html        # Options page to configure API keys
│   ├── popup.ts & html          # Quick-action extension popover
│   └── types.ts                 # Type definitions used across components
├── .eslintrc.json               # Logic checker settings (ESLint)
├── .eslintignore                # ESLint path exclusions
├── .prettierrc                  # Formatter code style preferences
├── .prettierignore              # Formatter file exclusions
├── lint-staged.config.js        # Config to format only staged files on commit
├── package.json                 # Project scripts, tools, and devDependencies
├── tsconfig.json                # TypeScript compilation parameters
└── vite.config.ts               # Bundling configuration
```

---

## ⚙️ Installation & Developer Setup

### Prerequisites

- Google Chrome (Chrome 116+ recommended for native Side Panel Support).
- Node.js (v18+ recommended) and npm.

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/shouri123/Late-Meet.git
   cd Late-Meet
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Build the extension:**
   ```bash
   npm run build
   ```
   _This compiles TypeScript and builds assets into the `dist/` directory._
4. **Load into Google Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked** in the top-left and select the **`dist/`** folder (NOT the root or `src/` folder).
5. **Configure Options:**
   - Click the extension icon in the toolbar, open the **Options** menu.
   - Enter your **ElevenLabs API Key** and **OpenAI API Key** (Bring Your Own Key model).
6. **Start Copilot:**
   - Join a Google Meet call.
   - Click the floating **Start Copilot** button, and open the full Side Panel to view real-time meeting briefings!

---

## 🛠️ Technology Stack

- **Extension Architecture:** Manifest V3 compliant, Offscreen Documents, Service Workers.
- **Build Tools:** TypeScript, Vite 5, `@crxjs/vite-plugin`.
- **Design System:** Custom Vanilla CSS, high-contrast monochrome aesthetic, SVG-native iconography.
- **Storage:** `chrome.storage.local` (Local-first, NO BAAS dependencies).
- **AI Pipeline:** ElevenLabs STT (Scribe v2) for transcription, and dynamic GPT models for Intelligence/Summarization.

---

## 🧡 GSSoC 2026 Contribution Guide

We are extremely excited to welcome contributors from the **GirlScript Summer of Code (GSSoC) 2026** cohort! Late Meet is dedicated to fostering a supportive, premium, and structured open-source environment.

> [!WARNING]
> **Important Rule for GSSoC Contributes:**
>
> - Please **Fork the repository** and create a feature branch (`git checkout -b feature/your-feature`) from your fork. Direct pushes to the main repo are blocked.
> - Always request issue assignment by commenting on open issues before working on them.
> - Remember to **Star this repository** ⭐ before making your contribution request—it helps us grow and shows your support!

### How to Get Started

1. Browse our [Issues board](https://github.com/shouri123/Late-Meet/issues) and look for issues marked with `gssoc` and difficulty levels:
   - **`level-1`** (Beginner-friendly tasks, formatting, styling)
   - **`level-2`** (Intermediate logic, component expansions)
   - **`level-3`** (Advanced feature implementations, optimization, API integrations)
2. Leave a comment requesting assignment, e.g., _"I want to work on this under GSSoC 2026. Please assign it to me!"_
3. Once assigned by a maintainer, implement your changes.

### Local Standards Checklist (Mandatory before submitting a PR)

Before making a commit, make sure your code aligns perfectly with our quality checks. The CI will check these automatically:

- **Prettier (Code Formatting):** Automatically format your code style.
  ```bash
  npm run format
  ```
- **ESLint (Logic Linting):** Run the logical static checks. Ensure you have zero errors.
  ```bash
  npm run lint
  ```
- **TypeScript (Type-Checking):** Verify your code compiles perfectly without type mismatches.
  ```bash
  npm run type-check
  ```

---

## 🚀 Active & Open GSSoC 2026 Issues

Here is the official bank of **14 active and open issues** currently available for GSSoC 2026 contributors. You can click on the issue link to claim it on GitHub!

### ✨ Category 1: Feature Requests

| Issue #                                                 | Title                                                                | Difficulty      | Value Proposition                                                                 |
| :------------------------------------------------------ | :------------------------------------------------------------------- | :-------------- | :-------------------------------------------------------------------------------- |
| [#34](https://github.com/shouri123/Late-Meet/issues/34) | Silent Audio Chunk Filtering via Voice Activity Detection (VAD)      | 🔴 Advanced     | Minimizes ElevenLabs transcription costs by dropping silent audio slices locally. |
| [#35](https://github.com/shouri123/Late-Meet/issues/35) | Zero-Overhead Speaker Diarization using Meet's DOM Indicators        | 🟡 Intermediate | Replaces generic `"Audio"` speaker tags with actual participant names.            |
| [#36](https://github.com/shouri123/Late-Meet/issues/36) | Offline-Resilient API Request Queue with Jittered Backoff            | 🟡 Intermediate | Enqueues and retries requests during brief internet drops without data loss.      |
| [#37](https://github.com/shouri123/Late-Meet/issues/37) | Dual-Channel Exporter (Markdown & JSON Files) with Side-Panel Toasts | 🟢 Beginner     | Allows direct downloads of session data and modern clipboard copy toasts.         |
| [#38](https://github.com/shouri123/Late-Meet/issues/38) | Dynamic Conversational Slicing via Vocal Pause Detection             | 🔴 Advanced     | Cuts chunks naturally during speech pauses instead of arbitrary 10s intervals.    |
| [#39](https://github.com/shouri123/Late-Meet/issues/39) | Context Menu Capturer for Generalized Tab Audio Integration          | 🟡 Intermediate | Expands transcription capabilities to YouTube, Zoom, or WebEx tabs.               |
| [#41](https://github.com/shouri123/Late-Meet/issues/41) | Sleek Dark/Light Mode Theme Synchronization & Accent Color Picker    | 🟡 Intermediate | Enhances options and popups visual aesthetics using modern CSS variables.         |
| [#42](https://github.com/shouri123/Late-Meet/issues/42) | Real-Time Canvas Audio Waveform Visualizer in Dashboard Panel        | 🔴 Advanced     | Animates live canvas voice waves when recording, making the UI feel alive.        |
| [#43](https://github.com/shouri123/Late-Meet/issues/43) | Interactive Action-Item Checker with Native Chrome Toast Alerts      | 🟡 Intermediate | Triggers native desktop notifications and interactive in-panel checklists.        |
| [#44](https://github.com/shouri123/Late-Meet/issues/44) | Local API Cost & Token Usage Statistics Tracker Dashboard Widget     | 🟢 Beginner     | Provides live metrics on token counts and estimated billing in USD.               |

### 🐛 Category 2: Bug Reports

| Issue #                                                 | Title                                                               | Difficulty      | Value Proposition                                                             |
| :------------------------------------------------------ | :------------------------------------------------------------------ | :-------------- | :---------------------------------------------------------------------------- |
| [#40](https://github.com/shouri123/Late-Meet/issues/40) | Asynchronous Onboarding Key Validation with UX Shaking Feedback     | 🟢 Beginner     | Stops silent background transcription failures caused by expired/typo'd keys. |
| [#45](https://github.com/shouri123/Late-Meet/issues/45) | MediaRecorder Audio State Synchronization Crash on Sudden Tab Close | 🟡 Intermediate | Gracefully terminates and saves offscreen media pipelines when a tab crashes. |

### 📄 Category 3: General Refactoring & Improvements (Blank Issues)

| Issue #                                                 | Title                                                                      | Difficulty  | Value Proposition                                                             |
| :------------------------------------------------------ | :------------------------------------------------------------------------- | :---------- | :---------------------------------------------------------------------------- |
| [#46](https://github.com/shouri123/Late-Meet/issues/46) | Migrate Core Utility Modules (`api.js`, `prompts.js`) to Strict TypeScript | 🟢 Beginner | Enforces strict type checking and deletes legacy JavaScript compile includes. |

### 🛡️ Category 4: Security & Compliance Reports

| Issue #                                                 | Title                                                             | Difficulty      | Value Proposition                                                                 |
| :------------------------------------------------------ | :---------------------------------------------------------------- | :-------------- | :-------------------------------------------------------------------------------- |
| [#47](https://github.com/shouri123/Late-Meet/issues/47) | Secure Storage for API Credentials using RAM-Only Session Storage | 🟡 Intermediate | Prevents malicious disk extraction of API keys by migrating to `storage.session`. |

---

## 🗺️ Project Roadmap

### Phase 1: Core Foundation ✅

- Native Google Meet integration without bot participants.
- Real-time offline audio capture via Chrome Offscreen APIs.
- Premium monochrome UI extension & side panel.
- BYOK integration for processing.

### Phase 2: Local & Privacy Overhaul ✅

- Strip Supabase/backend dependencies.
- Local-first session management and storage.
- ElevenLabs Scribe integration for superior transcription.
- Intelligent rolling LLM context prompting.

### Phase 3: Platform Expansion 🔄 _(Planned)_

- **Offline/Native Support:** Offline transcription via local Whisper / WebGPU.
- **Smart Tracking:** Speaker diarization and action item assignee routing.
- **Multi-Platform:** Zoom and Microsoft Teams support.
- **On-the-fly Translation:** Bridging language gaps during international calls.

---

## 🐛 Known Issues

| Issue                                                                                           | Status      | Link                                                  |
| :---------------------------------------------------------------------------------------------- | :---------- | :---------------------------------------------------- |
| Audio capture intermittently fails after migration from OpenAI Whisper to ElevenLabs Scribe STT | 🟢 Resolved | [#1](https://github.com/shouri123/Late-Meet/issues/1) |

> Found another bug? Choose one of our GSSoC templates and open a detailed bug report on our [Issues](https://github.com/shouri123/Late-Meet/issues) board.

---

## 🔒 Security & Privacy First

Late Meet follows a strict **BYOK (Bring Your Own Key)** model with **local-only data storage**. No meeting data ever leaves your browser without your consent.

If you discover a security vulnerability, **please do not open a public issue**. Report it privately to **chakrabortyshouri@gmail.com**.

---

## 📜 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.

<div align="center">
  <br />
  <i>Built for high-performance teams who value focus, privacy, and speed. 🚀</i>
</div>
