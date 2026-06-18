// ——— API Cost & Token Usage Dashboard ———
// Renders a summary of historical API usage from chrome.storage.local.
// Used in both the options page and the side panel Usage tab.

import { getUsageStats } from "./usageTracker";
import { DayStats } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function renderApiUsageDashboard(container: HTMLElement): Promise<void> {
  container.innerHTML = '<p class="usage-loading">Loading API usage stats…</p>';

  try {
    const stats = await getUsageStats();
    container.innerHTML = buildDashboardHTML(stats);
    attachEventListeners(container);
  } catch (err) {
    console.error("[LateMeet] Failed to load API usage dashboard:", err);
    container.innerHTML = '<p class="usage-error">Failed to load API usage data.</p>';
  }
}

// ——— Helpers ———

function getWindowStats(
  stats: Record<string, DayStats>,
  window: number | "month",
): { tokens: number; cost: number; audioSeconds: number } {
  let tokens = 0;
  let cost = 0;
  let audioSeconds = 0;
  const now = new Date();

  if (window === "month") {
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    for (const [key, val] of Object.entries(stats)) {
      if (key.startsWith(prefix)) {
        tokens += val.totalTokens;
        cost += val.estimatedCost;
        audioSeconds += val.audioSeconds;
      }
    }
  } else {
    for (let i = 0; i < window; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      if (stats[key]) {
        tokens += stats[key].totalTokens;
        cost += stats[key].estimatedCost;
        audioSeconds += stats[key].audioSeconds;
      }
    }
  }

  return { tokens, cost, audioSeconds };
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatAudio(secs: number): string {
  const totalSecs = Math.round(secs);
  if (totalSecs < 1) return "0s";
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ——— HTML builders ———

function summaryCardHTML(
  label: string,
  data: { tokens: number; cost: number; audioSeconds: number },
): string {
  return `
    <div class="usage-card">
      <div class="usage-card-header">
        <span class="usage-label">${escapeHtml(label)}</span>
      </div>
      <div class="usage-summary-stat">
        <div class="summary-row">
          <span>Tokens</span>
          <strong>${data.tokens.toLocaleString()}</strong>
        </div>
        <div class="summary-row">
          <span>Audio</span>
          <strong>${formatAudio(data.audioSeconds)}</strong>
        </div>
        <div class="summary-row accent-row">
          <span>Est. cost</span>
          <strong class="cost-val">$${data.cost.toFixed(4)}</strong>
        </div>
      </div>
    </div>`;
}

function buildDashboardHTML(stats: Record<string, DayStats>): string {
  const isEmpty = Object.keys(stats).length === 0;

  if (isEmpty) {
    return `
      <div class="usage-dashboard">
        <div class="usage-card">
          <div class="usage-empty-state">
            <div class="usage-empty-icon">💳</div>
            <div class="usage-empty-title">No usage recorded yet</div>
            <p class="usage-empty-desc">
              Start a Google Meet session to begin tracking token consumption
              and estimated API costs in real time.
            </p>
          </div>
        </div>
        <div class="usage-action-row">
          <button class="usage-refresh-btn" id="usage-refresh">↻ Refresh</button>
        </div>
        <p class="usage-footnote">
          Costs estimated using OpenAI published pricing.<br>
          ElevenLabs STT estimated at ~$0.40/hr.
        </p>
      </div>`;
  }

  const weekly = getWindowStats(stats, 7);
  const monthly = getWindowStats(stats, "month");
  const allTime = Object.values(stats).reduce(
    (acc, d) => ({
      tokens: acc.tokens + d.totalTokens,
      cost: acc.cost + d.estimatedCost,
      audioSeconds: acc.audioSeconds + d.audioSeconds,
    }),
    { tokens: 0, cost: 0, audioSeconds: 0 },
  );

  const sortedDays = Object.entries(stats)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14);

  return `
    <div class="usage-dashboard">

      <!-- Weekly / Monthly summary cards -->
      <div class="usage-grid-summary">
        ${summaryCardHTML("This Week (7 days)", weekly)}
        ${summaryCardHTML("This Month", monthly)}
      </div>

      <!-- All-time totals banner -->
      <div class="usage-card">
        <div class="usage-alltime-banner">
          <div>
            <div class="usage-alltime-heading">All Time · Tokens</div>
            <div class="usage-alltime-value">
              ${allTime.tokens.toLocaleString()}
              <span>tokens</span>
            </div>
          </div>
          <div style="text-align:right;">
            <div class="usage-alltime-heading">All Time · Est. Cost</div>
            <div class="usage-alltime-cost">$${allTime.cost.toFixed(4)}</div>
          </div>
        </div>
      </div>

      <!-- 14-day daily breakdown table -->
      <div class="usage-card">
        <div class="usage-card-header">
          <span class="usage-label">Daily Breakdown · Last 14 Days</span>
        </div>
        <div class="usage-table-wrapper">
          <table class="usage-table" aria-label="Daily API usage breakdown">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Tokens</th>
                <th scope="col">Audio</th>
                <th scope="col">Est. Cost</th>
              </tr>
            </thead>
            <tbody>
              ${sortedDays
                .map(
                  ([date, day]) => `
                <tr>
                  <td>${escapeHtml(date)}</td>
                  <td>${day.totalTokens.toLocaleString()}</td>
                  <td>${formatAudio(day.audioSeconds)}</td>
                  <td class="cost-val">$${day.estimatedCost.toFixed(4)}</td>
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Actions -->
      <div class="usage-action-row">
        <button class="usage-refresh-btn" id="usage-refresh">↻ Refresh</button>
        <button class="usage-clear-btn" id="usage-clear">✕ Reset History</button>
      </div>

      <p class="usage-footnote">
        Costs estimated using OpenAI published pricing.<br>
        ElevenLabs STT estimated at ~$0.40/hr (Starter plan).
      </p>
    </div>`;
}

// ——— Event listeners ———

function attachEventListeners(container: HTMLElement): void {
  container.querySelector("#usage-refresh")?.addEventListener("click", () => {
    renderApiUsageDashboard(container);
  });

  container.querySelector("#usage-clear")?.addEventListener("click", async () => {
    if (
      confirm("Permanently clear all local API usage and token history?\nThis cannot be undone.")
    ) {
      await chrome.storage.local.remove("usageStats");
      renderApiUsageDashboard(container);
    }
  });
}
