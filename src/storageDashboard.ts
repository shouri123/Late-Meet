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

function showDeleteConfirmModal(container: HTMLElement, sessionId: string): void {
  // Remove any existing modal
  container.querySelector(".storage-confirm-modal")?.remove();

  const previouslyFocused = document.activeElement as HTMLElement | null;

  const modal = document.createElement("div");
  modal.className = "storage-confirm-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "storage-confirm-title");

  modal.innerHTML = `
    <div class="storage-confirm-backdrop"></div>
    <div class="storage-confirm-content">
      <h3 id="storage-confirm-title" class="storage-confirm-title">Delete Meeting Data</h3>
      <p class="storage-confirm-text">Are you sure you want to delete this meeting's stored data? This action cannot be undone.</p>
      <div class="storage-confirm-actions">
        <button class="storage-confirm-cancel" type="button">Cancel</button>
        <button class="storage-confirm-delete" type="button">Delete</button>
      </div>
    </div>
  `;

  container.appendChild(modal);

  const cancelBtn = modal.querySelector(".storage-confirm-cancel") as HTMLButtonElement;
  const deleteBtn = modal.querySelector(".storage-confirm-delete") as HTMLButtonElement;
  const backdrop = modal.querySelector(".storage-confirm-backdrop") as HTMLElement;

  function closeModal() {
    document.removeEventListener("keydown", handleKeydown);
    modal.remove();
    previouslyFocused?.focus();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
    }
    if (e.key === "Tab") {
      const focusable = [cancelBtn, deleteBtn];
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  cancelBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);
  document.addEventListener("keydown", handleKeydown);

  deleteBtn.addEventListener("click", async () => {
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting...";
    try {
      await deleteSavedMeetingSession(chrome.storage.local, sessionId);
      closeModal();
      await renderStorageDashboard(container);
    } catch (err) {
      console.error("[LateMeet] Failed to delete session:", err);
      deleteBtn.disabled = false;
      deleteBtn.textContent = "Delete";
    }
  });

  // Focus the cancel button by default (safer action)
  cancelBtn.focus();
}

function attachEventListeners(container: HTMLElement): void {
  container.querySelectorAll(".storage-delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = (e.target as HTMLElement).dataset.id!;
      showDeleteConfirmModal(container, id);
    });
  });

  const refreshBtn = container.querySelector("#storage-refresh");
  refreshBtn?.addEventListener("click", () => renderStorageDashboard(container));
}
