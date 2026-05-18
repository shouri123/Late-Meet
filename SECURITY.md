# Security Policy

Late Meet is built with a **privacy-first, local-only** architecture. Security is a core design principle, not an afterthought.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## BYOK (Bring Your Own Key) Model

Late Meet follows a strict BYOK model. Users provide their own API keys for:

- **ElevenLabs** — Speech-to-text transcription
- **OpenAI** — Meeting summarization and intelligence

The extension never ships with, stores, or manages API keys on behalf of users beyond their own browser.

## Data Handling

- **Local storage only**: All meeting data (transcripts, summaries, action items) is stored exclusively in `chrome.storage.local`. No external databases, no cloud sync, no telemetry.
- **No remote servers**: The extension communicates only with the AI API endpoints you configure (OpenAI, ElevenLabs). No data is sent to any Late Meet server.
- **Session control**: After each meeting, users can choose to **Save** or **Discard** all session data. Nothing persists without explicit consent.
- **No user tracking**: No analytics, no usage telemetry, no cookies, no fingerprinting.

## API Key Storage

- API keys are stored locally in `chrome.storage.local` within the browser profile.
- Keys are never transmitted to any server other than the respective API providers (OpenAI, ElevenLabs).
- Keys are never logged, cached externally, or included in any error reports.

## Reporting a Vulnerability

Security is a priority for this project. If you discover a security issue or vulnerability, **please do not open a public issue on GitHub**.

Instead, responsibly report it privately by emailing us at **chakrabortyshouri@gmail.com**. Please include:

- A detailed description of the vulnerability.
- Steps to reproduce the issue.
- Any possible mitigation steps or workarounds if you have them.

We will acknowledge your email promptly, investigate the issue, and release a fix as soon as possible. We ask that you do not publicly disclose the vulnerability until we have had a chance to issue a patch and notify our users.
