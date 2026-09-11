/* ---------- Diagnostics / Health Panel ----------
   Self-contained: reads existing state (holdings, prices, staleSymbols,
   the current portfolio's transactions/watchlist/alerts) and the FIFO
   engine's output. Doesn't mutate anything — purely a read-only report
   with "jump to fix" buttons that reuse showView().
*/

function collectHealthIssues() {
  const issues = [];
  const p = getCurrentPortfolio();
  if (!p) return issues;

  const validTrades = (p.transactions || []).filter((t) => t.symbol && t.side && t.qty > 0 && t.price >= 0);
  const { perTransaction } = buildFIFOAnalysis(validTrades);

  // 1. Sells with no matching buy lot
  Object.values(perTransaction).forEach((a) => {
    if (a.side === "sell" && a.unmatchedQty > 0) {
      issues.push({
        severity: "warn",
        title: `${a.symbol}: sell with no matching buy lot`,
        detail: `${a.unmatchedQty} share(s) sold on ${a.date || "an unset date"} have no matching buy transaction — often bonus/rights shares that were never entered as a buy. Cost basis for these shares is treated as zero, which overstates realized gain.`,
        action: "activity",
        actionLabel: "Review in Activity",
      });
    }
  });

  // 2. Duplicate-looking transactions (possible double import)
  const seen = new Map();
  (p.transactions || []).forEach((t) => {
    const key = [t.symbol, t.side, t.qty, t.price, t.date].join("|");
    seen.set(key, (seen.get(key) || 0) + 1);
  });
  seen.forEach((count, key) => {
    if (count > 1) {
      const [symbol, side, qty, price, date] = key.split("|");
      issues.push({
        severity: "warn",
        title: `${symbol}: ${count} identical ${side} transactions`,
        detail: `${count} transactions with the same symbol, side, quantity (${qty}), price (${price}), and date (${date || "unset"}) — check for a duplicate import.`,
        action: "activity",
        actionLabel: "Review in Activity",
      });
    }
  });

  // 3. Holdings with no live price at all
  holdings.forEach((h) => {
    const pr = prices[h.symbol];
    if (!pr || pr.ltp === undefined || pr.ltp === null) {
      issues.push({
        severity: "warn",
        title: `${h.symbol}: no live price data`,
        detail: "The feed has never returned a price for this symbol. Value and P/L figures fall back to avg cost where shown.",
        action: "holdings",
        actionLabel: "View Holdings",
      });
    } else if (typeof staleSymbols !== "undefined" && staleSymbols.has(h.symbol)) {
      issues.push({
        severity: "info",
        title: `${h.symbol}: showing a stale price`,
        detail: "The most recent refresh failed for this symbol — the figures shown are from the last successful update.",
        action: "holdings",
        actionLabel: "View Holdings",
      });
    }
  });

  // 4. Unclassified sectors
  const unclassified = new Set();
  holdings.forEach((h) => { if (getSector(h.symbol) === "Unclassified") unclassified.add(h.symbol); });
  unclassified.forEach((sym) => {
    issues.push({
      severity: "info",
      title: `${sym}: sector not classified`,
      detail: "This symbol isn't mapped to a sector, so it's excluded from the sector breakdown chart until you set one.",
      action: "analysis",
      actionLabel: "Set Sector",
    });
  });

  // 5. Watchlist entries with no live price
  (p.watchlist || []).forEach((w) => {
    const pr = prices[w.symbol];
    if (!pr || pr.ltp === undefined || pr.ltp === null) {
      issues.push({
        severity: "info",
        title: `${w.symbol}: watchlist item has no live price`,
        detail: "Double-check the symbol is spelled correctly — the feed hasn't returned data for it.",
        action: "watchlist",
        actionLabel: "View Watchlist",
      });
    }
  });

  // 6. Alerts (non-portfolio-level) with no live price to evaluate against
  (p.alerts || []).forEach((a) => {
    if (a.type && !a.type.startsWith("portfolio_")) {
      const pr = prices[a.symbol];
      if (!pr || pr.ltp === undefined || pr.ltp === null) {
        issues.push({
          severity: "info",
          title: `${a.symbol}: alert can't evaluate yet`,
          detail: "No live price for this symbol yet, so this alert will never trigger until the feed returns data.",
          action: "alerts",
          actionLabel: "View Alerts",
        });
      }
    }
  });

  return issues;
}

function renderHealthPanel() {
  const issues = collectHealthIssues();
  const warnCount = issues.filter((i) => i.severity === "warn").length;
  const infoCount = issues.length - warnCount;

  const badge = document.getElementById("healthBadge");
  if (badge) {
    if (issues.length === 0) {
      badge.style.display = "none";
      badge.classList.remove("has-triggered");
    } else {
      badge.textContent = warnCount > 0 ? warnCount : issues.length;
      badge.style.display = "inline-block";
      badge.classList.toggle("has-triggered", warnCount > 0);
    }
  }

  const statTotal = document.getElementById("healthStatTotal");
  const statWarn = document.getElementById("healthStatWarn");
  const statInfo = document.getElementById("healthStatInfo");
  if (statTotal) statTotal.textContent = issues.length;
  if (statWarn) statWarn.textContent = warnCount;
  if (statInfo) statInfo.textContent = infoCount;

  const summaryEl = document.getElementById("healthSummary");
  if (summaryEl) {
    if (issues.length === 0) {
      summaryEl.textContent = "✓ No issues found — your data looks clean.";
      summaryEl.className = "reconcile-note ok";
    } else {
      summaryEl.textContent = `${issues.length} issue${issues.length > 1 ? "s" : ""} found — ${warnCount} need attention, ${infoCount} informational.`;
      summaryEl.className = "reconcile-note " + (warnCount > 0 ? "bad" : "ok");
    }
  }

  const listEl = document.getElementById("healthIssuesList");
  if (!listEl) return;

  if (issues.length === 0) {
    listEl.innerHTML = '<div class="empty-state">✓ No issues found — your data looks clean.</div>';
    return;
  }

  const sorted = [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warn" ? -1 : 1));

  listEl.innerHTML = sorted.map((iss) => `
    <div class="health-issue ${iss.severity}" style="display:flex; gap:12px; align-items:flex-start; padding:12px 14px; border:1px solid ${iss.severity === "warn" ? "rgba(196,85,61,0.35)" : "#2A3138"}; background:${iss.severity === "warn" ? "rgba(196,85,61,0.08)" : "#14181C"}; border-radius:8px; margin-bottom:8px;">
      <div style="font-size:16px; line-height:1;">${iss.severity === "warn" ? "⚠" : "ℹ"}</div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600; font-size:13px; color:#EDEFF1; margin-bottom:3px;">${esc(iss.title)}</div>
        <div class="muted" style="font-size:12px; line-height:1.5;">${esc(iss.detail)}</div>
      </div>
      <button class="btn label health-issue-action" data-view="${esc(iss.action)}" style="flex-shrink:0; font-size:11.5px; padding:6px 10px;">${esc(iss.actionLabel)}</button>
    </div>
  `).join("");

  listEl.querySelectorAll(".health-issue-action").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });
}

document.getElementById("healthRefreshBtn")?.addEventListener("click", renderHealthPanel);
