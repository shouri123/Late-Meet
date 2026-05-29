If you are new to Late Meet, start with the README first, then use this FAQ for common setup, privacy, and contribution questions.

# Frequently Asked Questions

This FAQ answers common questions from Late Meet users and contributors. It is intended to clarify the project's privacy model, browser requirements, AI provider setup, and contribution workflow.

## For Users

### Why do I need my own OpenAI and ElevenLabs API keys?

Late Meet follows a bring-your-own-key (BYOK) model. Instead of routing your meeting audio or transcript data through a shared project server, the extension lets you connect directly to the AI providers using your own API keys.

This keeps usage under your control, avoids storing provider credentials on Late Meet servers, and lets each user manage their own billing, limits, and provider account settings.

### Is my meeting data stored anywhere?

Late Meet does not store meeting data on project servers.

Meeting-related data is kept locally in your browser using `chrome.storage.local`. This means the data stays on your device unless you explicitly export, share, or remove it through browser or extension actions.

### Does Late Meet work on Zoom or Microsoft Teams?

Not yet. Late Meet currently supports Google Meet only.

Support for other meeting platforms such as Zoom and Microsoft Teams is planned for Roadmap Phase 3.

### What happens if ElevenLabs transcription fails?

If ElevenLabs transcription fails, Late Meet falls back to OpenAI Whisper for transcription.

This fallback helps keep transcription available even when the primary transcription provider is unavailable, rate-limited, or returns an error.

### Why does the extension need audio capture permissions?

Late Meet needs audio capture permissions so it can access meeting audio from Google Meet and generate transcripts, summaries, and related meeting insights.

The permission is required for the extension's core functionality. Audio is processed through the configured AI providers using your own API keys, and meeting data is stored locally rather than on Late Meet servers.

### What Chrome version do I need?

Late Meet requires Chrome 116 or newer for native Side Panel support.

If you are using an older Chrome version, update Chrome before installing or testing the extension.

## For Contributors

### What is BYOK and why did the project adopt it?

BYOK means "bring your own key." In Late Meet, users provide their own OpenAI and ElevenLabs API keys instead of relying on a shared backend or shared project-owned credentials.

The project adopted BYOK to keep the architecture privacy-focused, reduce backend infrastructure requirements, and give users direct control over provider accounts, billing, rate limits, and key management.

### Why Manifest V3 and not Manifest V2?

Late Meet uses Manifest V3 because it is the current Chrome extension platform standard.

Manifest V3 aligns the extension with Chrome's modern security, permissions, and service worker model. It also keeps the project compatible with current and future Chrome extension requirements.

### Why are Offscreen Documents used instead of a background page?

Manifest V3 replaces persistent background pages with extension service workers. Service workers are event-driven and do not provide a normal long-lived DOM environment.

Late Meet uses Offscreen Documents for browser extension tasks that need DOM or media-related capabilities outside the visible extension UI, such as audio processing workflows that cannot run directly inside the service worker.

### Can I add a new AI provider, such as Anthropic or Gemini?

Yes. New AI providers can be added if they fit the project's architecture and privacy model.

Before opening a pull request, check the existing provider integration patterns and open or comment on an issue describing the provider, the use case, required permissions, configuration changes, and any fallback behavior. This helps maintainers confirm that the provider aligns with Late Meet's BYOK approach.

### How do I get a GSSoC issue assigned to me?

Find an open issue labeled for GSSoC or suitable for contributors, then comment clearly that you would like to work on it.

Mention your intended approach if the issue needs implementation decisions. Wait for a maintainer to assign the issue before opening a pull request, unless the repository's contribution guidelines say otherwise.

## Related Links

- [README](README.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Roadmap](ROADMAP.md)
