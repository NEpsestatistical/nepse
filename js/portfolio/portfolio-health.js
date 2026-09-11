/* ---------- Portfolio Health (diversification / concentration / risk) ----------
   Distinct from health.js (Data Health = data integrity checker).
   This one answers: "is the portfolio itself well-constructed?" — based on
   how spread out it is across stocks and sectors, using live value weights.
   Self-contained, read-only, reuses existing state (holdings, prices, getSector).
*/

function computePortfolioHealth() {
  const rows = holdings.map((h) => {
    const pr = prices[h.symbol];
    const ltp = pr ? pr.ltp : null;
    const value = ltp !== null ? ltp * h.qty : h.avgCost * h.qty;
    const dayChg = getDayChange(pr, ltp);
    return { symbol: h.symbol, value, sector: getSector(h.symbol), dayPct: dayChg ? dayChg.pct : null };
  });

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const holdingsCount = rows.length;

  if (holdingsCount === 0 || totalValue <= 0) {
    return { empty: true };
  }

  // Per-holding weights + HHI (Herfindahl-Hirschman Index, 0–10000 scale using % shares)
  const byHolding = rows.map((r) => ({ ...r, weightPct: (r.value / totalValue) * 100 }))
    .sort((a, b) => b.value - a.value);
  const stockHHI = byHolding.reduce((s, r) => s + r.weightPct * r.weightPct, 0);
  const topHolding = byHolding[0];

  // Per-sector weights + HHI
  const bySectorMap = {};
  byHolding.forEach((r) => { bySectorMap[r.sector] = (bySectorMap[r.sector] || 0) + r.value; });
  const bySector = Object.entries(bySectorMap)
    .map(([sector, value]) => ({ sector, value, weightPct: (value / totalValue) * 100 }))
    .sort((a, b) => b.value - a.value);
  const sectorHHI = bySector.reduce((s, r) => s + r.weightPct * r.weightPct, 0);
  const topSector = bySector[0];
  const sectorsCount = bySector.length;

  // Value-weighted average |day change %| — a rough same-day volatility proxy
  const withDayData = byHolding.filter((r) => r.dayPct !== null);
  const dayVol = withDayData.length
    ? withDayData.reduce((s, r) => s + Math.abs(r.dayPct) * (r.value / totalValue), 0)
    : null;

  return {
    empty: false,
    totalValue, holdingsCount,
    byHolding, stockHHI, topHolding,
    bySector, sectorHHI, topSector, sectorsCount,
    dayVol,
  };
}

function hhiLabel(hhi) {
  // Standard market-concentration convention, applied here to portfolio weights.
  if (hhi < 1500) return { label: "Diversified", cls: "up" };
  if (hhi < 2500) return { label: "Moderately Concentrated", cls: "" };
  return { label: "Highly Concentrated", cls: "down" };
}

