# 📊 Pull Request Audit Report: shouri123/Late-Meet

This report provides a detailed breakdown of the **49 active open Pull Requests** in the `shouri123/Late-Meet` repository as of June 5, 2026. It highlights build status, automated review suggestions, security alerts, and merge readiness.

## 📈 Executive Summary

| Metric                            | Count | Description                                                 |
| :-------------------------------- | :---: | :---------------------------------------------------------- |
| **Total Open PRs**                | `49`  | All currently open pull requests                            |
| **Action/Check Failures**         | `25`  | PRs with failing GitHub Actions/statuses                    |
| **CodeRabbit Reviews**            | `49`  | PRs containing CodeRabbit feedback                          |
| **Copilot Reviews**               | `29`  | PRs containing GitHub Copilot feedback                      |
| **Security Warnings / Conflicts** | `36`  | PRs with merge conflicts, security labels, or SAST failures |
| **Completely Clean & Ready**      | `10`  | PRs with green builds, no warnings, and no conflicts        |

---

## 🟢 1. Completely Clean & Ready to Merge

These pull requests have **passing builds**, **no merge conflicts**, **no security warnings**, and are **not drafts**. They are ready for final maintainer review and merge.

### 🔗 [PR #499](https://github.com/shouri123/Late-Meet/pull/499): fix: convert safeLocalStore to async/await and replace any with unknown

- **Author:** @nyxsky404
- **Labels:** `bug`, `gssoc`, `gssoc:approved`, `type:feature`, `type:testing`, `type:design`, `size/S`, `type:code`
- **Bot Feedback:** CodeRabbit Reviews, Copilot Reviews

### 🔗 [PR #501](https://github.com/shouri123/Late-Meet/pull/501): fix: narrow State.savedAt type from string|number to number

- **Author:** @nyxsky404
- **Labels:** `bug`, `gssoc`, `gssoc:approved`, `type:feature`, `type:testing`, `type:design`, `size/XS`, `type:code`, `type:test`
- **Bot Feedback:** CodeRabbit Reviews, Copilot Reviews

### 🔗 [PR #502](https://github.com/shouri123/Late-Meet/pull/502): refactor: extract escapeHtml, formatDuration, sanitizeTopicStatus to shared utils/domHelpers.ts

- **Author:** @nyxsky404
- **Labels:** `bug`, `gssoc`, `gssoc:approved`, `type:feature`, `type:testing`, `type:design`, `size/M`, `type:code`
- **Bot Feedback:** CodeRabbit Reviews, Copilot Reviews

### 🔗 [PR #503](https://github.com/shouri123/Late-Meet/pull/503): fix: remove [key: string]: any index signature from options.ts Settings interface

- **Author:** @nyxsky404
- **Labels:** `bug`, `gssoc`, `gssoc:approved`, `type:feature`, `type:testing`, `type:design`, `size/S`, `type:code`
- **Bot Feedback:** CodeRabbit Reviews, Copilot Reviews

### 🔗 [PR #515](https://github.com/shouri123/Late-Meet/pull/515): fix: export timeline and transcript with empty fallbacks in Markdown and PlainText

- **Author:** @gowthamrdyy
- **Labels:** `bug`, `gssoc`, `gssoc:approved`, `size/S`, `type:code`
- **Bot Feedback:** CodeRabbit Reviews, Copilot Reviews

### 🔗 [PR #517](https://github.com/shouri123/Late-Meet/pull/517): feat: add copy buttons to decisions and action items with toast confirmation

- **Author:** @gowthamrdyy
- **Labels:** `gssoc`, `gssoc:approved`, `type:feature`, `size/M`, `type:code`, `type:style`
- **Bot Feedback:** CodeRabbit Reviews, Copilot Reviews

### 🔗 [PR #519](https://github.com/shouri123/Late-Meet/pull/519): fix: catch storage quota and getBytesInUse errors gracefully

- **Author:** @gowthamrdyy
- **Labels:** `bug`, `gssoc`, `gssoc:approved`, `size/S`, `type:code`
- **Bot Feedback:** CodeRabbit Reviews, Copilot Reviews

### 🔗 [PR #521](https://github.com/shouri123/Late-Meet/pull/521): fix: smooth theme transitions and prevent page-load flash in options

- **Author:** @gowthamrdyy
- **Labels:** `bug`, `gssoc`, `gssoc:approved`, `size/S`, `type:code`, `type:style`
- **Bot Feedback:** CodeRabbit Reviews, Copilot Reviews

### 🔗 [PR #525](https://github.com/shouri123/Late-Meet/pull/525): fix: enforce case-insensitive matching for excluded participant labels

- **Author:** @gowthamrdyy
- **Labels:** `bug`, `gssoc`, `gssoc:approved`, `size/S`, `type:code`, `type:test`
- **Bot Feedback:** CodeRabbit Reviews, Copilot Reviews

### 🔗 [PR #528](https://github.com/shouri123/Late-Meet/pull/528): fix: #526 save options settings while credentials are locked

- **Author:** @harrshita123
- **Labels:** `bug`, `gssoc`, `gssoc:approved`, `type:testing`, `size/M`, `conflicts`, `type:code`
- **Bot Feedback:** CodeRabbit Reviews

---

## 🔴 2. Pull Requests with Action / Check Failures

These pull requests have failed one or more CI/CD builds or status checks (e.g., linting, tests, type checks).

### 🔗 [PR #54](https://github.com/shouri123/Late-Meet/pull/54): feat: add local API usage tracking dashboard

- **Author:** @yashasp322-ship-it
- **Failing Checks:**
  - ❌ `build` (failure)
  - ❌ `lint` (failure)

### 🔗 [PR #139](https://github.com/shouri123/Late-Meet/pull/139): feature: Implement One-Click Export to Markdown and PDF UI

