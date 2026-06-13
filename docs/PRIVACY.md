# Privacy Model

Late Meet is designed around a privacy-first browser extension workflow. It avoids meeting bots, avoids a project-managed database, and uses user-owned API keys.

## Privacy Principles

- No bot participant joins the meeting.
- The extension runs inside the user's browser.
- Users bring their own provider keys.
- Meeting state is stored locally during the session.
- Users decide what to save, export, or discard.

## Data Flow

1. Late Meet runs in Chrome as a Manifest V3 extension.
2. Google Meet tab audio is captured through browser extension APIs.
3. Audio chunks are processed by the extension workflow.
4. Transcription is sent to the configured speech-to-text provider.
5. Summaries and insights are generated through the configured LLM provider.
6. Session state is stored locally through Chrome extension storage.

## What May Leave the Browser

If the user enables transcription or summarization, meeting audio/text may be sent to the configured AI providers. Late Meet does not hide this behind a project-owned server; users control the provider keys and should review provider policies.

## What Should Not Be Shared

Do not share:

- API keys.
- Meeting links.
- Meeting codes.
- Participant names without consent.
- Screenshots containing private avatars, email addresses, or confidential meeting content.

## Screenshot Privacy

Before adding screenshots to documentation:

- Blur or crop meeting codes.
- Redact account names and avatars.
- Avoid private meeting titles.
- Use test data wherever possible.

See [Screenshot Guide](SCREENSHOT_GUIDE.md) for contribution standards.

## Security Reports

If you discover a vulnerability, do not open a public issue. Follow the security reporting guidance in the root README.
