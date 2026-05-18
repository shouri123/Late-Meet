# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-05-13

### Added

- Native Google Meet integration via Chrome `tabCapture` API — no bot participants.
- Real-time audio capture using Offscreen Documents and `MediaRecorder` API.
- ElevenLabs Scribe v2 integration for high-fidelity, multilingual transcription.
- OpenAI Whisper fallback for transcription when ElevenLabs is unavailable.
- OpenAI GPT-powered summarization with rolling context window.
- Late-joiner detection with automated private briefing overlays.
- Host-first (1+N) participant tracking for accurate reporting.
- Side panel dashboard with live summary, topics, decisions, action items, and sentiment analysis.
- Premium monochrome UI with glassmorphism effects and smooth animations.
- BYOK (Bring Your Own Key) model — users provide their own API keys.
- Options page for API key configuration (ElevenLabs + OpenAI).
- Local-first storage using `chrome.storage.local` — no external databases.
- Session save/discard workflow — nothing persists without user consent.
- Manifest V3 compliant architecture with TypeScript and Vite 5 build system.

### Removed

- All Supabase/backend dependencies (migrated to fully local architecture).

### Security

- No telemetry, no analytics, no user tracking.
- API keys stored only in local browser storage.
- No data transmitted to any server other than user-configured API endpoints.