- **Author:** @Bhavex
- **Failing Checks:**
  - ❌ `SonarCloud Code Analysis` (failure)
  - ❌ `Type Check` (failure)
  - ❌ `PR Title Lint` (failure)

### 🔗 [PR #379](https://github.com/shouri123/Late-Meet/pull/379): feat: add storage usage dashboard and session cleanup tools

- **Author:** @akashgoudsidduluri
- **Failing Checks:**
  - ❌ `Type Check` (failure)

### 🔗 [PR #382](https://github.com/shouri123/Late-Meet/pull/382): fix: remove duplicate ID guard in persistMeetingSession causing silen…

- **Author:** @akshara200829-lgtm
- **Failing Checks:**
  - ❌ `Format Check` (failure)

### 🔗 [PR #397](https://github.com/shouri123/Late-Meet/pull/397): fix: persist recording state per tab to survive tab switches

- **Author:** @Pratikshya32
- **Failing Checks:**
  - ❌ `PR Title Lint` (failure)
  - ❌ `PR Title Lint` (failure)

### 🔗 [PR #398](https://github.com/shouri123/Late-Meet/pull/398): fix: normalize unicode in speaker attribution for non-ASCII names

- **Author:** @Pratikshya32
- **Failing Checks:**
  - ❌ `SonarCloud Code Analysis` (failure)
  - ❌ `Type Check` (failure)

### 🔗 [PR #399](https://github.com/shouri123/Late-Meet/pull/399): fix: Move audio chunk processing to offscreen document to unblock UI

- **Author:** @Pratikshya32
- **Failing Checks:**
  - ❌ `Format Check` (failure)
  - ❌ `PR Title Lint` (failure)

### 🔗 [PR #400](https://github.com/shouri123/Late-Meet/pull/400): feat: Add API endpoint URL validation to enforce HTTPS-only connections

- **Author:** @Pratikshya32
- **Failing Checks:**
  - ❌ `Format Check` (failure)
  - ❌ `PR Title Lint` (failure)

### 🔗 [PR #413](https://github.com/shouri123/Late-Meet/pull/413): fix: Strengthen Content Security Policy in manifest.json

- **Author:** @Pratikshya32
- **Failing Checks:**
  - ❌ `PR Title Lint` (failure)
  - ❌ `Type Check` (failure)
  - ❌ `PR Title Lint` (failure)

### 🔗 [PR #414](https://github.com/shouri123/Late-Meet/pull/414): feat: Add MeetingSession and StorageSchema types for type-safe storage

- **Author:** @Pratikshya32
- **Failing Checks:**
  - ❌ `PR Title Lint` (failure)
  - ❌ `Type Check` (failure)
  - ❌ `Format Check` (failure)
  - ❌ `PR Title Lint` (failure)

### 🔗 [PR #415](https://github.com/shouri123/Late-Meet/pull/415): docs: Add API key and extension-specific security guidelines to SECURITY.md

- **Author:** @Pratikshya32
- **Failing Checks:**
  - ❌ `Type Check` (failure)
  - ❌ `Format Check` (failure)
  - ❌ `PR Title Lint` (failure)

### 🔗 [PR #416](https://github.com/shouri123/Late-Meet/pull/416): docs: Add Chrome extension development guidelines to CONTRIBUTING.md

- **Author:** @Pratikshya32
- **Failing Checks:**
  - ❌ `Format Check` (failure)
  - ❌ `PR Title Lint` (failure)

### 🔗 [PR #417](https://github.com/shouri123/Late-Meet/pull/417): docs: Add troubleshooting table and keyboard shortcuts section to README

- **Author:** @Pratikshya32
- **Failing Checks:**
  - ❌ `PR Title Lint` (failure)
  - ❌ `Format Check` (failure)
  - ❌ `Type Check` (failure)

### 🔗 [PR #458](https://github.com/shouri123/Late-Meet/pull/458): feat: clear data button in settings

- **Author:** @gowthamrdyy
- **Failing Checks:**
  - ❌ `SonarCloud Code Analysis` (failure)

### 🔗 [PR #459](https://github.com/shouri123/Late-Meet/pull/459): feat: enable markdown, json &amp; txt export in dashboard

- **Author:** @gowthamrdyy
- **Failing Checks:**
  - ❌ `SonarCloud Code Analysis` (failure)

### 🔗 [PR #460](https://github.com/shouri123/Late-Meet/pull/460): ux: add confirmation dialog before discarding session

- **Author:** @gowthamrdyy
- **Failing Checks:**
  - ❌ `PR Title Lint` (failure)
  - ❌ `PR Title Lint` (failure)
  - ❌ `SonarCloud Code Analysis` (failure)
  - ❌ `PR Title Lint` (failure)

### 🔗 [PR #461](https://github.com/shouri123/Late-Meet/pull/461): feat: pre-flight check for api keys before recording

- **Author:** @gowthamrdyy
- **Failing Checks:**
  - ❌ `SonarCloud Code Analysis` (failure)

### 🔗 [PR #462](https://github.com/shouri123/Late-Meet/pull/462): a11y: comprehensive aria accessibility for dashboard

- **Author:** @gowthamrdyy
- **Failing Checks:**
  - ❌ `PR Title Lint` (failure)
  - ❌ `PR Title Lint` (failure)
  - ❌ `SonarCloud Code Analysis` (failure)
  - ❌ `PR Title Lint` (failure)

### 🔗 [PR #464](https://github.com/shouri123/Late-Meet/pull/464): feat: copy to clipboard for action items

- **Author:** @gowthamrdyy
- **Failing Checks:**
  - ❌ `SonarCloud Code Analysis` (failure)

