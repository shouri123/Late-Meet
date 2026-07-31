# Security Policy for Late-Meet

We take the security of Late-Meet very seriously. If you believe you have found a security vulnerability in this project, please report it to us responsibly using the guidelines below.

---

## 🛡️ Supported Versions

We actively provide security patches for the following versions of Late-Meet:

| Version | Supported |
| :------ | :-------: |
| 1.2.x   |    Yes    |
| < 1.2.0 |    No     |

---

## 📞 Reporting a Vulnerability

Please **do not** open public GitHub issues for security vulnerabilities, as this could expose users to potential risks before a patch is available. Instead, please report vulnerabilities via one of the following secure channels:

1. **GitHub Private Vulnerability Reporting**: Go to the **Security** tab of this repository on GitHub, click **Vulnerability reporting**, and submit a private report.
2. **Email**: Send an email describing the vulnerability to the project maintainers.
   - **Contact Email**: `chakrabortyshouri@gmail.com`

### Please include the following details in your report:

- A detailed description of the vulnerability and the potential impact.
- Step-by-step instructions to reproduce the issue (including proof-of-concept scripts or screenshots if applicable).
- Details of your testing environment (e.g. Chrome browser version, OS version).

---

## ⏱️ Our Disclosure Policy

We follow a Coordinated Vulnerability Disclosure (CVD) process:

- **Initial Response**: We will acknowledge receipt of your report within **48 hours** and provide an initial assessment.
- **Resolution**: We aim to resolve and release a patch for all verified high-severity vulnerabilities within **30 days** of receipt.
- **Public Disclosure**: Once a fix is released, we will coordinate public disclosure of the vulnerability with you, giving you full credit for the discovery unless you choose to remain anonymous.

Thank you for helping keep Late-Meet secure!

## Chrome Extension Security Guidelines

### API Key Handling

- **Never** commit API keys to the repository
- API keys should be stored in `chrome.storage.local` only
- Rotate any accidentally exposed API keys immediately
- Keys should be treated like passwords — never share them

### Extension-Specific Threats

| Threat                       | Mitigation                              |
| ---------------------------- | --------------------------------------- |
| XSS in extension pages       | Strict CSP in manifest.json             |
| API key theft                | Encrypted storage, local-only sync      |
| Malicious website access     | Declare minimal permissions in manifest |
| Storage corruption           | Schema validation on load               |
| MITM transcript interception | HTTPS-only API endpoints                |

### Permissions Principle

The extension should request minimal permissions:

- Only `activeTab` when possible instead of broad `tabs`
- Avoid `<all_urls>` host permissions
- Use `scripting` API with specific URL patterns

### Reporting Extension Vulnerabilities

For Chrome extension-specific vulnerabilities:

1. Report privately via GitHub Security Advisories
2. Include the Chrome version and extension version
3. Describe if the vulnerability requires user interaction
4. Note whether the exploit requires a malicious website

---

## 🔐 Extension Permissions Audit

This section documents every permission declared in [`src/manifest.json`](./src/manifest.json), why it is required, and where the resulting data lives. This audit exists to give users full transparency over what the extension can access.

### Declared Permissions

| Permission | Why It Is Required | Data Stored? |
| :--- | :--- | :--- |
| `storage` | Saves meeting transcripts, AI-generated summaries, user preferences (API keys, theme, language), and session history to the browser's local extension storage. | **Yes — locally only.** All data is stored in `chrome.storage.local` on the user's device and never leaves it unless the user explicitly exports a transcript. |
| `unlimitedStorage` | Meeting transcripts and audio chunks can grow large over long sessions. This permission removes the default 5 MB quota cap so recordings are not silently truncated. | Same as `storage` — all local. |
| `tabs` | Used to detect which browser tab corresponds to an active Google Meet session, retrieve the tab's URL and title for session metadata, and track tab lifecycle events (focus, close) to correctly start/stop recording. | Tab URL and title are stored transiently in memory; meeting title may be persisted in session metadata in `chrome.storage.local`. |
| `tabCapture` | Captures the audio stream of the active Google Meet tab so that the extension can transcribe the meeting in real time. Without this permission, no audio can be recorded. | Audio is processed in the offscreen document and discarded after chunked transcription. Raw audio is **never** written to disk or sent to any server other than the configured AI provider. |
| `contextMenus` | Adds right-click context menu entries that allow users to quickly save or copy a meeting snippet without opening the full panel. | No data stored by this permission itself. |
| `offscreen` | Chrome Manifest V3 service workers cannot access Web Audio APIs directly. An offscreen document is created solely to host the `AudioContext` / `MediaRecorder` pipeline that processes the captured audio stream. | Audio chunks live in memory inside the offscreen document; they are forwarded to the background service worker and then discarded. |
| `sidePanel` | Renders the primary Late-Meet UI (transcript, summaries, catch-up view) as a persistent side panel alongside Google Meet without requiring a separate pop-up window. | No additional data is stored by this permission. |
| `notifications` | Displays browser notifications to alert the user when a recording starts/stops, a summary is ready, or an error occurs (e.g., API key missing). | No user data is stored by notifications. |
| `alarms` | Schedules periodic background tasks, such as auto-saving the current session and cleaning up stale storage entries, even when the extension pop-up is closed. | No additional data is stored beyond the session data already managed by `storage`. |

