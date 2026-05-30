# Troubleshooting

Use this guide when the extension builds, loads, or runs differently than expected during local development.

## Local Setup Troubleshooting

| Problem                              | Recommended fix                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `npm install` fails                  | Confirm Node.js 18 or newer is installed, then retry from the project root.                |
| `npm run build` fails                | Run `npm install`, check the terminal error, and confirm dependencies are installed.       |
| `dist/` is not created               | Make sure the build command is running from the repository root.                           |
| Chrome cannot load the extension     | Select the generated `dist/` folder, not `src/` or the repository root.                    |
| Extension changes do not appear      | Rebuild with `npm run build`, reload the extension, and refresh the Google Meet tab.       |
| Local docs screenshots look outdated | Re-capture only privacy-safe UI states and follow [Screenshot Guide](SCREENSHOT_GUIDE.md). |

## Extension Does Not Load in Chrome

Check the following:

- Load the `dist/` folder, not the repository root.
- Run `npm run build` before loading the extension.
- Refresh the extension from `chrome://extensions/` after rebuilding.
- Review Chrome extension errors from the Details page.

## `dist/` Is Missing Expected Assets

If a local test build reports missing stylesheet files such as `src/content.css` or `src/theme.css`, confirm the build output includes all files referenced by the manifest and content scripts.

For local verification only, copied assets may help confirm whether the missing file is the blocker, but source/build configuration fixes should be handled in a separate code PR.

## Start Copilot Button Does Not Appear

Try the following:

- Refresh the Google Meet tab.
- Reload the extension from `chrome://extensions/`.
- Confirm the active tab is `meet.google.com`.
- Check the extension service worker logs.
- Confirm content scripts are being injected.

## Side Panel Does Not Open

Check:

- Chrome version is 116 or newer.
- The extension is loaded and enabled.
- The current tab is a Google Meet tab.
- The service worker has no runtime errors.

## API Keys Are Not Saving

Check:

- Both key fields are filled correctly.
- Chrome extension storage is available.
- The options page console has no errors.
- You are using your own valid provider keys.

Never paste API keys into GitHub issues, PRs, screenshots, or committed files.

## Transcription Does Not Start

Possible causes:

- The meeting tab was not selected or active.
- Chrome tab audio capture was denied or unavailable.
- Provider API key is missing or invalid.
- Network/provider request failed.
- The service worker or offscreen document encountered an error.

Check the service worker logs, offscreen document logs, and provider response errors.

## Chrome Permissions

Late Meet depends on Chrome extension permissions for meeting detection, tab audio capture, storage, and side panel behavior.

If a permission-related feature does not work:

- Reload the extension from `chrome://extensions/`.
- Confirm the extension is enabled.
- Confirm the active page is a Google Meet tab.
- Review extension errors from the Chrome extensions Details page.
- Check whether the browser blocked tab capture or side panel access.

## Runtime Error: `Cannot read properties of undefined (reading 'onAlarm')`

This can happen if code uses `chrome.alarms` but the extension manifest does not include the matching permission.

For this documentation PR, do not modify `src/manifest.json`. Track runtime permission fixes in a separate code PR so the documentation-only contribution remains focused.

## Build Warnings

Known warnings observed during local testing:

- Duplicate `test` key in `package.json`.
- Vite externalized some Node modules from `@elevenlabs/elevenlabs-js`.

If `npm run build` still exits successfully, these warnings do not block the documentation workflow. They can be documented or fixed in a separate maintenance PR.

## When Opening an Issue

Include:

- Chrome version.
- Branch name.
- Exact command run.
- Relevant console or service worker error.
- Whether `npm install` and `npm run build` passed.
- Screenshots with private data redacted.