### 🔗 [PR #465](https://github.com/shouri123/Late-Meet/pull/465): perf: optimize tab switching logic in dashboard

- **Author:** @gowthamrdyy
- **Failing Checks:**
  - ❌ `SonarCloud Code Analysis` (failure)

### 🔗 [PR #475](https://github.com/shouri123/Late-Meet/pull/475): [FIX] : Strengthen runtime validation for stored meeting sessions

- **Author:** @Devexhhh
- **Failing Checks:**
  - ❌ `PR Title Lint` (failure)

### 🔗 [PR #481](https://github.com/shouri123/Late-Meet/pull/481): Feature/copy buttons

- **Author:** @sricharan-213
- **Failing Checks:**
  - ❌ `PR Title Lint` (failure)
  - ❌ `Lint Check` (failure)
  - ❌ `PR Title Lint` (failure)

### 🔗 [PR #498](https://github.com/shouri123/Late-Meet/pull/498): fix: guard all console.log calls in background.ts behind DEBUG flag

- **Author:** @nyxsky404
- **Failing Checks:**
  - ❌ `Unit Tests + Coverage` (failure)
  - ❌ `Build (Node 22)` (failure)
  - ❌ `Build (Node 20)` (failure)

### 🔗 [PR #532](https://github.com/shouri123/Late-Meet/pull/532): fix: [SECURITY][CRITICAL] Centralize XSS Sanitization, Add CSP and Fix Attribute Injection to Prevent Malicious Code Execution

- **Author:** @Kinara2020
- **Failing Checks:**
  - ❌ `Type Check` (failure)
  - ❌ `Format Check` (failure)

### 🔗 [PR #534](https://github.com/shouri123/Late-Meet/pull/534): fix: remove dead resolvedValue alias in getApiCredentials

- **Author:** @maheshbhojane1
- **Failing Checks:**
  - ❌ `Format Check` (failure)

---

## ⚠️ 3. Pull Requests with Security Warnings or Conflicts

These pull requests require attention due to security concerns (e.g. failed CodeQL scans, `security-review` labels) or merge conflicts.

### 🔗 [PR #54](https://github.com/shouri123/Late-Meet/pull/54): feat: add local API usage tracking dashboard

- **Author:** @yashasp322-ship-it
- **Issues Identified:**
  - ⚠️ Has label 'type:security'
  - ⚠️ Security/Lint Check failed: lint
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #139](https://github.com/shouri123/Late-Meet/pull/139): feature: Implement One-Click Export to Markdown and PDF UI

- **Author:** @Bhavex
- **Issues Identified:**
  - ⚠️ Security/Lint Check failed: PR Title Lint
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #215](https://github.com/shouri123/Late-Meet/pull/215): feat(ui): implement professional empty states design system

- **Author:** @Abhi666-max
- **Issues Identified:**
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #379](https://github.com/shouri123/Late-Meet/pull/379): feat: add storage usage dashboard and session cleanup tools

- **Author:** @akashgoudsidduluri
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #397](https://github.com/shouri123/Late-Meet/pull/397): fix: persist recording state per tab to survive tab switches

- **Author:** @Pratikshya32
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'
  - ⚠️ Merge conflict (mergeable is False / state is dirty)
  - ⚠️ Security/Lint Check failed: PR Title Lint
  - ⚠️ Security/Lint Check failed: PR Title Lint

### 🔗 [PR #398](https://github.com/shouri123/Late-Meet/pull/398): fix: normalize unicode in speaker attribution for non-ASCII names

- **Author:** @Pratikshya32
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #399](https://github.com/shouri123/Late-Meet/pull/399): fix: Move audio chunk processing to offscreen document to unblock UI

- **Author:** @Pratikshya32
- **Issues Identified:**
  - ⚠️ Security/Lint Check failed: PR Title Lint

### 🔗 [PR #400](https://github.com/shouri123/Late-Meet/pull/400): feat: Add API endpoint URL validation to enforce HTTPS-only connections

- **Author:** @Pratikshya32
- **Issues Identified:**
  - ⚠️ Security/Lint Check failed: PR Title Lint

### 🔗 [PR #413](https://github.com/shouri123/Late-Meet/pull/413): fix: Strengthen Content Security Policy in manifest.json

- **Author:** @Pratikshya32
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'
  - ⚠️ Security/Lint Check failed: PR Title Lint
  - ⚠️ Security/Lint Check failed: PR Title Lint

### 🔗 [PR #414](https://github.com/shouri123/Late-Meet/pull/414): feat: Add MeetingSession and StorageSchema types for type-safe storage

- **Author:** @Pratikshya32
- **Issues Identified:**
  - ⚠️ Security/Lint Check failed: PR Title Lint
  - ⚠️ Security/Lint Check failed: PR Title Lint

### 🔗 [PR #415](https://github.com/shouri123/Late-Meet/pull/415): docs: Add API key and extension-specific security guidelines to SECURITY.md

- **Author:** @Pratikshya32
- **Issues Identified:**
  - ⚠️ Security/Lint Check failed: PR Title Lint

### 🔗 [PR #416](https://github.com/shouri123/Late-Meet/pull/416): docs: Add Chrome extension development guidelines to CONTRIBUTING.md

- **Author:** @Pratikshya32
- **Issues Identified:**
  - ⚠️ Security/Lint Check failed: PR Title Lint

### 🔗 [PR #417](https://github.com/shouri123/Late-Meet/pull/417): docs: Add troubleshooting table and keyboard shortcuts section to README

- **Author:** @Pratikshya32
- **Issues Identified:**
  - ⚠️ Security/Lint Check failed: PR Title Lint

### 🔗 [PR #445](https://github.com/shouri123/Late-Meet/pull/445): fix: respect prefers-reduced-motion for UI animations

