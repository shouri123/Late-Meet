# Late-Meet Repository Instructions

## Project Overview

Late-Meet is an AI-powered Chrome extension for Google Meet built with:

- TypeScript
- Manifest V3
- Vanilla CSS
- Chrome Extension APIs
- OpenAI / ElevenLabs integrations

The project focuses on:

- real-time meeting productivity,
- transcription workflows,
- AI summaries,
- participant intelligence,
- and lightweight extension performance.

---

## Development Guidelines

- Use TypeScript for all new source files.
- Prefer modular and readable code.
- Keep logic lightweight and dependency-minimal.
- Follow existing project structure and naming conventions.
- Avoid introducing unnecessary libraries/frameworks.
- Maintain compatibility with Chrome Manifest V3.

---

## UI/UX Standards

- Follow the existing monochromatic dark UI design system.
- Use vanilla CSS only.
- Keep interfaces minimal, clean, and productivity-focused.
- Avoid excessive animations or heavy UI frameworks.

---

## Pull Request Expectations

Before submitting changes:

- ensure `npm run build` passes,
- ensure lint checks pass,
- test functionality manually in Google Meet,
- and include screenshots for UI changes when applicable.

---

## Contributor Workflow

- Do not work on issues unless assigned by a maintainer.
- Avoid opening duplicate or unrelated pull requests.
- Reference related issue numbers in pull requests.
- Follow repository contribution guidelines.

---

## Testing Expectations

When modifying participant detection or meeting logic:

- add/update relevant tests,
- cover edge cases,
- and avoid regressions in existing workflows.

---

## Performance Considerations

Because Late-Meet runs inside active Google Meet sessions:

- avoid expensive polling,
- minimize DOM queries,
- optimize event listeners,
- and prefer efficient state management.

---

## Important Notes

- Keep Chrome extension permissions minimal.
- Avoid unsafe DOM manipulation.
- Maintain compatibility across recent Chrome versions.
- Prioritize reliability and low-latency interactions.
