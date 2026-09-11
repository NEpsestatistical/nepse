function renderUnrealizedPanel() {
  const panel = document.getElementById("unrealPanel");
  if (!panel.classList.contains("show")) return;

  const body = document.getElementById("unrealBody");
  if (!holdings.length) {
    body.innerHTML = '<tr><td colspan="8" class="empty-state">No current holdings yet.</td></tr>';
    return;
  }

  const rows = holdings.map((h) => {
    const p = prices[h.symbol];
    const ltp = p ? p.ltp : null;
    const cost = h.avgCost * h.qty;
    const value = ltp !== null ? ltp * h.qty : null;
    const pl = value !== null ? value - cost : null;
    const plPct = pl !== null && cost > 0 ? (pl / cost) * 100 : null;
    return { symbol: h.symbol, qty: h.qty, avgCost: h.avgCost, ltp, cost, value, pl, plPct };
  });

  rows.sort((a, b) => (b.pl ?? -Infinity) - (a.pl ?? -Infinity));

  body.innerHTML = rows.map((r) => `
    <tr>
      <td class="sym">${esc(r.symbol)}</td>
      <td class="muted">${fmt(r.qty, 0)}</td>
      <td class="muted">Rs ${fmt(r.avgCost, 2)}</td>
      <td class="muted">${r.ltp !== null ? "Rs " + fmt(r.ltp, 2) : "—"}</td>
      <td class="muted">Rs ${fmt(r.cost, 2)}</td>
      <td class="muted">${r.value !== null ? "Rs " + fmt(r.value, 2) : "—"}</td>
      <td class="${r.pl === null ? '' : (r.pl >= 0 ? 'up' : 'down')}">${r.pl === null ? "—" : (r.pl >= 0 ? "+" : "") + "Rs " + fmt(r.pl, 2)}</td>
      <td class="${r.plPct === null ? '' : (r.plPct >= 0 ? 'up' : 'down')}">${r.plPct === null ? "—" : (r.plPct >= 0 ? "+" : "") + fmt(r.plPct, 2) + "%"}</td>
    </tr>
  `).join("");
}

document.getElementById("unrealBtn").addEventListener("click", () => {
  document.getElementById("unrealPanel").classList.toggle("show");
  renderUnrealizedPanel();
});

document.getElementById("sectorBtn").addEventListener("click", () => {
  document.getElementById("sectorPanel").classList.toggle("show");
  renderSectorBreakdown();
});