- **Author:** @maheshbhojane1
- **Issues Identified:**
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #446](https://github.com/shouri123/Late-Meet/pull/446): fix: correct pendingJoiners type and include it in snapshot

- **Author:** @ionfwsrijan
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'

### 🔗 [PR #451](https://github.com/shouri123/Late-Meet/pull/451): fix: offscreen capture shutdown race condition

- **Author:** @ionfwsrijan
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'

### 🔗 [PR #452](https://github.com/shouri123/Late-Meet/pull/452): fix: multiple Google Meet tabs participant cross-contamination

- **Author:** @ionfwsrijan
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'

### 🔗 [PR #458](https://github.com/shouri123/Late-Meet/pull/458): feat: clear data button in settings

- **Author:** @gowthamrdyy
- **Issues Identified:**
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #459](https://github.com/shouri123/Late-Meet/pull/459): feat: enable markdown, json &amp; txt export in dashboard

- **Author:** @gowthamrdyy
- **Issues Identified:**
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #460](https://github.com/shouri123/Late-Meet/pull/460): ux: add confirmation dialog before discarding session

- **Author:** @gowthamrdyy
- **Issues Identified:**
  - ⚠️ Security/Lint Check failed: PR Title Lint
  - ⚠️ Security/Lint Check failed: PR Title Lint
  - ⚠️ Security/Lint Check failed: PR Title Lint

### 🔗 [PR #462](https://github.com/shouri123/Late-Meet/pull/462): a11y: comprehensive aria accessibility for dashboard

- **Author:** @gowthamrdyy
- **Issues Identified:**
  - ⚠️ Security/Lint Check failed: PR Title Lint
  - ⚠️ Security/Lint Check failed: PR Title Lint
  - ⚠️ Security/Lint Check failed: PR Title Lint
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #464](https://github.com/shouri123/Late-Meet/pull/464): feat: copy to clipboard for action items

- **Author:** @gowthamrdyy
- **Issues Identified:**
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #465](https://github.com/shouri123/Late-Meet/pull/465): perf: optimize tab switching logic in dashboard

- **Author:** @gowthamrdyy
- **Issues Identified:**
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #475](https://github.com/shouri123/Late-Meet/pull/475): [FIX] : Strengthen runtime validation for stored meeting sessions

- **Author:** @Devexhhh
- **Issues Identified:**
  - ⚠️ Security/Lint Check failed: PR Title Lint

### 🔗 [PR #481](https://github.com/shouri123/Late-Meet/pull/481): Feature/copy buttons

- **Author:** @sricharan-213
- **Issues Identified:**
  - ⚠️ Security/Lint Check failed: PR Title Lint
  - ⚠️ Security/Lint Check failed: Lint Check
  - ⚠️ Security/Lint Check failed: PR Title Lint

### 🔗 [PR #486](https://github.com/shouri123/Late-Meet/pull/486): fix: measure full sessions in storage dashboard

- **Author:** @harrshita123
- **Issues Identified:**
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #497](https://github.com/shouri123/Late-Meet/pull/497): fix: replace Ctrl+Shift+W save-session shortcut that conflicts with Chrome Close Window

- **Author:** @nyxsky404
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'

### 🔗 [PR #498](https://github.com/shouri123/Late-Meet/pull/498): fix: guard all console.log calls in background.ts behind DEBUG flag

- **Author:** @nyxsky404
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #500](https://github.com/shouri123/Late-Meet/pull/500): chore: centralize magic number constants from background.ts and offscreen.ts into config.ts

- **Author:** @nyxsky404
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #506](https://github.com/shouri123/Late-Meet/pull/506): refactor: consolidate duplicate getSettings functions

- **Author:** @gowthamrdyy
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'

### 🔗 [PR #509](https://github.com/shouri123/Late-Meet/pull/509): fix: enforce safe boundaries for summarizationInterval

- **Author:** @gowthamrdyy
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'

### 🔗 [PR #511](https://github.com/shouri123/Late-Meet/pull/511): fix: enforce safe range boundaries for vadThreshold

- **Author:** @gowthamrdyy
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'

### 🔗 [PR #513](https://github.com/shouri123/Late-Meet/pull/513): fix: wrap chrome.sidePanel.open in a try/catch block

- **Author:** @gowthamrdyy
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'

### 🔗 [PR #523](https://github.com/shouri123/Late-Meet/pull/523): fix: robust event listener registration in ApiTransactionManager to prevent duplicates

- **Author:** @gowthamrdyy
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'

### 🔗 [PR #527](https://github.com/shouri123/Late-Meet/pull/527): perf(#484): reduce waveform sendMessage frequency from 20/s to 10/s

- **Author:** @maheshbhojane1
- **Issues Identified:**
  - ⚠️ Merge conflict (mergeable is False / state is dirty)

### 🔗 [PR #534](https://github.com/shouri123/Late-Meet/pull/534): fix: remove dead resolvedValue alias in getApiCredentials

- **Author:** @maheshbhojane1
- **Issues Identified:**
  - ⚠️ Has 'security-review' label (Requires security review before merge)
  - ⚠️ Has label 'security-review'

---

## 🤖 4. Pull Requests with CodeRabbit or Copilot Feedback

These pull requests have active comments, reviews, or code suggestions generated by AI assistant bots (CodeRabbit or Copilot).

### 🔗 [PR #54](https://github.com/shouri123/Late-Meet/pull/54): feat: add local API usage tracking dashboard

- **Author:** @yashasp322-ship-it
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by shouri123
  - Review by coderabbitai[bot]
  - Line comment by coderabbitai[bot]
  - Review by shouri123
  - Comment by coderabbitai[bot]
  - Comment by shouri123

