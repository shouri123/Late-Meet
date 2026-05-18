# Late Meet Roadmap

This roadmap outlines the planned features and long-term vision for Late Meet. Our goal is to build the most privacy-respecting, intelligent meeting copilot that lives entirely in your browser.

## ✅ Completed

### Phase 1: Core Foundation

- [x] Native Google Meet integration without bot participants
- [x] Real-time audio capture via Chrome Offscreen APIs
- [x] Premium monochrome UI extension & side panel
- [x] BYOK (Bring Your Own Key) integration for API access
- [x] Manifest V3 compliant architecture

### Phase 2: Local & Privacy Overhaul

- [x] Strip all Supabase/backend dependencies
- [x] Local-first session management via `chrome.storage.local`
- [x] ElevenLabs Scribe integration for superior transcription
- [x] Intelligent rolling LLM context prompting
- [x] Late-joiner detection and automated briefing overlays

---

## 🔄 Planned Features

### 🟢 Beginner-Friendly

- [ ] Add screenshots and demo GIF to README
- [ ] Export meeting summary as `.md` file
- [ ] Copy-to-clipboard for action items and decisions
- [ ] Dark/light mode toggle for side panel
- [ ] Improve onboarding experience in Options page
- [ ] Better error messages for invalid or expired API keys

### 🟡 Intermediate

- [ ] Meeting summary templates (standup, retrospective, 1:1)
- [ ] Local transcript search within side panel
- [ ] Meeting history page with past session recall
- [ ] Chrome keyboard shortcuts to start/stop copilot
- [ ] Multi-language summary output
- [ ] Action item detection with assignee routing

### 🔴 Advanced

- [ ] Offline transcription using local Whisper / WebGPU
- [ ] Speaker diarization (identify who said what)
- [ ] Zoom and Microsoft Teams support
- [ ] End-to-end encrypted local meeting archive
- [ ] Plugin system for custom summary formats
- [ ] Privacy audit dashboard (show what data exists and where)
- [ ] Voice Activity Detection (VAD) to reduce API costs

---

_Note: This roadmap is a living document. Priorities may shift based on community feedback and contributions. Have an idea? [Open an issue!](https://github.com/shouri123/Late-Meet/issues)_