function renderPerformancePanel() {
  const panel = document.getElementById("perfPanel");
  if (!panel.classList.contains("show")) return;

  const p = getCurrentPortfolio();
  const validTrades = (p.transactions || []).filter((t) => t.symbol && t.side && t.qty > 0 && t.price >= 0);
  const { perTransaction, realizedPL: rplFromTrades, realizedNetPL, hasAnyNetData, lotStatus } = buildFIFOAnalysis(validTrades);

  const sells = Object.values(perTransaction).filter((a) => a.side === "sell" && a.matches.length);

  let totalGains = 0, totalLosses = 0, wins = 0, losses = 0;
  let best = null, worst = null;
  const bySymbol = {};

  sells.forEach((a) => {
    if (a.realizedPL > 0) { totalGains += a.realizedPL; wins++; }
    else if (a.realizedPL < 0) { totalLosses += a.realizedPL; losses++; }

    if (!best || a.realizedPL > best.realizedPL) best = a;
    if (!worst || a.realizedPL < worst.realizedPL) worst = a;

    if (!bySymbol[a.symbol]) bySymbol[a.symbol] = { symbol: a.symbol, qty: 0, cost: 0, proceeds: 0, pl: 0 };
    bySymbol[a.symbol].qty += a.qty - (a.unmatchedQty || 0);
    bySymbol[a.symbol].cost += a.costBasis;
    bySymbol[a.symbol].proceeds += a.proceeds;
    bySymbol[a.symbol].pl += a.realizedPL;
  });

  const totalSells = sells.length;
  const winRate = totalSells ? (wins / totalSells) * 100 : null;

  const grid = document.getElementById("perfGrid");
  const netLine = hasAnyNetData
    ? `<div class="stat-value ${realizedNetPL >= 0 ? "up" : "down"}">${realizedNetPL >= 0 ? "+" : ""}Rs ${fmt(realizedNetPL, 0)}</div>`
    : `<div class="stat-value faint">No charges entered</div>`;
  grid.innerHTML = `
    <div class="perf-cell">
      <div class="stat-label">Net Realized P/L</div>
      ${netLine}
    </div>
    <div class="perf-cell">
      <div class="stat-label">Gross Realized P/L</div>
      <div class="stat-value ${rplFromTrades >= 0 ? "up" : "down"}">${rplFromTrades >= 0 ? "+" : ""}Rs ${fmt(rplFromTrades, 0)}</div>
    </div>
    <div class="perf-cell">
      <div class="stat-label">Total Realized Gains</div>
      <div class="stat-value up">+Rs ${fmt(totalGains, 0)}</div>
    </div>
    <div class="perf-cell">
      <div class="stat-label">Total Realized Losses</div>
      <div class="stat-value down">Rs ${fmt(totalLosses, 0)}</div>
    </div>
    <div class="perf-cell">
      <div class="stat-label">Winning Sells</div>
      <div class="stat-value up">${wins}</div>
    </div>
    <div class="perf-cell">
      <div class="stat-label">Losing Sells</div>
      <div class="stat-value down">${losses}</div>
    </div>
    <div class="perf-cell">
      <div class="stat-label">Win Rate</div>
      <div class="stat-value">${winRate !== null ? fmt(winRate, 1) + "%" : "—"}</div>
    </div>
    <div class="perf-cell">
      <div class="stat-label">Closed Sells</div>
      <div class="stat-value">${totalSells}</div>
    </div>
  `;

  const bw = document.getElementById("bestWorstRow");
  if (!totalSells) {
    bw.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">No closed sells yet in this portfolio.</div>';
  } else {
    bw.innerHTML = `
      <div class="bw-card">
        <div class="bw-label">Best Sale</div>
        <div class="bw-sym">${esc(best.symbol)} · ${esc(best.date || "not set")}</div>
        <div class="bw-amt up">+Rs ${fmt(best.realizedPL, 0)} (${best.realizedPLPercent >= 0 ? "+" : ""}${fmt(best.realizedPLPercent, 1)}%)</div>
      </div>
      <div class="bw-card">
        <div class="bw-label">Worst Sale</div>
        <div class="bw-sym">${esc(worst.symbol)} · ${esc(worst.date || "not set")}</div>
        <div class="bw-amt down">${worst.realizedPL >= 0 ? "+" : ""}Rs ${fmt(worst.realizedPL, 0)} (${worst.realizedPLPercent >= 0 ? "+" : ""}${fmt(worst.realizedPLPercent, 1)}%)</div>
      </div>
    `;
  }

  const stockBody = document.getElementById("stockPerfBody");
  const symRows = Object.values(bySymbol).sort((a, b) => b.pl - a.pl);
  if (!symRows.length) {
    stockBody.innerHTML = '<tr><td colspan="6" class="empty-state">No closed positions yet.</td></tr>';
  } else {
    stockBody.innerHTML = symRows.map((s) => {
      const ret = s.cost > 0 ? (s.pl / s.cost) * 100 : 0;
      return `
        <tr>
          <td class="sym">${esc(s.symbol)}</td>
          <td class="muted">${fmt(s.qty, 0)}</td>
          <td class="muted">Rs ${fmt(s.cost, 2)}</td>
          <td class="muted">Rs ${fmt(s.proceeds, 2)}</td>
          <td class="${s.pl >= 0 ? "up" : "down"}">${s.pl >= 0 ? "+" : ""}Rs ${fmt(s.pl, 2)}</td>
          <td class="${ret >= 0 ? "up" : "down"}">${ret >= 0 ? "+" : ""}${fmt(ret, 2)}%</td>
        </tr>
      `;
    }).join("");
  }

  let lotsHtml = "";
  const lotsBySymbol = {};
  lotStatus.forEach((l) => {
    const symOfLot = perTransaction[l.transactionId]?.symbol;
    if (!symOfLot) return;
    if (!lotsBySymbol[symOfLot]) lotsBySymbol[symOfLot] = [];
    lotsBySymbol[symOfLot].push(l);
  });
  const lotSymbols = Object.keys(lotsBySymbol).sort();
  if (lotSymbols.length) {
    lotsHtml = `<div class="stat-label label" style="margin-top:18px;">FIFO Lot Status (all buy lots)</div>`;
    lotSymbols.forEach((sym) => {
      const lots = lotsBySymbol[sym].sort((a, b) => (a.buyDate || "").localeCompare(b.buyDate || ""));
      const lines = lots.map((l) => {
        const statusClass = l.status === "OPEN" ? "open" : l.status === "PARTIALLY SOLD" ? "partial" : "closed";
        return `
          <div class="lot-line">
            <div>${l.buyDate || "not set"}</div>
            <div class="muted"><span class="m-label">Orig Qty</span><br>${fmt(l.originalQty, 0)}</div>
            <div class="muted"><span class="m-label">Sold</span><br>${fmt(l.matchedQty, 0)}</div>
            <div class="muted"><span class="m-label">Remaining</span><br>${fmt(l.remainingQty, 0)}</div>
            <div class="muted"><span class="m-label">Orig Cost</span><br>Rs ${fmt(l.originalCost, 2)}</div>
            <div class="muted"><span class="m-label">Remaining Cost</span><br>Rs ${fmt(l.remainingCost, 2)}</div>
            <div><span class="lot-status-tag ${statusClass}">${l.status}</span></div>
          </div>
        `;
      }).join("");
      lotsHtml += `<div style="margin-top:8px;"><div class="muted label" style="font-size:12px; font-weight:600; margin-bottom:2px;">${esc(sym)}</div>${lines}</div>`;
    });
  }
  let lotsWrap = document.getElementById("lotStatusWrap");
  if (!lotsWrap) {
    lotsWrap = document.createElement("div");
    lotsWrap.id = "lotStatusWrap";
    document.getElementById("stockPerfWrap").after(lotsWrap);
  }
  lotsWrap.innerHTML = lotsHtml;

  const sumTxPL = sells.reduce((s, a) => s + a.realizedPL, 0);
  const reconcileEl = document.getElementById("reconcileNote");
  const diff = Math.abs(sumTxPL - rplFromTrades);
  if (diff <= 0.01) {
    reconcileEl.className = "reconcile-note ok";
    reconcileEl.textContent = `✓ Reconciled: sum of all completed FIFO sell P/L (Rs ${fmt(sumTxPL, 2)}) matches portfolio lifetime realized P/L (Rs ${fmt(rplFromTrades, 2)}).`;
  } else {
    reconcileEl.className = "reconcile-note bad";
    reconcileEl.textContent = `⚠ Reconciliation mismatch: sum of sell P/L (Rs ${fmt(sumTxPL, 2)}) vs lifetime realized P/L (Rs ${fmt(rplFromTrades, 2)}). This shouldn't happen — check the console.`;
  }
}

