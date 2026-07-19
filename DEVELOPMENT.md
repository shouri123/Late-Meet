# Development Guide for Late Meet

> **Complete guide to developing and debugging the Late Meet Chrome extension**

This guide is designed to help contributors set up their development environment, debug different components of the extension, and resolve common issues efficiently.

---

## Table of Contents

- [Dev Environment Setup](#dev-environment-setup)
- [Debugging the Service Worker](#debugging-the-service-worker)
- [Debugging Content Scripts](#debugging-content-scripts)
- [Debugging the Offscreen Document](#debugging-the-offscreen-document)
- [Debugging the Side Panel](#debugging-the-side-panel)
- [Common Errors and Fixes](#common-errors-and-fixes)
- [Hot Reload Workflow](#hot-reload-workflow)

---

## Dev Environment Setup

### Prerequisites

Before starting development, ensure you have:

- **Node.js** 18+ ([download](https://nodejs.org/))
- **Google Chrome** (latest stable version)
- **VS Code** (recommended)

### Step 1: Install Dependencies

```bash
git clone https://github.com/shouri123/Late-Meet.git
cd Late-Meet
npm install
```

### Step 2: Enable Chrome Developer Mode

1. Open Chrome and navigate to `chrome://extensions/`
2. Toggle **Developer mode** in the top-right corner
3. You should now see **Load unpacked** button

### Step 3: Load the Extension for Development

```bash
npm run dev
```

This starts Vite in watch mode, rebuilding the extension automatically when you save files.

Now:

1. Open `chrome://extensions/`
2. Click **Load unpacked**
3. Navigate to the `Late-Meet` folder and select the **`dist/`** folder
   - If `dist/` doesn't exist, manually build: `npm run build`

### Recommended VS Code Extensions

Install these extensions in VS Code for an optimal development experience:

| Extension                                                                                                                     | Purpose                               |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [ES7+ React/Redux/React-Native snippets](https://marketplace.visualstudio.com/items?itemName=dsznajder.es7-react-js-snippets) | TypeScript snippets                   |
| [Chrome Debugger](https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome)                           | Debug extension directly from VS Code |
| [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)                                        | Auto-format code                      |
| [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)                                          | Lint TypeScript/JavaScript            |
| [Chrome DevTools](https://marketplace.visualstudio.com/items?itemName=ms-vscode-devtools-for-chrome.devtools-for-chrome)      | Official VS Code DevTools integration |

### Essential Chrome Flags for Development

Enable these flags for better debugging:

1. Open `chrome://flags/#extension-mime-request-handling`
   - Set to **Default**
2. Open `chrome://flags/#enable-extension-activity-log`
   - Set to **Enabled**
3. Restart Chrome

---

## Debugging the Service Worker

The **service worker** (`src/background.ts`) runs in the background and handles:

- Meeting detection and state management
- Communication between content scripts and UI components
- API requests to OpenAI and ElevenLabs

### How to Debug the Service Worker

#### Via chrome://serviceworker-internals (Recommended)

This is the primary way to debug service workers in Manifest V3:

1. Open a new tab and navigate to `chrome://serviceworker-internals/`
2. Find **"Late Meet"** in the list of extensions
3. Click **inspect** button next to "Late Meet"
4. A DevTools window opens showing the service worker context

**In the DevTools Console:**

```javascript
// Check current meeting state
chrome.storage.local.get(["meetingState"], (data) => {
  console.log("Current state:", data);
});

// Send a test message to content script
chrome.tabs.query({ url: "*://meet.google.com/*" }, (tabs) => {
  if (tabs[0]) {
    chrome.tabs.sendMessage(tabs[0].id, { type: "TEST_MESSAGE" });
  }
});

// View all registered listeners
// (shown automatically in Service Worker DevTools)
```

#### Common Service Worker Debugging Tasks

**Check if service worker is registered:**

```javascript
// In background.ts console
console.log("Service worker active");
```

**Monitor chrome.storage changes:**

```javascript
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log(`[${namespace}] Storage changed:`, changes);
});
```

**Monitor message traffic:**

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", { message, sender: sender.url });
  sendResponse({ success: true });
});
```

### Service Worker Lifespan

⚠️ **Important:** Service workers are **terminated when idle** (after 5 minutes) or when a new manifest is loaded. This is normal behavior.

- If your service worker stops responding, reload the extension:
  - Go to `chrome://extensions/`
  - Click the reload icon under "Late Meet"

---

## Debugging Content Scripts

The **content script** (`src/content.ts`) runs on Google Meet pages and handles:

- Detecting participant changes
- Capturing audio and meeting state
- Injecting UI elements into the Meet page
- Communicating with the service worker

### How to Debug Content Scripts

#### Via Chrome DevTools on the Meet Tab

1. Open Google Meet in a tab
2. Right-click on the page → **Inspect** (or press `F12`)
3. Go to **Console** tab
4. You're now in the **page's context** (not the extension context)

#### Access the Content Script Context

Content scripts have access to both the page and extension APIs:

```javascript
// Check if content script is injected
console.log("Content script loaded");

// Send message to service worker
chrome.runtime.sendMessage({ type: "GET_MEETING_STATE" }, (response) =>
  console.log("Response:", response),
);

// Monitor participant changes
const observer = new MutationObserver(() => {
  console.log("DOM changed - participants may have changed");
});

observer.observe(document.body, { childList: true, subtree: true });
```

#### View Content Script in DevTools

**In Chrome DevTools:**

1. Go to **Sources** tab
2. Left sidebar → **top-level domain** (e.g., `meet.google.com`)
3. Look for **content scripts** folder
4. Find and click `content.ts` (shows compiled JavaScript)
5. Set breakpoints directly in the code

#### Monitor Content Script Messages

```javascript
// In Meet tab console:
// Check if content script can reach service worker
chrome.runtime.sendMessage({ type: "PING" }, (response) => {
  if (chrome.runtime.lastError) {
    console.error("Service worker not responding:", chrome.runtime.lastError);
  } else {
    console.log("Service worker responded:", response);
  }
});
```

### Common Content Script Issues

| Issue                               | Debug Steps                                                           |
| ----------------------------------- | --------------------------------------------------------------------- |
| Content script not injected         | Check manifest.json `matches` pattern; verify extension is loaded     |
| Message not reaching service worker | Open service worker DevTools; check message listener exists           |
| DOM not accessible                  | Content script must run after `document_idle`; check manifest setting |

---

## Debugging the Offscreen Document

The **offscreen document** (`src/offscreen.ts`) handles:

- Background audio capture processing
- WebAudio API operations
- Heavy computations that need DOM access

### How to Debug the Offscreen Document

#### Find and Inspect the Offscreen Page

1. Open `chrome://extensions/`
2. Click **Details** for Late Meet
3. Scroll to **Extension Manifest** section
4. Find the offscreen page in the "Offscreen pages" section
5. Click **inspect** next to the listed offscreen page

#### Alternative Method (If Not Listed)

1. When your extension creates an offscreen document:

   ```typescript
   // In background.ts
   await chrome.offscreen.createDocument({
     url: "src/offscreen.html",
     reasons: ["AUDIO_PROCESSING"],
   });
   ```

2. Immediately open `chrome://extensions/` and inspect it

#### Debug Offscreen Document

```javascript
// In offscreen document DevTools console:

// Check AudioContext state
const audioContext = new AudioContext();
console.log("AudioContext state:", audioContext.state);

// Test audio processing
const audioBuffer = audioContext.createBuffer(1, 44100, 44100);
console.log("Audio buffer created:", audioBuffer.duration, "seconds");

// Monitor messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Offscreen received:", message);
  sendResponse({ status: "processed" });
});
```

#### Common Offscreen Document Errors

**"Offscreen document already exists"**

```typescript
// In background.ts, prevent duplicate creation:
chrome.offscreen.hasDocument().then((hasDocument) => {
  if (!hasDocument) {
    chrome.offscreen.createDocument({
      url: "src/offscreen.html",
      reasons: ["AUDIO_PROCESSING"],
    });
  }
});
```

**"Failed to create offscreen document"**

- Ensure `offscreen` permission is in `manifest.json`
- Check that offscreen.html exists in src/

---

## Debugging the Side Panel

The **side panel** (dashboard, `src/dashboard.ts`) shows:

- Meeting summary and transcript
- Participant list
- Settings and configuration

### How to Debug the Side Panel

#### Method 1: Open DevTools Directly

1. Open the side panel by clicking the **Late Meet extension icon**
2. Right-click in the side panel → **Inspect**
3. DevTools opens for the side panel context

#### Method 2: From Extensions Page

1. Go to `chrome://extensions/`
2. Click **Details** for Late Meet
3. Scroll down to **Extension Pages**
4. Click **inspect** next to `dashboard.html`

#### Debug Side Panel Functionality

```javascript
// In side panel DevTools console:

// Check if side panel received data from service worker
chrome.runtime.sendMessage({ type: "GET_TRANSCRIPT" }, (response) => {
  console.log("Received transcript:", response);
});

// Monitor state changes
chrome.storage.local.get(null, (data) => {
  console.log("Current side panel data:", data);
});

// Test UI interactions
const button = document.querySelector("button[data-action]");
button?.click();
console.log("Button clicked");
```

#### Side Panel State Persistence

The side panel state is stored in `chrome.storage.local`:

```javascript
// Save state
chrome.storage.local.set({
  dashboardState: {
    activeTab: "transcript",
    scrollPosition: 0,
  },
});

// Retrieve state
chrome.storage.local.get("dashboardState", (data) => {
  console.log("Dashboard state:", data.dashboardState);
});
```

---

## Common Errors and Fixes

| Error                                                   | Cause                                               | Solution                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **"Content script blocked by CSP"**                     | Content Security Policy violation                   | Check manifest.json permissions; verify `script-src` allows `unsafe-inline` for Manifest V3 |
| **"Service worker crashed"**                            | Exception in background.ts                          | Open `chrome://serviceworker-internals/` → inspect → check console for errors               |
| **"Cannot read property 'sendMessage' of undefined"**   | chrome.runtime not available in page context        | Use content script to relay messages from page to service worker                            |
| **"Extension error: Could not establish connection"**   | Service worker not responding                       | Reload extension at `chrome://extensions/`; check if service worker is active               |
| **"Offscreen document not found"**                      | Offscreen.html deleted or manifest incorrect        | Verify `offscreen.html` exists in src/; check manifest permissions                          |
| **"Port error: Could not establish connection"**        | Service worker terminated; message listener missing | Add message listener in service worker; restart service worker                              |
| **"Cannot access Meet.google.com from content script"** | Incorrect manifest permissions                      | Verify manifest has `"host_permissions": ["https://meet.google.com/*"]`                     |
| **"AudioContext not available"**                        | Missing offscreen document setup                    | Create offscreen document before using AudioContext in background                           |
| **"Storage quota exceeded"**                            | Too much data in chrome.storage.local               | Implement cleanup; verify data sizes with `chrome.storage.local.getBytesInUse()`            |
| **"Popup closed immediately"**                          | Error in popup.ts initialization                    | Open DevTools on popup before it closes; check popup.html console                           |

### Debug Checklist for Common Issues

**Extension not loading:**

- [ ] Run `npm run build` or `npm run dev`
- [ ] Navigate to `chrome://extensions/`
- [ ] Click **Load unpacked** and select `dist/` folder
- [ ] Check **Errors** section on extension card

**Features not working in Meet:**

- [ ] Reload extension: `chrome://extensions/` → reload icon
- [ ] Reload Meet tab (F5)
- [ ] Check Chrome version matches extension requirements
- [ ] Open content script DevTools and check console for errors

**Storage issues:**

```javascript
// Clear all extension storage (CAUTION: destructive)
chrome.storage.local.clear();
chrome.storage.sync.clear();
```

---

## Hot Reload Workflow

The most efficient way to develop and test your changes is using the hot reload workflow.

### Setup Hot Reload

1. **Start Vite in watch mode:**

   ```bash
   npm run dev
   ```

   This rebuilds the extension automatically when you save files.

2. **Load unpacked extension:**
   - Go to `chrome://extensions/`
   - Click **Load unpacked**
   - Select the `dist/` folder

### Using Hot Reload Effectively

#### For Content Script Changes

1. Edit `src/content.ts`
2. Vite rebuilds (automatic)
3. Reload the **Meet tab** (F5)
4. Changes appear immediately

```bash
# Terminal window 1: Vite watch
npm run dev

# Terminal window 2: In src/ directory
# Make changes to content.ts
# Reload Meet tab to see changes
```

#### For Service Worker Changes

1. Edit `src/background.ts`
2. Vite rebuilds (automatic)
3. Go to `chrome://extensions/`
4. Click **reload** icon under Late Meet
5. Changes active immediately

#### For Popup/Dashboard Changes

1. Edit `src/popup.ts`, `src/dashboard.ts`, or styles
2. Vite rebuilds (automatic)
3. Click the extension icon or re-open the side panel
4. Changes appear immediately

### Efficient Development Workflow

**Terminal Setup (Recommended):**

```bash
# Terminal 1: Run Vite
npm run dev

# Terminal 2: Run linter (optional, for real-time feedback)
npm run lint -- --watch

# Terminal 3: Run tests (if working on test files)
npm test
```

**VS Code Setup (Recommended):**

1. Install **Thunder Client** or **REST Client** for API testing
2. Use **Chrome DevTools** in separate windows for each component:
   - Service worker: `chrome://serviceworker-internals/`
   - Content script: DevTools on Meet tab
   - Side panel: DevTools on side panel
3. Keep manifest.json open for quick reference

### Best Practices for Fast Development

| Practice                                     | Benefit                                                         |
| -------------------------------------------- | --------------------------------------------------------------- |
| Open DevTools **before** saving changes      | See errors immediately as Vite rebuilds                         |
| Use `console.log()` with clear prefixes      | `[ContentScript]`, `[ServiceWorker]`, `[Dashboard]`             |
| Keep changes **small and focused**           | Easier to debug when something breaks                           |
| Run `npm run lint` after finishing a feature | Catch issues early                                              |
| Test on **actual Google Meet** instance      | Catch real-world issues; use test meet at `meet.google.com/new` |

### Troubleshooting Hot Reload

**Changes not appearing after save?**

```bash
# Manually rebuild
npm run build

# Or if using dev mode, restart Vite
# Ctrl+C to stop, then npm run dev
```

**Build succeeds but extension doesn't update?**

1. Go to `chrome://extensions/`
2. Click reload icon under Late Meet
3. If still not working, unload and reload:
   - Toggle extension off, then back on
   - Or remove and re-add from `dist/` folder

---

## Tips for Faster Debugging

### Log Prefixes for Clarity

```typescript
// In background.ts
console.log("[ServiceWorker]", "Meeting state:", state);

// In content.ts
console.log("[ContentScript]", "Participants updated:", participants);

// In dashboard.ts
console.log("[Dashboard]", "Transcript loaded:", transcript);
```

### Use Browser Console Keyboard Shortcut

- **Windows/Linux:** `Ctrl + Shift + J` (DevTools console)
- **Mac:** `Cmd + Option + J`

### Create Test Pages

Create a test HTML file to test UI components in isolation:

```html
<!-- test.html -->
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="src/theme.css" />
  </head>
  <body>
    <div id="test-container"></div>
    <script type="module">
      import { initDashboard } from "./src/dashboard";
      initDashboard(document.getElementById("test-container"));
    </script>
  </body>
</html>
```

### Monitor Network Requests

Service worker makes API calls to OpenAI and ElevenLabs. Monitor them:

1. Open `chrome://serviceworker-internals/`
2. Inspect service worker
3. Open **Network** tab in DevTools
4. Perform action that makes API call
5. Check request/response

---

## Need More Help?

- **GitHub Issues:** [Open an issue](https://github.com/shouri123/Late-Meet/issues)
- **Contributing Guide:** [See CONTRIBUTING.md](CONTRIBUTING.md)
- **Chrome Extension Docs:** [Official Manifest V3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- **Security & Privacy:** [See SECURITY.md](SECURITY.md)

---

**Happy developing! 🚀**
