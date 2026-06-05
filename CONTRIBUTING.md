# Contributing to Late Meet

First off, thank you for considering contributing to **Late Meet**! 🎉
Your contributions help improve meeting productivity, accessibility, and privacy for everyone.

We welcome bug reports, feature suggestions, documentation improvements, UI enhancements, and code contributions from developers of all experience levels.

---

# Table of Contents

- [Prerequisites](#prerequisites)
- [Contribution Workflow & Assignment Rules](#contribution-workflow--assignment-rules)
- [How to Fork and Clone](#how-to-fork-and-clone)
- [How to Run Locally](#how-to-run-locally)
- [Project Structure](#project-structure)
- [How to Pick an Issue](#how-to-pick-an-issue)
- [Branch Naming Convention](#branch-naming-convention)
- [Pull Request Guidelines](#pull-request-guidelines)
- [How to Test Changes](#how-to-test-changes)
- [Code Style Guidelines](#code-style-guidelines)
- [Need Help?](#need-help)

---

# Prerequisites

Before you begin, ensure you have the following installed/configured:

- **Node.js**: Version 18 or higher
- **Google Chrome**: Latest stable version with Developer Mode enabled
- **API Keys**:
  - OpenAI API Key
  - Optional ElevenLabs API Key for transcription features

> [!WARNING]
> Some extension features rely on Chrome Manifest V3 APIs, Offscreen Documents, and `chrome.tabCapture` integration.
> Using older Chrome versions may cause audio capture or transcription failures.

To update Chrome:

- Open `chrome://settings/help`
- Update to the latest stable version

---

# Contribution Workflow & Assignment Rules

To keep contributions organized during open-source programs like **GSSoC** and avoid duplicate work, please follow these rules before starting work on any issue.

## Before You Start

- Do **not** start working on an issue until it has been assigned to you by a maintainer.
- Please avoid opening Pull Requests without prior assignment.
- Forking the repository is completely allowed, but unassigned PRs may be closed.

## Getting an Issue Assigned

- Comment on the issue with your implementation approach instead of only writing:
  - `"assign this issue to me"`

- Issues are generally assigned on a **first meaningful interaction** basis.
- Priority may be given to contributors who clearly demonstrate understanding of the issue.

## Assignment Limits

- Contributors may work on **one issue at a time** unless approved otherwise.
- If no meaningful progress or PR activity is shown within a few days, the issue may be reassigned.

## Pull Request Rules

- PRs must reference the related issue number.
- Duplicate PRs for already assigned issues are likely to be closed.
- Large feature additions should first be discussed in an issue before implementation.

## Maintainer Rights

Maintainers reserve the right to:

- reassign issues,
- close inactive assignments,
- reject unrelated or low-quality PRs,
- and enforce repository contribution standards.

---

# How to Fork and Clone

## 1. Fork the Repository

Click the **Fork** button in the top-right corner of the GitHub repository page.

## 2. Clone Your Fork

```bash
git clone https://github.com/<your-username>/Late-Meet.git
cd Late-Meet
```

## 3. Add Upstream Remote

```bash
git remote add upstream https://github.com/shouri123/Late-Meet.git
```

---

# How to Run Locally

## Install Dependencies

```bash
npm install
```

## Build the Extension

```bash
npm run build
```

## Load the Extension in Chrome

1. Open Chrome and navigate to:

   ```txt
   chrome://extensions/
   ```

2. Enable **Developer Mode** (top-right toggle)

3. Click **Load unpacked**

4. Select the generated `dist/` directory

---

# Configure API Keys

1. Click the extension icon
2. Open **Options**
3. Enter:
   - OpenAI API Key
   - Optional ElevenLabs API Key

---

# Project Structure

```txt
src/
├── background.ts        # Service worker — central state manager, AI coordination
├── offscreen.ts         # Audio capture engine via Chrome tabCapture API
├── offscreen.html       # Hidden offscreen document for audio processing
├── content.ts           # UI injector — floating buttons, late-joiner overlays
├── content.css          # Styles for injected UI elements
├── dashboard.ts         # Side panel real-time intelligence dashboard logic
├── dashboard.html       # Side panel HTML structure
├── dashboard.css        # Side panel styling
├── popup.ts             # Extension popup controls
├── popup.html           # Popup HTML structure
├── popup.css            # Popup styling
├── options.ts           # API key configuration page logic
├── options.html         # Options page HTML
├── options.css          # Options page styling
├── audioProcessing.ts   # Audio processing utilities
├── types.ts             # TypeScript type definitions
├── manifest.json        # Chrome extension manifest (MV3)
└── utils/
    ├── api.ts                    # API helper functions
    ├── credentials.ts            # API credential storage helpers
    ├── credentials.test.ts       # Tests for credential storage helpers
    ├── indexedDbCache.ts         # IndexedDB caching utilities
    ├── storageUtils.ts           # Chrome storage utility helpers
    └── prompts.ts                # Prompt templates for AI summaries
```

---

# How to Pick an Issue

- Check the **Issues** tab for open issues.
- Look for:
  - `good first issue`
  - `help wanted`
  - `gssoc`

- Comment on the issue before starting work.
- If you have a new feature idea, open an issue for discussion first.

---

# Branch Naming Convention

Use descriptive branch names:

```txt
feature/add-transcript-export
fix/meeting-detection-bug
docs/update-setup-guide
ui/improve-dark-mode
```

---

# Pull Request Guidelines

## Create a Branch

```bash
git checkout -b feature/my-awesome-feature
```

## Commit Your Changes

Use clear and descriptive commit messages.

Example:

```txt
fix: resolve duplicate participant detection
docs: improve installation instructions
ui: refine dashboard spacing
```

## Push Your Branch

```bash
git push origin feature/my-awesome-feature
```

## Open a Pull Request

- Open the PR against the `main` branch
- Link related issues:

  ```txt
  Fixes #12
  ```

- Add screenshots for UI changes
- Clearly explain:
  - what changed,
  - why it changed,
  - and how it was tested

---

# How to Test Changes

## Run the Build

```bash
npm run build
```

## Reload the Extension

- Open:

  ```txt
  chrome://extensions/
  ```

- Click the refresh icon for the extension

## Manual Testing

Join a Google Meet and verify:

- meeting detection,
- participant extraction,
- overlays,
- dashboard behavior,
- and transcription flow.

## Tests

If adding utilities or reusable logic:

- add corresponding `.test.ts` files when applicable.

> **🔧 For detailed extension debugging & Chrome DevTools guides**, see [**DEVELOPMENT.md**](DEVELOPMENT.md) — includes service worker debugging, content script inspection, hot reload workflow, and troubleshooting common errors.

---

# Code Style Guidelines

- Use **TypeScript** for all new source files
- Follow the existing monochromatic UI design system
- Use:
  - deep blacks,
  - whites,
  - subtle glassmorphism

- Use **vanilla CSS only**
- Avoid unnecessary dependencies
- Prefer clean, modular, maintainable code

---

# Need Help?

If you're stuck or have questions:

- Open a **Discussion**
- Comment on the issue you're working on
- Reach out through the repository issue tracker

We appreciate every contribution and look forward to collaborating with you 🚀