### 🔗 [PR #139](https://github.com/shouri123/Late-Meet/pull/139): feature: Implement One-Click Export to Markdown and PDF UI

- **Author:** @Bhavex
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by shouri123
  - Review by coderabbitai[bot]
  - Line comment by coderabbitai[bot]
  - Review by shouri123
  - Comment by coderabbitai[bot]

### 🔗 [PR #215](https://github.com/shouri123/Late-Meet/pull/215): feat(ui): implement professional empty states design system

- **Author:** @Abhi666-max
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by shouri123
  - Review by coderabbitai[bot]
  - Line comment by coderabbitai[bot]
  - Review by shouri123
  - Comment by coderabbitai[bot]

### 🔗 [PR #379](https://github.com/shouri123/Late-Meet/pull/379): feat: add storage usage dashboard and session cleanup tools

- **Author:** @akashgoudsidduluri
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by coderabbitai[bot]

### 🔗 [PR #382](https://github.com/shouri123/Late-Meet/pull/382): fix: remove duplicate ID guard in persistMeetingSession causing silen…

- **Author:** @akshara200829-lgtm
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Review by shouri123
  - Comment by coderabbitai[bot]

### 🔗 [PR #397](https://github.com/shouri123/Late-Meet/pull/397): fix: persist recording state per tab to survive tab switches

- **Author:** @Pratikshya32
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Review by coderabbitai[bot]
  - Line comment by coderabbitai[bot]
  - Comment by coderabbitai[bot]

### 🔗 [PR #398](https://github.com/shouri123/Late-Meet/pull/398): fix: normalize unicode in speaker attribution for non-ASCII names

- **Author:** @Pratikshya32
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by coderabbitai[bot]

### 🔗 [PR #399](https://github.com/shouri123/Late-Meet/pull/399): fix: Move audio chunk processing to offscreen document to unblock UI

- **Author:** @Pratikshya32
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by coderabbitai[bot]

### 🔗 [PR #400](https://github.com/shouri123/Late-Meet/pull/400): feat: Add API endpoint URL validation to enforce HTTPS-only connections

- **Author:** @Pratikshya32
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by coderabbitai[bot]

### 🔗 [PR #413](https://github.com/shouri123/Late-Meet/pull/413): fix: Strengthen Content Security Policy in manifest.json

- **Author:** @Pratikshya32
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by coderabbitai[bot]

### 🔗 [PR #414](https://github.com/shouri123/Late-Meet/pull/414): feat: Add MeetingSession and StorageSchema types for type-safe storage

- **Author:** @Pratikshya32
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Review by coderabbitai[bot]
  - Review by shouri123
  - Line comment by coderabbitai[bot]
  - Comment by coderabbitai[bot]

### 🔗 [PR #415](https://github.com/shouri123/Late-Meet/pull/415): docs: Add API key and extension-specific security guidelines to SECURITY.md

- **Author:** @Pratikshya32
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by coderabbitai[bot]

### 🔗 [PR #416](https://github.com/shouri123/Late-Meet/pull/416): docs: Add Chrome extension development guidelines to CONTRIBUTING.md

- **Author:** @Pratikshya32
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by coderabbitai[bot]

### 🔗 [PR #417](https://github.com/shouri123/Late-Meet/pull/417): docs: Add troubleshooting table and keyboard shortcuts section to README

- **Author:** @Pratikshya32
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by coderabbitai[bot]

### 🔗 [PR #445](https://github.com/shouri123/Late-Meet/pull/445): fix: respect prefers-reduced-motion for UI animations

- **Author:** @maheshbhojane1
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Review by coderabbitai[bot]
  - Review by shouri123
  - Line comment by coderabbitai[bot]
  - Comment by coderabbitai[bot]
  - Comment by coderabbitai[bot]

### 🔗 [PR #446](https://github.com/shouri123/Late-Meet/pull/446): fix: correct pendingJoiners type and include it in snapshot

- **Author:** @ionfwsrijan
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Review by coderabbitai[bot]
  - Review by shouri123
  - Line comment by coderabbitai[bot]
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #451](https://github.com/shouri123/Late-Meet/pull/451): fix: offscreen capture shutdown race condition

- **Author:** @ionfwsrijan
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Review by coderabbitai[bot]
  - Review by shouri123
  - Line comment by coderabbitai[bot]
  - Comment by coderabbitai[bot]
  - Comment by shouri123
  - Review by copilot-pull-request-reviewer[bot]
  - Comment by ionfwsrijan
  - Line comment by Copilot

### 🔗 [PR #452](https://github.com/shouri123/Late-Meet/pull/452): fix: multiple Google Meet tabs participant cross-contamination

- **Author:** @ionfwsrijan
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Review by coderabbitai[bot]
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #458](https://github.com/shouri123/Late-Meet/pull/458): feat: clear data button in settings

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Review by coderabbitai[bot]
  - Review by shouri123
  - Line comment by coderabbitai[bot]
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #459](https://github.com/shouri123/Late-Meet/pull/459): feat: enable markdown, json &amp; txt export in dashboard

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #460](https://github.com/shouri123/Late-Meet/pull/460): ux: add confirmation dialog before discarding session

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #461](https://github.com/shouri123/Late-Meet/pull/461): feat: pre-flight check for api keys before recording

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #462](https://github.com/shouri123/Late-Meet/pull/462): a11y: comprehensive aria accessibility for dashboard

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #464](https://github.com/shouri123/Late-Meet/pull/464): feat: copy to clipboard for action items

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #465](https://github.com/shouri123/Late-Meet/pull/465): perf: optimize tab switching logic in dashboard

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #475](https://github.com/shouri123/Late-Meet/pull/475): [FIX] : Strengthen runtime validation for stored meeting sessions

- **Author:** @Devexhhh
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by coderabbitai[bot]

