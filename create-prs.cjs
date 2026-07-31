const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BACKUP_DIR = "/Users/gowtham/.gemini/antigravity-ide/brain/e85a6817-b882-49a1-a998-f5f68414a414/backup_changes";

function runCmd(cmd) {
  console.log(`Running: ${cmd}`);
  try {
    return execSync(cmd, { encoding: "utf8" });
  } catch (err) {
    console.error(`Failed executing: ${cmd}`);
    if (err.stdout) console.log(`Stdout: ${err.stdout}`);
    if (err.stderr) console.error(`Stderr: ${err.stderr}`);
    throw err;
  }
}

function createContribution({
  issueNum,
  title,
  body,
  branch,
  commitMsg,
  prTitle,
  prBody,
  applyFix,
}) {
  console.log(`\n=============================================`);
  console.log(`=== Processing Issue ${issueNum}: ${title} ===`);
  console.log(`=============================================`);

  // 1. Create Issue on upstream
  const issueUrl = runCmd(`gh issue create --repo shouri123/Late-Meet --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}"`).trim();
  const issueId = issueUrl.match(/[0-9]+$/)[0];
  console.log(`Created Issue #${issueId} (${issueUrl})`);

  // 2. Self-assign by commenting "/assign"
  runCmd(`gh issue comment --repo shouri123/Late-Meet ${issueId} --body "/assign"`);
  
  // 3. Checkout fresh branch from main
  runCmd(`git checkout main`);
  runCmd(`git checkout -b ${branch}`);

  // 4. Apply specific fix
  applyFix();

  // 5. Commit and push
  runCmd(`git add -A`);
  runCmd(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
  runCmd(`git push origin ${branch} --force`);

  // 6. Create PR on upstream
  const finalPrBody = `Fixes #${issueId}\n\n${prBody}\n\nI am contributing on behalf of GSSoc'26.`;
  const prUrl = runCmd(`gh pr create --repo shouri123/Late-Meet --base main --head gowthamrdyy:${branch} --title "${prTitle.replace(/"/g, '\\"')}" --body "${finalPrBody.replace(/"/g, '\\"')}"`).trim();
  console.log(`Created PR: ${prUrl}`);

  // 7. Reset back to main and clean branch
  runCmd(`git checkout main`);
  runCmd(`git branch -D ${branch}`);
}

// Ensure we are on clean main
runCmd("git checkout main");

// ─────────────────────────────────────────────────────────────────────────────
// 1. Issue 1: Context Menu Creation error handling in background.ts
// ─────────────────────────────────────────────────────────────────────────────
createContribution({
  issueNum: 1,
  title: "[BUG]: Missing error callback in context menu creation",
  body: "The call to `chrome.contextMenus.create` in `src/background.ts` lacks a safety callback checking `chrome.runtime.lastError`, which can lead to unhandled runtime logs when registering duplicate menu items or in restricted contexts.",
  branch: "bug/safe-context-menu",
  commitMsg: "bug: add safety callback check to chrome.contextMenus.create",
  prTitle: "[BUG]: Safety callback check in chrome.contextMenus.create to prevent runtime logs",
  prBody: "Adds a safety check/callback to the contextMenus.create call in background.ts to prevent unhandled runtime error logging.",
  applyFix: () => {
    const filePath = "src/background.ts";
    let content = fs.readFileSync(filePath, "utf8");
    const target = `function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "transcribe-tab",
      title: "🎙️ Transcribe current tab with Late-Meet",
      contexts: ["page"],
    });
  });
}`;
    const replacement = `function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: "transcribe-tab",
        title: "🎙️ Transcribe current tab with Late-Meet",
        contexts: ["page"],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn(
            "[LateMeet] Context menu creation failed or already exists:",
            chrome.runtime.lastError.message,
          );
        }
      },
    );
  });
}`;
    if (!content.includes(target)) throw new Error("Target code for Issue 1 not found!");
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, "utf8");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Issue 2: Malformed Base64 decoding in background.ts
// ─────────────────────────────────────────────────────────────────────────────
createContribution({
  issueNum: 2,
  title: "[BUG]: Unhandled DOMException when decoding malformed base64 audio chunks",
  body: "Calling `atob(base64Audio)` directly inside `transcribeChunk` can throw a DOMException if malformed payloads are received, crashing the transcription pipeline. It should be wrapped in a try-catch.",
  branch: "bug/graceful-base64-decode",
  commitMsg: "bug: catch atob DOMException when decoding malformed audio base64 payload",
  prTitle: "[BUG]: Wrap base64 audio decoding in try-catch to avoid pipeline crashes",
  prBody: "Protects the transcribeChunk function against crashes caused by malformed base64 audio inputs.",
  applyFix: () => {
    const filePath = "src/background.ts";
    let content = fs.readFileSync(filePath, "utf8");
    const target = `  const bytes = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });`;
    const replacement = `  let bytes: any;
  try {
    bytes = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
  } catch (err) {
    console.error("[LateMeet] Failed to decode base64 audio chunk:", err);
    return null;
  }
  const blob = new Blob([bytes], { type: mimeType });`;
    if (!content.includes(target)) throw new Error("Target code for Issue 2 not found!");
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, "utf8");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Issue 3: roughBytes try-catch in storageUtils.ts
// ─────────────────────────────────────────────────────────────────────────────
createContribution({
  issueNum: 3,
  title: "[BUG]: JSON.stringify inside roughBytes can throw on complex or circular structures",
  body: "JSON.stringify inside roughBytes doesn't check for errors or handle circular structure exceptions, which could throw and crash the storage metrics dashboard.",
  branch: "bug/safe-rough-bytes",
  commitMsg: "bug: wrap roughBytes JSON stringify in try-catch to prevent serialization crashes",
  prTitle: "[BUG]: Protect roughBytes against circular structure serialization exceptions",
  prBody: "Wraps the JSON.stringify call inside roughBytes in a try-catch to return 0 on serialization failures.",
  applyFix: () => {
    fs.copyFileSync(path.join(BACKUP_DIR, "storageUtils.ts"), "src/utils/storageUtils.ts");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Issue 4: escapeHtml String cast in dashboard.ts
// ─────────────────────────────────────────────────────────────────────────────
createContribution({
  issueNum: 4,
  title: "[BUG]: escapeHtml inside dashboard.ts throws error when encountering numeric values",
  body: "`escapeHtml` inside `src/dashboard.ts` expects a string and does not convert the input via String(), which throws an error if numbers or other types are passed.",
  branch: "bug/escape-html-string-cast",
  commitMsg: "bug: convert input to String in dashboard escapeHtml to prevent crashes",
  prTitle: "[BUG]: Make escapeHtml inside dashboard.ts type-safe for non-string values",
  prBody: "Ensures escapeHtml does not throw if passed numbers or nullish values.",
  applyFix: () => {
    const filePath = "src/dashboard.ts";
    let content = fs.readFileSync(filePath, "utf8");
    const target = `  function escapeHtml(str: string) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }`;
    const replacement = `  function escapeHtml(str: unknown) {
    const div = document.createElement("div");
    div.textContent = String(str ?? "");
    return div.innerHTML;
  }`;
    if (!content.includes(target)) throw new Error("Target code for Issue 4 not found!");
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, "utf8");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Issue 5: Filter empty insights in dashboard.ts
// ─────────────────────────────────────────────────────────────────────────────
createContribution({
  issueNum: 5,
  title: "[BUG]: Empty insights should be filtered out from dashboard list rendering",
  body: "If the model output contains empty string insights, the dashboard will render empty bullet items. These should be filtered out before rendering.",
  branch: "bug/filter-empty-insights",
  commitMsg: "bug: filter out empty insights before rendering list in dashboard",
  prTitle: "[BUG]: Skip rendering empty insights in the dashboard metrics view",
  prBody: "Ensures empty or whitespace-only insights returned from LLM queries are skipped.",
  applyFix: () => {
    const filePath = "src/dashboard.ts";
    let content = fs.readFileSync(filePath, "utf8");
    const target = `  // ——— Key Insights ———
  function updateInsights(insights: any[]) {
    const list = document.getElementById("dash-insights-list");
    if (!list) return;
    if (!insights || insights.length === 0) {
      list.innerHTML =
        '<li class="empty-msg">Insights will appear as the conversation progresses</li>';
      return;
    }
    list.innerHTML = insights
      .filter((i) => i != null)
      .map((i) => {`;
    const replacement = `  // ——— Key Insights ———
  function updateInsights(insights: any[]) {
    const list = document.getElementById("dash-insights-list");
    if (!list) return;

    const validInsights = (insights || []).filter((i) => {
      if (i == null) return false;
      const text = typeof i === "string" ? i : i.text || "";
      return String(text).trim().length > 0;
    });

    if (validInsights.length === 0) {
      list.innerHTML =
        '<li class="empty-msg">Insights will appear as the conversation progresses</li>';
      return;
    }
    list.innerHTML = validInsights
      .map((i) => {`;
    if (!content.includes(target)) throw new Error("Target code for Issue 5 not found!");
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, "utf8");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Issue 6: Filter empty contradictions in dashboard.ts
// ─────────────────────────────────────────────────────────────────────────────
createContribution({
  issueNum: 6,
  title: "[BUG]: Empty contradiction issues should be filtered out from dashboard rendering",
  body: "Empty contradictions generated by the model cause empty bullet items to render in the contradictions list. Let's filter them out.",
  branch: "bug/filter-empty-contradictions",
  commitMsg: "bug: filter out empty contradictions in dashboard view rendering",
  prTitle: "[BUG]: Filter out empty contradiction items in dashboard rendering",
  prBody: "Ensures only valid, non-empty contradictions are displayed.",
  applyFix: () => {
    const filePath = "src/dashboard.ts";
    let content = fs.readFileSync(filePath, "utf8");
    const target = `  function updateContradictions(contradictions: any[]) {
    const list = document.getElementById("dash-contradictions-list");
    if (!list) return;
    if (!contradictions || contradictions.length === 0) {
      list.innerHTML = '<li class="empty-msg">No contradictions detected</li>';
      return;
    }
    list.innerHTML = contradictions
      .filter((c) => c != null)
      .map((c) => {`;
    const replacement = `  function updateContradictions(contradictions: any[]) {
    const list = document.getElementById("dash-contradictions-list");
    if (!list) return;

    const validContradictions = (contradictions || []).filter((c) => {
      if (c == null) return false;
      const issue = typeof c === "string" ? c : c.issue || "";
      return String(issue).trim().length > 0;
    });

    if (validContradictions.length === 0) {
      list.innerHTML = '<li class="empty-msg">No contradictions detected</li>';
      return;
    }
    list.innerHTML = validContradictions
      .filter((c) => c != null)
      .map((c) => {`;
    if (!content.includes(target)) throw new Error("Target code for Issue 6 not found!");
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, "utf8");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Issue 7: Filter empty unresolved discussions in dashboard.ts
// ─────────────────────────────────────────────────────────────────────────────
createContribution({
  issueNum: 7,
  title: "[BUG]: Empty unresolved discussions should be skipped in list rendering",
  body: "Empty unresolved discussions cause empty bullet items. These should be filtered out.",
  branch: "bug/filter-empty-unresolved",
  commitMsg: "bug: skip empty unresolved discussions in dashboard",
  prTitle: "[BUG]: Filter out empty unresolved discussions from dashboard view",
  prBody: "Ignores empty or whitespace-only unresolved discussions.",
  applyFix: () => {
    const filePath = "src/dashboard.ts";
    let content = fs.readFileSync(filePath, "utf8");
    const target = `  function updateUnresolvedDiscussions(discussions: string[]) {
    const list = document.getElementById("dash-unresolved-list");
    if (!list) return;
    if (!discussions || discussions.length === 0) {
      list.innerHTML = '<li class="empty-msg">No unresolved discussions yet</li>';
      return;
    }
    list.innerHTML = discussions.map((d) => \`<li>\${escapeHtml(d || "")}</li>\`).join("");
  }`;
    const replacement = `  function updateUnresolvedDiscussions(discussions: string[]) {
    const list = document.getElementById("dash-unresolved-list");
    if (!list) return;

    const validDiscussions = (discussions || []).filter((d) => d && String(d).trim().length > 0);

    if (validDiscussions.length === 0) {
      list.innerHTML = '<li class="empty-msg">No unresolved discussions yet</li>';
      return;
    }
    list.innerHTML = validDiscussions.map((d) => \`<li>\${escapeHtml(d)}</li>\`).join("");
  }`;
    if (!content.includes(target)) throw new Error("Target code for Issue 7 not found!");
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, "utf8");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Issue 8: Undefined Session ID safeguards in sessionStorage.ts
// ─────────────────────────────────────────────────────────────────────────────
createContribution({
  issueNum: 8,
  title: "[BUG]: Safe guard undefined session IDs and JSON serialization in sessionStorage",
  body: "Adds validation to reject undefined or empty session IDs in `getSavedMeetingSession` and `deleteSavedMeetingSession`, and wraps `estimateStorageBytes` in a try-catch to prevent serialization crashes.",
  branch: "bug/safe-session-storage",
  commitMsg: "bug: safegaurd undefined session IDs and JSON.stringify errors in sessionStorage.ts",
  prTitle: "[BUG]: Add null checks and serialization catch inside sessionStorage",
  prBody: "Prevents crashes in sessionStorage from undefined session IDs and circular structures.",
  applyFix: () => {
    fs.copyFileSync(path.join(BACKUP_DIR, "sessionStorage.ts"), "src/sessionStorage.ts");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Issue 9: Null-safe participant candidate detection in participantDetection.ts & test
// ─────────────────────────────────────────────────────────────────────────────
createContribution({
  issueNum: 9,
  title: "[BUG]: Make participantNameFromCandidate safe against null/undefined inputs",
  body: "Calling `participantNameFromCandidate` with a nullish candidate throws a property access TypeError. Let's add a safe guard check.",
  branch: "bug/safe-participant-detection",
  commitMsg: "bug: add null/undefined check to participantNameFromCandidate",
  prTitle: "[BUG]: Add null/undefined guard inside participantNameFromCandidate",
  prBody: "Provides null safety when parsing participant name candidates and includes a test case.",
  applyFix: () => {
    fs.copyFileSync(path.join(BACKUP_DIR, "participantDetection.ts"), "src/participantDetection.ts");
    fs.copyFileSync(path.join(BACKUP_DIR, "participantDetection.test.ts"), "src/participantDetection.test.ts");
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Issue 10: String type validation for DELETE_SAVED_SESSION in background.ts
// ─────────────────────────────────────────────────────────────────────────────
createContribution({
  issueNum: 10,
  title: "[BUG]: Validate sessionId type for DELETE_SAVED_SESSION message listener",
  body: "The `DELETE_SAVED_SESSION` listener in `background.ts` passes `message.sessionId` directly without type-checking, which can lead to unexpected storage lookups. It should check for string type similar to `GET_SAVED_SESSION`.",
  branch: "bug/validate-delete-session-id",
  commitMsg: "bug: validate sessionId string type in DELETE_SAVED_SESSION listener",
  prTitle: "[BUG]: Enforce string type validation for DELETE_SAVED_SESSION message",
  prBody: "Aligns session deletion with getter message handler checks to ensure type safety.",
  applyFix: () => {
    const filePath = "src/background.ts";
    let content = fs.readFileSync(filePath, "utf8");
    const target = `      case "DELETE_SAVED_SESSION": {
        await deleteSavedMeetingSession(chrome.storage.local, message.sessionId);
        sendResponse({ success: true });
        return;
      }`;
    const replacement = `      case "DELETE_SAVED_SESSION": {
        if (typeof message.sessionId === "string") {
          await deleteSavedMeetingSession(chrome.storage.local, message.sessionId);
        }
        sendResponse({ success: true });
        return;
      }`;
    if (!content.includes(target)) throw new Error("Target code for Issue 10 not found!");
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, "utf8");
  },
});

console.log("All 10 Contributions executed completely!");