document.getElementById("renamePortfolioBtn").addEventListener("click", () => {
  renamePortfolioTo(document.getElementById("renamePortfolioInput").value);
  document.getElementById("renamePortfolioInput").value = "";
});
document.getElementById("clearPortfolioBtn").addEventListener("click", clearCurrentPortfolioData);
document.getElementById("deletePortfolioBtn").addEventListener("click", deleteCurrentPortfolio);

document.getElementById("exportAllBtn").addEventListener("click", () => {
  const payload = {
    app: "NEPSE Portfolio",
    exportedAt: new Date().toISOString(),
    portfolios,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `nepse-portfolio-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById("importBackupInput").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const incoming = Array.isArray(parsed) ? parsed : parsed.portfolios;
      if (!Array.isArray(incoming) || !incoming.length) throw new Error("No portfolios found in file.");
      appConfirm({
        title: "Restore backup?",
        message: `This will replace all ${portfolios.length} current portfolio(s) with ${incoming.length} from the backup file. This can't be undone.`,
        confirmText: "Restore",
        danger: true,
        onConfirm: () => {
          portfolios = incoming;
          currentPortfolioId = portfolios[0].id;
          saveState();
          recompute();
          renderPortfolioTabs();
          render();
          renderTransactions();
          renderDividends();
          refresh();
          renderWatchlist();
          evaluateAlerts();
        },
      });
    } catch (err) {
      appAlert({ title: "Restore failed", message: "That file doesn't look like a valid backup: " + err.message });
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