### 🔗 [PR #481](https://github.com/shouri123/Late-Meet/pull/481): Feature/copy buttons

- **Author:** @sricharan-213
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Review by coderabbitai[bot]
  - Review by shouri123
  - Line comment by coderabbitai[bot]
  - Comment by coderabbitai[bot]

### 🔗 [PR #486](https://github.com/shouri123/Late-Meet/pull/486): fix: measure full sessions in storage dashboard

- **Author:** @harrshita123
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Review by coderabbitai[bot]
  - Comment by coderabbitai[bot]

### 🔗 [PR #497](https://github.com/shouri123/Late-Meet/pull/497): fix: replace Ctrl+Shift+W save-session shortcut that conflicts with Chrome Close Window

- **Author:** @nyxsky404
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #498](https://github.com/shouri123/Late-Meet/pull/498): fix: guard all console.log calls in background.ts behind DEBUG flag

- **Author:** @nyxsky404
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #499](https://github.com/shouri123/Late-Meet/pull/499): fix: convert safeLocalStore to async/await and replace any with unknown

- **Author:** @nyxsky404
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #500](https://github.com/shouri123/Late-Meet/pull/500): chore: centralize magic number constants from background.ts and offscreen.ts into config.ts

- **Author:** @nyxsky404
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #501](https://github.com/shouri123/Late-Meet/pull/501): fix: narrow State.savedAt type from string|number to number

- **Author:** @nyxsky404
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #502](https://github.com/shouri123/Late-Meet/pull/502): refactor: extract escapeHtml, formatDuration, sanitizeTopicStatus to shared utils/domHelpers.ts

- **Author:** @nyxsky404
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #503](https://github.com/shouri123/Late-Meet/pull/503): fix: remove [key: string]: any index signature from options.ts Settings interface

- **Author:** @nyxsky404
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #506](https://github.com/shouri123/Late-Meet/pull/506): refactor: consolidate duplicate getSettings functions

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Review by coderabbitai[bot]
  - Line comment by coderabbitai[bot]
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #509](https://github.com/shouri123/Late-Meet/pull/509): fix: enforce safe boundaries for summarizationInterval

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #511](https://github.com/shouri123/Late-Meet/pull/511): fix: enforce safe range boundaries for vadThreshold

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #513](https://github.com/shouri123/Late-Meet/pull/513): fix: wrap chrome.sidePanel.open in a try/catch block

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #515](https://github.com/shouri123/Late-Meet/pull/515): fix: export timeline and transcript with empty fallbacks in Markdown and PlainText

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #517](https://github.com/shouri123/Late-Meet/pull/517): feat: add copy buttons to decisions and action items with toast confirmation

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #519](https://github.com/shouri123/Late-Meet/pull/519): fix: catch storage quota and getBytesInUse errors gracefully

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #521](https://github.com/shouri123/Late-Meet/pull/521): fix: smooth theme transitions and prevent page-load flash in options

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #523](https://github.com/shouri123/Late-Meet/pull/523): fix: robust event listener registration in ApiTransactionManager to prevent duplicates

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #525](https://github.com/shouri123/Late-Meet/pull/525): fix: enforce case-insensitive matching for excluded participant labels

- **Author:** @gowthamrdyy
- **AI Bots:** CodeRabbit, Copilot
- **Interaction History:**
  - Comment by coderabbitai[bot]
  - Review by copilot-pull-request-reviewer[bot]
  - Line comment by Copilot

### 🔗 [PR #527](https://github.com/shouri123/Late-Meet/pull/527): perf(#484): reduce waveform sendMessage frequency from 20/s to 10/s

- **Author:** @maheshbhojane1
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by coderabbitai[bot]

### 🔗 [PR #528](https://github.com/shouri123/Late-Meet/pull/528): fix: #526 save options settings while credentials are locked

- **Author:** @harrshita123
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Review by coderabbitai[bot]
  - Line comment by coderabbitai[bot]
  - Comment by coderabbitai[bot]

### 🔗 [PR #532](https://github.com/shouri123/Late-Meet/pull/532): fix: [SECURITY][CRITICAL] Centralize XSS Sanitization, Add CSP and Fix Attribute Injection to Prevent Malicious Code Execution

- **Author:** @Kinara2020
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Review by coderabbitai[bot]
  - Line comment by coderabbitai[bot]
  - Comment by coderabbitai[bot]

### 🔗 [PR #534](https://github.com/shouri123/Late-Meet/pull/534): fix: remove dead resolvedValue alias in getApiCredentials

- **Author:** @maheshbhojane1
- **AI Bots:** CodeRabbit
- **Interaction History:**
  - Comment by coderabbitai[bot]

---

## 📋 5. Full Pull Request Catalog

A complete reference index of all 49 open pull requests, with quick indicators for failures, bots, warnings, or clean status.

