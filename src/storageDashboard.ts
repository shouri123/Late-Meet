import {
  getStorageStats,
  formatBytes,
  deleteSavedMeetingSession,
  deleteMultipleSavedMeetingSessions,
  deleteAllSavedMeetingSessions,
} from "./utils/storageUtils";
import { StorageStats } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function renderStorageDashboard(container: HTMLElement): Promise<void> {
  container.innerHTML = '<p class="storage-loading">Loading storage data…</p>';

  try {
    const stats = await getStorageStats();
    container.innerHTML = buildDashboardHTML(stats);
    attachEventListeners(container);
  } catch (err) {
    console.error("[LateMeet] Failed to load storage dashboard:", err);
    container.innerHTML = '<p class="storage-error">Failed to load storage data.</p>';
  }
}

function buildDashboardHTML(stats: StorageStats): string {
  const isWarning = stats.percentUsed >= stats.warningThreshold;
  const progressColor = isWarning ? "var(--color-text-danger)" : "var(--color-text-success)";

  return `
    <div class="storage-dashboard">

      ${
        isWarning
          ? `
        <div class="storage-warning">
          <span>⚠ Storage usage is above ${stats.warningThreshold}%. Consider removing old meetings.</span>
        </div>
      `
          : ""
      }

      <div class="storage-card">
        <div class="storage-card-header">
          <span class="storage-label">Total storage used</span>
          <span class="storage-value">${formatBytes(stats.totalBytes)} / ${formatBytes(stats.quotaBytes)}</span>
        </div>
        <div class="storage-progress-track">
          <div class="storage-progress-bar" style="width: ${stats.percentUsed}%; background: ${progressColor}"></div>
        </div>
        <div class="storage-percent">${stats.percentUsed}% used • ${stats.meetingCount} meetings stored</div>
      </div>

      <div class="storage-breakdown">
        ${buildBreakdownCard("Transcripts", stats.transcriptBytes, stats.totalBytes, "#534AB7")}
        ${buildBreakdownCard("Summaries", stats.summaryBytes, stats.totalBytes, "#0F6E56")}
        ${buildBreakdownCard("Action Items", stats.actionItemBytes, stats.totalBytes, "#185FA5")}
        ${buildBreakdownCard("Settings", stats.settingsBytes, stats.totalBytes, "#5F5E5A")}
      </div>

      ${
        stats.largestMeetings.length > 0
          ? `
        <div class="storage-card">
          <div class="storage-card-header storage-card-controls">
            <span class="storage-label">Largest meetings</span>
            <div class="storage-actions">
              <button id="storage-delete-selected" class="btn btn-danger" aria-label="Delete selected sessions" disabled>Delete Selected</button>
              <button id="storage-clear-all" class="btn btn-warning" aria-label="Clear all saved sessions">Clear All</button>
              <button id="storage-select-all" class="btn" aria-pressed="false" aria-label="Select all sessions">Select All</button>
            </div>
          </div>
          <ul class="storage-meeting-list" id="storage-meeting-list">
            ${stats.largestMeetings
              .map(
                (m) => `
              <li class="storage-meeting-item">
                <label class="storage-meeting-select">
                  <input type="checkbox" class="storage-meeting-checkbox" data-id="${escapeHtml(m.id)}" aria-label="Select ${escapeHtml(m.title)}" />
                  <span class="visually-hidden">Select ${escapeHtml(m.title)}</span>
                </label>
                <div class="storage-meeting-info">
                  <span class="storage-meeting-title">${escapeHtml(m.title)}</span>
                  <span class="storage-meeting-size">${formatBytes(m.totalBytes)}</span>
                </div>
                <button class="storage-delete-btn" data-id="${escapeHtml(m.id)}" aria-label="Delete ${escapeHtml(m.title)}">Delete</button>
              </li>
            `,
              )
              .join("")}
          </ul>
        </div>
      `
          : ""
      }

      <button class="storage-refresh-btn" id="storage-refresh">Refresh</button>
    </div>
  `;
}

function buildBreakdownCard(label: string, bytes: number, total: number, color: string): string {
  const pct = total > 0 ? Math.round((bytes / total) * 100) : 0;
  return `
    <div class="storage-breakdown-card">
      <div class="breakdown-color-dot" style="background: ${color}"></div>
      <div class="breakdown-info">
        <span class="breakdown-label">${label}</span>
        <span class="breakdown-bytes">${formatBytes(bytes)}</span>
      </div>
      <span class="breakdown-pct">${pct}%</span>
    </div>
  `;
}

function attachEventListeners(container: HTMLElement): void {
  container.querySelectorAll(".storage-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = (e.target as HTMLElement).dataset.id!;
      const title =
        (e.target as HTMLElement)
          .closest(".storage-meeting-item")
          ?.querySelector(".storage-meeting-title")?.textContent || id;

      if (confirm(`Delete stored data for "${title}"? This cannot be undone.`)) {
        try {
          await deleteSavedMeetingSession(chrome.storage.local, id);
          await renderStorageDashboard(container);
        } catch (err) {
          console.error("[LateMeet] Failed to delete session:", err);
          alert("Failed to delete session. See console for details.");
        }
      }
    });
  });

  const meetingList = container.querySelectorAll<HTMLInputElement>(".storage-meeting-checkbox");
  const deleteSelectedBtn = container.querySelector<HTMLButtonElement>("#storage-delete-selected");
  const clearAllBtn = container.querySelector<HTMLButtonElement>("#storage-clear-all");
  const selectAllBtn = container.querySelector<HTMLButtonElement>("#storage-select-all");

  function updateSelectionState() {
    const checked = Array.from(meetingList)
      .filter((c) => c.checked)
      .map((c) => c.dataset.id!);
    if (deleteSelectedBtn) deleteSelectedBtn.disabled = checked.length === 0;
    return checked;
  }

  meetingList.forEach((cb) => {
    cb.addEventListener("change", () => updateSelectionState());
  });

  // Delete selected
  deleteSelectedBtn?.addEventListener("click", async () => {
    const selected = updateSelectionState();
    if (selected.length === 0) return;
    if (!confirm(`Delete ${selected.length} selected session(s)? This cannot be undone.`)) return;
    try {
      await deleteMultipleSavedMeetingSessions(chrome.storage.local, selected);
      await renderStorageDashboard(container);
    } catch (err) {
      console.error("[LateMeet] Failed to delete selected sessions:", err);
      alert("Failed to delete selected sessions. See console for details.");
    }
  });

  // Clear all sessions
  clearAllBtn?.addEventListener("click", async () => {
    if (!confirm("Delete ALL saved sessions and clear storage? This cannot be undone.")) return;
    try {
      await deleteAllSavedMeetingSessions(chrome.storage.local);
      await renderStorageDashboard(container);
    } catch (err) {
      console.error("[LateMeet] Failed to clear sessions:", err);
      alert("Failed to clear sessions. See console for details.");
    }
  });

  // Select all toggle
  selectAllBtn?.addEventListener("click", () => {
    const allChecked = Array.from(meetingList).every((c) => c.checked);
    meetingList.forEach((c) => (c.checked = !allChecked));
    if (selectAllBtn) selectAllBtn.setAttribute("aria-pressed", String(!allChecked));
    updateSelectionState();
  });

  const refreshBtn = container.querySelector("#storage-refresh");
  refreshBtn?.addEventListener("click", () => renderStorageDashboard(container));
}
