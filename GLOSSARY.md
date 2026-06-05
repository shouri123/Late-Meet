# Glossary

This glossary explains common Late Meet terms in plain language. It is intended for new users and contributors, especially those who are new to Chrome Extension development or AI meeting tools.

## BYOK

BYOK stands for "Bring Your Own Key." In Late Meet, users provide their own API keys for services such as OpenAI and ElevenLabs instead of using a shared project-owned key.

This keeps the project privacy-focused and avoids routing all users through a central backend for AI provider access.

## Diarization

Diarization is the process of identifying who spoke when in an audio recording or transcript. In meeting tools, diarization helps separate speakers so summaries and transcripts are easier to understand.

Late Meet mentions diarization as part of Roadmap Phase 3, where the project plans to improve speaker-aware meeting intelligence.

## Glassmorphism

Glassmorphism is a UI design style that uses translucent surfaces, blur effects, soft borders, and layered depth to create a glass-like appearance. Late Meet uses this style to make the interface feel lightweight and modern.

When contributing UI changes, keep the existing visual direction consistent instead of mixing in unrelated design styles.

## Late-joiner briefing

Late-joiner briefing is the core feature of Late Meet. It helps users who join a Google Meet call late quickly understand what has already been discussed.

The feature uses meeting audio, transcription, and AI summarization to generate a catch-up summary so users can rejoin the conversation with context.

## Manifest V3

Manifest V3, often shortened to MV3, is the current Chrome Extension platform version used by Late Meet. It defines how the extension declares permissions, background behavior, content scripts, and browser APIs.

MV3 replaces persistent background pages with service workers, which affects how Late Meet handles background tasks and audio-processing workflows. See `manifest.json` for the extension's MV3 configuration.

## MV3

MV3 is the short name for Manifest V3. In Late Meet, MV3 matters because it shapes the extension architecture, including service workers, permissions, and offscreen documents.

If you are new to Chrome extensions, reading the `manifest.json` file is usually the fastest way to understand which browser capabilities the extension uses.

## Offscreen Document

An Offscreen Document is a hidden extension document that can run browser APIs or DOM-based workflows that are not available directly inside a Manifest V3 service worker. Late Meet uses it for audio-related processing that needs a document context.

This is needed because MV3 service workers are event-driven and do not behave like long-lived background pages. See `src/offscreen.ts` for the offscreen document logic.

## Rolling LLM context prompting

Rolling LLM context prompting is a summarization strategy for handling long meetings without sending the entire transcript to the AI model every time. Instead, the system keeps a moving context window and updates the summary as new transcript chunks arrive.

This helps Late Meet manage token limits while still producing useful summaries during an ongoing meeting.

## Scribe

Scribe is ElevenLabs' Speech-to-Text API used for transcription. In Late Meet, it is used to convert meeting audio into text that can later be summarized or processed.

If Scribe transcription fails, Late Meet falls back to OpenAI Whisper so transcription can still continue when possible.

## Service Worker

A Service Worker is the background script model used by Manifest V3 Chrome extensions. Unlike older persistent background pages, service workers start when needed and can be stopped by the browser when idle.

Late Meet uses a service worker for extension-level background coordination, while DOM or media workflows that cannot run there are handled through the offscreen document.

## STT

STT stands for Speech-to-Text. It refers to converting spoken audio into written text.

Late Meet uses STT providers such as ElevenLabs Scribe and OpenAI Whisper to turn meeting audio into transcripts.

## tabCapture

`tabCapture` is a Chrome extension API that can capture audio or video from a browser tab. Late Meet uses this capability to capture audio from the active Google Meet tab.

This API is one reason the extension needs Chrome-specific permissions and currently focuses on Google Meet in Chrome.