### Host Permissions

| Host Pattern | Why It Is Required |
| :--- | :--- |
| `https://meet.google.com/*` | Injects the content script (`content.ts`) that attaches to the Google Meet page DOM to detect participant changes, extract the meeting title, and communicate recording state back to the background service worker. |
| `https://api.openai.com/*` | Sends audio transcription chunks and summarisation prompts to the OpenAI API (Whisper / GPT) **only when the user has provided their own API key**. No requests are made to this host without explicit user configuration. |
| `https://api.elevenlabs.io/*` | Optionally used for text-to-speech features if the user has configured an ElevenLabs API key. No requests are made to this host without explicit user configuration. |

### Content Security Policy

The extension enforces a strict CSP on all extension pages:

```
default-src 'none';
script-src   'self';
style-src    'self';
connect-src  https://api.openai.com https://api.elevenlabs.io;
img-src      'self' data:;
font-src     'self' data:;
object-src   'none';
```

- `'unsafe-eval'` and `'unsafe-inline'` are **never** permitted.
- Network connections are restricted to the two AI provider domains above; no other outbound requests are possible from extension pages.

---

## 🕵️ Privacy Policy

### What Data Late-Meet Collects

Late-Meet is designed with a **local-first** and **privacy-first** philosophy.

| Data Type | Collected? | Where Stored | When Deleted |
| :--- | :---: | :--- | :--- |
| Meeting audio (raw PCM / WebM chunks) | Transiently in memory only | RAM inside the offscreen document | Immediately after transcription chunk is processed |
| Meeting transcripts (text) | Yes | `chrome.storage.local` on user's device | When user manually clears sessions or uses the storage dashboard |
| AI summaries & catch-up text | Yes | `chrome.storage.local` on user's device | When user manually clears sessions |
| User preferences (theme, language) | Yes | `chrome.storage.local` on user's device | When extension is uninstalled or user resets settings |
| API keys (OpenAI / ElevenLabs) | Yes | `chrome.storage.local` on user's device | When user removes the key or uninstalls the extension |
| Participant names / speaker labels | Yes (derived from Google Meet DOM) | `chrome.storage.local` as part of session metadata | When user clears the session |
| Usage analytics or telemetry | **No** | N/A | N/A |
| Crash reports | **No** | N/A | N/A |

### What Late-Meet Never Does

- ❌ **Does not** transmit meeting transcripts, summaries, or participant names to any Late-Meet server.
- ❌ **Does not** share any data with third parties beyond the AI provider APIs you explicitly configure.
- ❌ **Does not** store any data in `chrome.storage.sync` (which syncs across devices via Google Account).
- ❌ **Does not** access any website other than `meet.google.com` via content scripts.
- ❌ **Does not** collect analytics, usage metrics, or crash reports.

### Third-Party API Data Handling

When you provide an API key, audio or text data is sent to the respective provider under **your own API account**:

- **OpenAI**: Audio chunks are sent to the Whisper transcription endpoint; meeting text may be sent to a GPT model for summarisation. Refer to [OpenAI's Privacy Policy](https://openai.com/policies/privacy-policy) for how they handle API request data.
- **ElevenLabs**: Text may be sent for text-to-speech synthesis if you opt in. Refer to [ElevenLabs' Privacy Policy](https://elevenlabs.io/privacy) for details.

You are solely responsible for ensuring your use of third-party APIs complies with your organisation's data-handling policies.

### User Controls

- **View stored data**: Open the extension's Storage Dashboard (`options.html` → Storage) to inspect and delete all locally stored sessions.
- **Delete all data**: Use the "Clear All Sessions" action in the Storage Dashboard, or uninstall the extension (Chrome automatically purges `chrome.storage.local` on uninstall).
- **Revoke API keys**: Remove your API key from the Options page at any time. The extension will stop sending data to that provider immediately.
