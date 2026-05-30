import { getStorageStats, formatBytes, deleteSavedMeetingSession } from "./utils/storageUtils";
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
          <div class="storage-card-header">
            <span class="storage-label">Largest meetings</span>
          </div>
          <ul class="storage-meeting-list">
            ${stats.largestMeetings
              .map(
                (m) => `
              <li class="storage-meeting-item">
                <div class="storage-meeting-info">
                  <span class="storage-meeting-title">${escapeHtml(m.title)}</span>
                  <span class="storage-meeting-size">${formatBytes(m.totalBytes)}</span>
                </div>
                <button class="storage-delete-btn" data-id="${escapeHtml(m.id)}">Delete</button>
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
      if (confirm("Delete this meeting's stored data?")) {
        await deleteSavedMeetingSession(chrome.storage.local, id);
        await renderStorageDashboard(container);
      }
    });
  });

  const refreshBtn = container.querySelector("#storage-refresh");
  refreshBtn?.addEventListener("click", () => renderStorageDashboard(container));
}