function renderPortfolioHealth() {
  const wrap = document.getElementById("porthealthBody");
  const badge = document.getElementById("porthealthBadge");
  if (!wrap) return;

  const h = computePortfolioHealth();

  if (h.empty) {
    wrap.innerHTML = '<div class="empty-state">Add some holdings to see your portfolio health.</div>';
    if (badge) badge.style.display = "none";
    return;
  }

  const stockRisk = hhiLabel(h.stockHHI);
  const sectorRisk = hhiLabel(h.sectorHHI);
  const overallCls = (stockRisk.cls === "down" || sectorRisk.cls === "down") ? "down"
    : (stockRisk.cls === "up" && sectorRisk.cls === "up") ? "up" : "";
  const overallLabel = (stockRisk.cls === "down" || sectorRisk.cls === "down") ? "Elevated Concentration Risk"
    : (stockRisk.cls === "up" && sectorRisk.cls === "up") ? "Well Diversified" : "Moderate Concentration";

  if (badge) {
    if (overallCls === "down") {
      badge.textContent = "!";
      badge.style.display = "inline-block";
      badge.classList.add("has-triggered");
    } else {
      badge.style.display = "none";
      badge.classList.remove("has-triggered");
    }
  }

  const stockBars = h.byHolding.slice(0, 10).map((r, i) => `
    <div style="margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; font-family:'Inter',sans-serif; font-size:12px; margin-bottom:4px;">
        <span class="sym">${esc(r.symbol)}</span>
        <span class="muted">Rs ${fmt(r.value, 0)} · ${fmt(r.weightPct, 1)}%</span>
      </div>
      <div style="height:7px; background:#14181C; border-radius:4px; overflow:hidden;">
        <div style="height:100%; width:${Math.min(r.weightPct, 100)}%; background:${SECTOR_COLORS[i % SECTOR_COLORS.length]}; border-radius:4px;"></div>
      </div>
    </div>
  `).join("");

  const sectorBars = h.bySector.map((r, i) => `
    <div style="margin-bottom:10px;">
      <div style="display:flex; justify-content:space-between; font-family:'Inter',sans-serif; font-size:12px; margin-bottom:4px;">
        <span>${esc(r.sector)}</span>
        <span class="muted">Rs ${fmt(r.value, 0)} · ${fmt(r.weightPct, 1)}%</span>
      </div>
      <div style="height:7px; background:#14181C; border-radius:4px; overflow:hidden;">
        <div style="height:100%; width:${Math.min(r.weightPct, 100)}%; background:${SECTOR_COLORS[i % SECTOR_COLORS.length]}; border-radius:4px;"></div>
      </div>
    </div>
  `).join("");

  wrap.innerHTML = `
    <div class="reconcile-note ${overallCls === "down" ? "bad" : "ok"}" style="margin-bottom:16px;">
      ${overallCls === "down" ? "⚠" : "✓"} ${overallLabel}
    </div>

    <div class="stats" style="margin-bottom:20px;">
      <div class="stat">
        <div class="stat-label">Holdings</div>
        <div class="stat-value">${h.holdingsCount}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Sectors</div>
        <div class="stat-value">${h.sectorsCount}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Top Holding</div>
        <div class="stat-value ${h.topHolding.weightPct > 25 ? "down" : ""}">${esc(h.topHolding.symbol)} · ${fmt(h.topHolding.weightPct, 1)}%</div>
      </div>
      <div class="stat">
        <div class="stat-label">Top Sector</div>
        <div class="stat-value ${h.topSector.weightPct > 40 ? "down" : ""}">${esc(h.topSector.sector)} · ${fmt(h.topSector.weightPct, 1)}%</div>
      </div>
      <div class="stat">
        <div class="stat-label">Stock Concentration (HHI)</div>
        <div class="stat-value ${stockRisk.cls}">${fmt(h.stockHHI, 0)} · ${stockRisk.label}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Sector Concentration (HHI)</div>
        <div class="stat-value ${sectorRisk.cls}">${fmt(h.sectorHHI, 0)} · ${sectorRisk.label}</div>
      </div>
      ${h.dayVol !== null ? `
      <div class="stat">
        <div class="stat-label">Today's Volatility (weighted avg |Δ%|)</div>
        <div class="stat-value">${fmt(h.dayVol, 2)}%</div>
      </div>` : ""}
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
      <div>
        <div class="panel-title" style="margin-bottom:12px; font-size:13px;">By Holding</div>
        ${stockBars}
      </div>
      <div>
        <div class="panel-title" style="margin-bottom:12px; font-size:13px;">By Sector</div>
        ${sectorBars}
      </div>
    </div>

    <div class="muted label" style="font-size:11px; margin-top:18px; line-height:1.6;">
      HHI (Herfindahl-Hirschman Index) measures concentration on a 0–10,000 scale using each position's % weight, squared and summed.
      Below 1,500 is considered diversified, 1,500–2,500 moderately concentrated, above 2,500 highly concentrated — the same convention
      used for market concentration, applied here to your own portfolio weights. This is a structural read on spread, not a
      recommendation — it doesn't know your risk tolerance or conviction in any one position.
    </div>
  `;
}

document.getElementById("porthealthRefreshBtn")?.addEventListener("click", renderPortfolioHealth);