| PR                                                      | Title                                                                                                                          | Author              | Status Indicators                                                       |
| :------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------- | :------------------ | :---------------------------------------------------------------------- | ----------------------------------- |
| [#54](https://github.com/shouri123/Late-Meet/pull/54)   | feat: add local API usage tracking dashboard                                                                                   | @yashasp322-ship-it | 🔴 Build Fail, ⚠️ Conflict, 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot |
| [#139](https://github.com/shouri123/Late-Meet/pull/139) | feature: Implement One-Click Export to Markdown and PDF UI                                                                     | @Bhavex             | 🔴 Build Fail, ⚠️ Conflict, 🔒 Security Warn, 🤖 CodeRabbit             |
| [#215](https://github.com/shouri123/Late-Meet/pull/215) | feat(ui): implement professional empty states design system                                                                    | @Abhi666-max        | ⚠️ Conflict, 🤖 CodeRabbit                                              |
| [#379](https://github.com/shouri123/Late-Meet/pull/379) | feat: add storage usage dashboard and session cleanup tools                                                                    | @akashgoudsidduluri | 🔴 Build Fail, ⚠️ Conflict, 🔒 Security Warn, 🤖 CodeRabbit             |
| [#382](https://github.com/shouri123/Late-Meet/pull/382) | fix: remove duplicate ID guard in persistMeetingSession causing silen…                                                         | @akshara200829-lgtm | 🔴 Build Fail, 🤖 CodeRabbit                                            |
| [#397](https://github.com/shouri123/Late-Meet/pull/397) | fix: persist recording state per tab to survive tab switches                                                                   | @Pratikshya32       | 🔴 Build Fail, ⚠️ Conflict, 🔒 Security Warn, 🤖 CodeRabbit             |
| [#398](https://github.com/shouri123/Late-Meet/pull/398) | fix: normalize unicode in speaker attribution for non-ASCII names                                                              | @Pratikshya32       | 🔴 Build Fail, ⚠️ Conflict, 🔒 Security Warn, 🤖 CodeRabbit             |
| [#399](https://github.com/shouri123/Late-Meet/pull/399) | fix: Move audio chunk processing to offscreen document to unblock UI                                                           | @Pratikshya32       | 🔴 Build Fail, 🔒 Security Warn, 🤖 CodeRabbit                          |
| [#400](https://github.com/shouri123/Late-Meet/pull/400) | feat: Add API endpoint URL validation to enforce HTTPS-only connections                                                        | @Pratikshya32       | 🔴 Build Fail, 🔒 Security Warn, 🤖 CodeRabbit                          |
| [#413](https://github.com/shouri123/Late-Meet/pull/413) | fix: Strengthen Content Security Policy in manifest.json                                                                       | @Pratikshya32       | 🔴 Build Fail, 🔒 Security Warn, 🤖 CodeRabbit                          |
| [#414](https://github.com/shouri123/Late-Meet/pull/414) | feat: Add MeetingSession and StorageSchema types for type-safe storage                                                         | @Pratikshya32       | 🔴 Build Fail, 🔒 Security Warn, 🤖 CodeRabbit                          |
| [#415](https://github.com/shouri123/Late-Meet/pull/415) | docs: Add API key and extension-specific security guidelines to SECURITY.md                                                    | @Pratikshya32       | 🔴 Build Fail, 🔒 Security Warn, 🤖 CodeRabbit                          |
| [#416](https://github.com/shouri123/Late-Meet/pull/416) | docs: Add Chrome extension development guidelines to CONTRIBUTING.md                                                           | @Pratikshya32       | 🔴 Build Fail, 🔒 Security Warn, 🤖 CodeRabbit                          |
| [#417](https://github.com/shouri123/Late-Meet/pull/417) | docs: Add troubleshooting table and keyboard shortcuts section to README                                                       | @Pratikshya32       | 🔴 Build Fail, 🔒 Security Warn, 🤖 CodeRabbit                          |
| [#445](https://github.com/shouri123/Late-Meet/pull/445) | fix: respect prefers-reduced-motion for UI animations                                                                          | @maheshbhojane1     | ⚠️ Conflict, 🤖 CodeRabbit, 🤖 Copilot                                  |
| [#446](https://github.com/shouri123/Late-Meet/pull/446) | fix: correct pendingJoiners type and include it in snapshot                                                                    | @ionfwsrijan        | 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot                             |
| [#451](https://github.com/shouri123/Late-Meet/pull/451) | fix: offscreen capture shutdown race condition                                                                                 | @ionfwsrijan        | 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot                             |
| [#452](https://github.com/shouri123/Late-Meet/pull/452) | fix: multiple Google Meet tabs participant cross-contamination                                                                 | @ionfwsrijan        | 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot                             |
| [#458](https://github.com/shouri123/Late-Meet/pull/458) | feat: clear data button in settings                                                                                            | @gowthamrdyy        | 🔴 Build Fail, ⚠️ Conflict, 🤖 CodeRabbit, 🤖 Copilot                   |
| [#459](https://github.com/shouri123/Late-Meet/pull/459) | feat: enable markdown, json &amp; txt export in dashboard                                                                      | @gowthamrdyy        | 🔴 Build Fail, ⚠️ Conflict, 🤖 CodeRabbit, 🤖 Copilot                   |
| [#460](https://github.com/shouri123/Late-Meet/pull/460) | ux: add confirmation dialog before discarding session                                                                          | @gowthamrdyy        | 🔴 Build Fail, 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot              |
| [#461](https://github.com/shouri123/Late-Meet/pull/461) | feat: pre-flight check for api keys before recording                                                                           | @gowthamrdyy        | 🔴 Build Fail, 🤖 CodeRabbit, 🤖 Copilot                                |
| [#462](https://github.com/shouri123/Late-Meet/pull/462) | a11y: comprehensive aria accessibility for dashboard                                                                           | @gowthamrdyy        | 🔴 Build Fail, ⚠️ Conflict, 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot |
| [#464](https://github.com/shouri123/Late-Meet/pull/464) | feat: copy to clipboard for action items                                                                                       | @gowthamrdyy        | 🔴 Build Fail, ⚠️ Conflict, 🤖 CodeRabbit, 🤖 Copilot                   |
| [#465](https://github.com/shouri123/Late-Meet/pull/465) | perf: optimize tab switching logic in dashboard                                                                                | @gowthamrdyy        | 🔴 Build Fail, ⚠️ Conflict, 🤖 CodeRabbit, 🤖 Copilot                   |
| [#475](https://github.com/shouri123/Late-Meet/pull/475) | [FIX] : Strengthen runtime validation for stored meeting sessions                                                              | @Devexhhh           | 🔴 Build Fail, 🔒 Security Warn, 🤖 CodeRabbit                          |
| [#481](https://github.com/shouri123/Late-Meet/pull/481) | Feature/copy buttons                                                                                                           | @sricharan-213      | 🔴 Build Fail, 🔒 Security Warn, 🤖 CodeRabbit                          |
| [#486](https://github.com/shouri123/Late-Meet/pull/486) | fix: measure full sessions in storage dashboard                                                                                | @harrshita123       | ⚠️ Conflict, 🤖 CodeRabbit                                              |
| [#497](https://github.com/shouri123/Late-Meet/pull/497) | fix: replace Ctrl+Shift+W save-session shortcut that conflicts with Chrome Close Window                                        | @nyxsky404          | 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot                             |
| [#498](https://github.com/shouri123/Late-Meet/pull/498) | fix: guard all console.log calls in background.ts behind DEBUG flag                                                            | @nyxsky404          | 🔴 Build Fail, ⚠️ Conflict, 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot |
| [#499](https://github.com/shouri123/Late-Meet/pull/499) | fix: convert safeLocalStore to async/await and replace any with unknown                                                        | @nyxsky404          | 🟢 Clean, 🤖 CodeRabbit, 🤖 Copilot                                     |
| [#500](https://github.com/shouri123/Late-Meet/pull/500) | chore: centralize magic number constants from background.ts and offscreen.ts into config.ts                                    | @nyxsky404          | ⚠️ Conflict, 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot                |
| [#501](https://github.com/shouri123/Late-Meet/pull/501) | fix: narrow State.savedAt type from string                                                                                     | number to number    | @nyxsky404                                                              | 🟢 Clean, 🤖 CodeRabbit, 🤖 Copilot |
| [#502](https://github.com/shouri123/Late-Meet/pull/502) | refactor: extract escapeHtml, formatDuration, sanitizeTopicStatus to shared utils/domHelpers.ts                                | @nyxsky404          | 🟢 Clean, 🤖 CodeRabbit, 🤖 Copilot                                     |
| [#503](https://github.com/shouri123/Late-Meet/pull/503) | fix: remove [key: string]: any index signature from options.ts Settings interface                                              | @nyxsky404          | 🟢 Clean, 🤖 CodeRabbit, 🤖 Copilot                                     |
| [#506](https://github.com/shouri123/Late-Meet/pull/506) | refactor: consolidate duplicate getSettings functions                                                                          | @gowthamrdyy        | 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot                             |
| [#509](https://github.com/shouri123/Late-Meet/pull/509) | fix: enforce safe boundaries for summarizationInterval                                                                         | @gowthamrdyy        | 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot                             |
| [#511](https://github.com/shouri123/Late-Meet/pull/511) | fix: enforce safe range boundaries for vadThreshold                                                                            | @gowthamrdyy        | 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot                             |
| [#513](https://github.com/shouri123/Late-Meet/pull/513) | fix: wrap chrome.sidePanel.open in a try/catch block                                                                           | @gowthamrdyy        | 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot                             |
| [#515](https://github.com/shouri123/Late-Meet/pull/515) | fix: export timeline and transcript with empty fallbacks in Markdown and PlainText                                             | @gowthamrdyy        | 🟢 Clean, 🤖 CodeRabbit, 🤖 Copilot                                     |
| [#517](https://github.com/shouri123/Late-Meet/pull/517) | feat: add copy buttons to decisions and action items with toast confirmation                                                   | @gowthamrdyy        | 🟢 Clean, 🤖 CodeRabbit, 🤖 Copilot                                     |
| [#519](https://github.com/shouri123/Late-Meet/pull/519) | fix: catch storage quota and getBytesInUse errors gracefully                                                                   | @gowthamrdyy        | 🟢 Clean, 🤖 CodeRabbit, 🤖 Copilot                                     |
| [#521](https://github.com/shouri123/Late-Meet/pull/521) | fix: smooth theme transitions and prevent page-load flash in options                                                           | @gowthamrdyy        | 🟢 Clean, 🤖 CodeRabbit, 🤖 Copilot                                     |
| [#523](https://github.com/shouri123/Late-Meet/pull/523) | fix: robust event listener registration in ApiTransactionManager to prevent duplicates                                         | @gowthamrdyy        | 🔒 Security Warn, 🤖 CodeRabbit, 🤖 Copilot                             |
| [#525](https://github.com/shouri123/Late-Meet/pull/525) | fix: enforce case-insensitive matching for excluded participant labels                                                         | @gowthamrdyy        | 🟢 Clean, 🤖 CodeRabbit, 🤖 Copilot                                     |
| [#527](https://github.com/shouri123/Late-Meet/pull/527) | perf(#484): reduce waveform sendMessage frequency from 20/s to 10/s                                                            | @maheshbhojane1     | ⚠️ Conflict, 🤖 CodeRabbit                                              |
| [#528](https://github.com/shouri123/Late-Meet/pull/528) | fix: #526 save options settings while credentials are locked                                                                   | @harrshita123       | 🟢 Clean, 🤖 CodeRabbit                                                 |
| [#532](https://github.com/shouri123/Late-Meet/pull/532) | fix: [SECURITY][CRITICAL] Centralize XSS Sanitization, Add CSP and Fix Attribute Injection to Prevent Malicious Code Execution | @Kinara2020         | 🔴 Build Fail, 🤖 CodeRabbit                                            |
| [#534](https://github.com/shouri123/Late-Meet/pull/534) | fix: remove dead resolvedValue alias in getApiCredentials                                                                      | @maheshbhojane1     | 🔴 Build Fail, 🔒 Security Warn, 🤖 CodeRabbit                          |
