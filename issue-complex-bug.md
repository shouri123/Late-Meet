# [BUG] Content Script UI Completely Unstyled — Dead CSS Selectors & Fragmented Inline-Style Architecture

## Description

The content script (`content.ts`) injects UI elements into Google Meet pages, but the accompanying stylesheet (`content.css`) is completely disconnected from the JavaScript code due to mismatched ID/class naming conventions and fundamentally different rendering approaches. The result is that **all 271 lines of carefully designed CSS are dead code**, and users see crudely styled elements with hardcoded colors, no theme integration, no animations, and no glassmorphism effects.

## Impact

Every user who opens the side panel or receives a late-joiner briefing sees a broken, unstyled UI that degrades the professional appearance of the extension. The injected elements do not respond to theme changes (light/dark/system), are not animated, and lack structural integrity compared to what the CSS intended. This is a **high-visibility UX defect** present 100% of the time.

## Root Cause

There are **two independent root causes** that compound each other:

### 1. CSS selector naming mismatch (`content.css` uses `mc-` prefix, `content.ts` uses `late-meet-` prefix)

All selectors in `content.css` use an `mc-` prefix (e.g., `#mc-float-btn`, `#mc-brief-overlay`, `.mc-brief-card`), while `content.ts` creates elements with a `late-meet-` prefix (e.g., `late-meet-floating-btn`, `late-meet-brief-overlay`). No class names are used — only hardcoded IDs and inline styles.

This means every CSS rule in `content.css` is effectively dead:

| CSS Selector (content.css)       | JS Element ID (content.ts)         | Match? |
| -------------------------------- | ---------------------------------- | ------ |
| `#mc-float-btn`                  | `late-meet-floating-btn`           | ❌     |
| `.mc-float-btn-inner`            | Not created                        | ❌     |
| `.mc-float-pulse`                | Not created                        | ❌     |
| `.mc-float-icon`                 | Not created (inline `<span>` used) | ❌     |
| `.mc-float-label`                | Not created                        | ❌     |
| `.mc-visible`                    | Not toggled on any element         | ❌     |
| `#mc-brief-overlay`              | `late-meet-brief-overlay`          | ❌     |
| `.mc-brief-card` / `.mc-brief-*` | Not created (all inline `<div>`)   | ❌     |
| `@keyframes mc-pulse`            | Never referenced                   | ❌     |

### 2. Entirely different rendering approach (CSS design system vs inline styles)

Even beyond the naming mismatch, the two files use fundamentally different approaches to building UI:

**content.css (designed — never applied):**

- Glassmorphism with `backdrop-filter: blur(12px)` and `background: var(--bg-app)`
- Theme-aware via CSS custom properties (`var(--bg-app)`, `var(--border-sub)`, etc.)
- Animated entry with `cubic-bezier(0.16, 1, 0.3, 1)` transitions
- Pulse animation ring around button
- Hover tooltip label with slide-in animation
- Structured brief overlay with sections, headers, icons, close button, list items, footer
- Custom scrollbar styling
- Responsive layout with proper z-index layering

**content.ts (what users actually see):**

- Hardcoded colors: `#000` background, `#fff` text, `#333` border
- No theme awareness (ignores `initTheme()` already called at line 9)
- Different positioning: bottom-left (JS) vs bottom-right (CSS)
- No animations, no transitions, no pulse effect
- No label tooltip
- Brief overlay: minimal `rgba(0,0,0,0.9)` background div with flat text — no sections, no close button, no structured layout
- Brief overlay auto-dismisses after 8 seconds (no way to keep it open)
- No scrollbar styling
- Event listeners for hover effects instead of CSS `:hover`

## Additional Consequences

- The `@import "./theme.css"` at the top of `content.css` is never utilized by injected elements, so theme changes (light/dark/system) have no effect on the floating button or brief overlay
- `initTheme()` is correctly called at `content.ts:9` — CSS custom properties ARE available on the document — but they are never referenced by the inline styles
- The `content.css` file is listed in `manifest.json` as a content script CSS and IS injected into the page, but consumes memory and bandwidth doing nothing
- The `web_accessible_resources` entry for `content.css` in `manifest.json` is unnecessary since content script CSS is automatically injected

## Code Locations

### content.css (`src/content.css`, lines 1–271)

All selectors use `mc-` prefix — entire file is dead code:

- `src/content.css:8` — `#mc-float-btn { ... }` (65 lines of styling for the floating button)
- `src/content.css:104` — `#mc-brief-overlay { ... }` (168 lines of styling for the brief overlay)
- `src/content.css:66` — `@keyframes mc-pulse { ... }` (animation never applied)

### content.ts (`src/content.ts`)

Creates elements with wrong IDs and uses only inline styles:

- `src/content.ts:244-299` — `injectFloatingButton()`: creates `late-meet-floating-btn` with hardcoded inline styles
- `src/content.ts:144-185` — `upsertBriefOverlay()`: creates `late-meet-brief-overlay` with minimal inline styling, wrong structure, and 8-second auto-dismiss

### Dashboard/Popup dead code patterns (related)

- `src/dashboard.ts:726-728` — `sanitizeTopicStatus()` silently treats all non-`"completed"` values as `"active"` (including `null`, `undefined`, typos)
- `src/popup.ts:431-433` — same function duplicated

## Affected Files

| File                             | Lines                | Changes Required                                                                                                        |
| -------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/content.css`                | 271                  | Rename all `mc-` selectors → align with JS naming; update animations reference                                          |
| `src/content.ts`                 | ~100 (lines 144-299) | Remove all inline styles; build proper HTML structure matching CSS; use class-based styling; toggle `.mc-visible` state |
| `src/manifest.json`              | 2                    | Remove unnecessary `web_accessible_resources` entry for content.css                                                     |
| `src/theme.ts` / `src/theme.css` | 0                    | Verify theme variables are correctly resolved (should already work)                                                     |

## Suggested Fix Approach

1. **Choose a consistent naming convention** — either adopt `mc-` prefix across both files or rename CSS selectors to `late-meet-`
2. **Rewrite `injectFloatingButton()`** to create elements matching the CSS structure (inner div, pulse ring, icon, label), toggle classes instead of inline styles, and use CSS hover/active states
3. **Rewrite `upsertBriefOverlay()`** to build the full overlay structure from `.mc-brief-card` with header, greeting, sections, close button, list items, and footer — remove the 8-second auto-dismiss in favor of a proper close button
4. **Remove inline style assignments** — replace `Object.assign(btn.style, {...})` with class manipulation and let the CSS handle presentation
5. **Test theme integration** — verify light/dark/system mode changes affect the injected UI

## Expected Outcome

After fixing, the injected floating button will display at the bottom-right of Google Meet with:

- Glassmorphism background with theme-aware colors
- Pulsing ring animation
- Slide-in label tooltip on hover
- Smooth entrance animation
- Consistent positioning with the side panel design

The late-joiner brief overlay will display as a structured card with:

- Glassmorphism card with backdrop blur
- Header with icon and close button
- Personalized greeting for the joiner
- Sections for topics, decisions, action items
- Styled list items with bullet points
- Professional footer
- Proper scrollbar styling

Both elements will respond to light/dark/system theme changes and accent color customization.
