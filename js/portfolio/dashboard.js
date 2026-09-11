function getDayChange(p, ltp) {
  if (!p) return null;
  const pct = [p.percentChange, p.perChange, p.changePercent, p.percChange, p.pctChange]
    .find((v) => v !== undefined && v !== null && !Number.isNaN(Number(v)));
  const amtRaw = [p.pointChange, p.change, p.netChange, p.diff, p.priceChange]
    .find((v) => v !== undefined && v !== null && !Number.isNaN(Number(v)));

  let amt = amtRaw !== undefined ? Number(amtRaw) : null;
  let pctNum = pct !== undefined ? Number(pct) : null;

  if (amt === null && pctNum !== null && ltp !== null) {
    amt = ltp - ltp / (1 + pctNum / 100);
  } else if (pctNum === null && amt !== null && ltp !== null) {
    const prevClose = ltp - amt;
    pctNum = prevClose ? (amt / prevClose) * 100 : 0;
  }

  if (amt === null || pctNum === null || Number.isNaN(amt) || Number.isNaN(pctNum)) return null;
  return { amt, pct: pctNum };
}

function render() {
  const list = document.getElementById("holdingsList");
  list.innerHTML = "";

  if (holdings.length === 0) {
    list.innerHTML = '<div class="empty-state">No holdings yet — import from Meroshare or add one manually below.</div>';
  }

  const rates = getRates();
  let totalValue = 0, totalCost = 0, totalGain = 0, totalTax = 0;
  let totalDayChange = 0, totalDayChangeBase = 0, anyDayChange = false;

  holdings.forEach((h) => {
    const p = prices[h.symbol];
    const ltp = p ? p.ltp : null;
    const value = ltp ? ltp * h.qty : null;
    const cost = h.avgCost * h.qty;
    const pl = value !== null ? value - cost : null;
    const plPct = pl !== null ? (pl / cost) * 100 : null;

    const dayChg = getDayChange(p, ltp);
    if (dayChg && h.qty) {
      anyDayChange = true;
      totalDayChange += dayChg.amt * h.qty;
      totalDayChangeBase += (ltp - dayChg.amt) * h.qty;
    }

    const days = holdingDays(h.purchaseDate);
    const isLongTerm = days !== null && days > rates.thresholdDays;
    const rate = days === null ? null : (isLongTerm ? rates.lt : rates.st);
    const estTax = pl !== null && pl > 0 && rate !== null ? pl * rate : (pl !== null && pl > 0 ? pl * rates.st : 0);

    if (value) totalValue += value;
    totalCost += cost;
    if (pl !== null) totalGain += pl;
    if (pl > 0) totalTax += estTax;

    let flashClass = "";
    if (prevPrices[h.symbol] && ltp !== null && prevPrices[h.symbol].ltp !== ltp) {
      flashClass = ltp > prevPrices[h.symbol].ltp ? "flash-up" : "flash-down";
    }

    const termTag = days === null
      ? '<span class="faint label">—</span>'
      : isLongTerm
        ? '<span class="tag lt label">LT · ' + days + 'd</span>'
        : '<span class="tag st label">ST · ' + days + 'd</span>';

    const dayChgHtml = dayChg
      ? `<div class="day-chg-mini">
           <div class="mini-track"><div class="mini-fill ${dayChg.pct >= 0 ? 'up' : 'down'}" style="width:${Math.min(Math.abs(dayChg.pct) * 20, 100)}%;"></div></div>
           <span class="mini-pct ${dayChg.pct >= 0 ? 'up' : 'down'}">${dayChg.pct >= 0 ? '+' : ''}${fmt(dayChg.pct, 2)}%</span>
         </div>`
      : "";

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <span class="sym-cell"><span class="sym">${esc(h.symbol)}</span>${dayChgHtml}</span>
      <span class="muted">${h.qty}</span>
      <span class="muted">${fmt(h.avgCost, 2)}</span>
      <span class="${flashClass}">${ltp !== null ? fmt(ltp, 2) : "—"}</span>${staleSymbols.has(h.symbol) ? ' <span class="faint label" title="Last successful update — feed failed on the most recent refresh">stale</span>' : ""}
      <span>${value !== null ? "Rs " + fmt(value, 0) : "—"}</span>
      <span class="sym-cell">
        <span class="${pl === null ? '' : (pl >= 0 ? 'up' : 'down')}">${pl === null ? "—" : (pl >= 0 ? "+" : "") + "Rs " + fmt(pl, 0)}</span>
        <span class="${pl === null ? '' : (pl >= 0 ? 'up' : 'down')} label" style="font-size:11px;">${pl === null ? "" : (pl >= 0 ? "+" : "") + fmt(plPct, 1) + "%"}</span>
      </span>
      <span>${termTag}</span>
      <span class="muted">${pl > 0 ? "Rs " + fmt(estTax, 0) : "—"}</span>
      <span class="faint label">${esc(h.purchaseDate || "not set")}</span>
      <span class="row-actions">
        <button class="buy-btn" data-id="${h.id}">+ Buy</button>
        <button class="sell-btn" data-id="${h.id}">− Sell</button>
        <button class="remove-btn" data-id="${h.id}">✕</button>
      </span>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const h = holdings.find((x) => x.id == btn.dataset.id);
      if (!h) return;
      appConfirm({
        title: "Remove holding?",
        message: `Remove ${h.symbol} and delete all its transactions from this portfolio?`,
        confirmText: "Remove",
        danger: true,
        onConfirm: () => {
          const p = getCurrentPortfolio();
          p.transactions = p.transactions.filter((t) => t.symbol !== h.symbol);
          saveState();
          recompute();
          refresh();
          renderTransactions();
          renderPerformancePanel();
          renderDividends();
        },
      });
    });
  });

  list.querySelectorAll(".buy-btn").forEach((btn) => {
    btn.addEventListener("click", () => buyHolding(btn.dataset.id));
  });

  list.querySelectorAll(".sell-btn").forEach((btn) => {
    btn.addEventListener("click", () => sellHolding(btn.dataset.id));
  });

  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost ? (totalPL / totalCost) * 100 : 0;
  document.getElementById("totalValue").textContent = "Rs " + fmt(totalValue, 0);
  const plRow = document.getElementById("totalPL");
  plRow.className = "pl-row " + (totalPL >= 0 ? "up" : "down");
  plRow.textContent = (totalPL >= 0 ? "▲ +" : "▼ ") + fmt(totalPL, 0) + " (" + (totalPL >= 0 ? "+" : "") + fmt(totalPLPct, 2) + "%)";

  document.getElementById("statCost").textContent = "Rs " + fmt(totalCost, 0);
  const gainEl = document.getElementById("statGain");
  gainEl.textContent = (totalGain >= 0 ? "+" : "") + "Rs " + fmt(totalGain, 0);
  gainEl.className = "stat-value " + (totalGain >= 0 ? "up" : "down");
  document.getElementById("statTax").textContent = "Rs " + fmt(totalTax, 0);
  document.getElementById("statNet").textContent = "Rs " + fmt(totalGain - totalTax, 0);

  const realizedEl = document.getElementById("statRealized");
  realizedEl.textContent = (realizedPL >= 0 ? "+" : "") + "Rs " + fmt(realizedPL, 0);
  realizedEl.className = "stat-value " + (realizedPL >= 0 ? "up" : "down");

  const dayPlStrip = document.getElementById("dayPlStrip");
  if (anyDayChange) {
    dayPlStrip.style.display = "flex";
    const dayPlPct = totalDayChangeBase ? (totalDayChange / totalDayChangeBase) * 100 : 0;
    const amtEl = document.getElementById("dayPlAmt");
    const pctEl = document.getElementById("dayPlPct");
    const fillEl = document.getElementById("dayPlBarFill");
    const up = totalDayChange >= 0;
    amtEl.textContent = (up ? "+" : "") + "Rs " + fmt(totalDayChange, 0);
    amtEl.className = "amt " + (up ? "up" : "down");
    pctEl.textContent = "(" + (up ? "+" : "") + fmt(dayPlPct, 2) + "%)";
    pctEl.className = "pct " + (up ? "up" : "down");
    fillEl.className = "day-pl-bar-fill " + (up ? "up" : "down");
    fillEl.style.width = Math.min(Math.abs(dayPlPct) * 10, 50) + "%";
  } else {
    dayPlStrip.style.display = "none";
  }

  setTimeout(() => {
    document.querySelectorAll(".flash-up, .flash-down").forEach((el) => el.classList.remove("flash-up", "flash-down"));
  }, 1200);
}

document.getElementById("refreshBtn").addEventListener("click", refresh);
document.getElementById("settingsBtn").addEventListener("click", () => {
  document.getElementById("settingsBox").classList.toggle("show");
});

function renderPortfolioTabs() {
  const wrap = document.getElementById("portfolioTabs");
  wrap.innerHTML = "";
  portfolios.forEach((p) => {
    const tab = document.createElement("div");
    tab.className = "p-tab" + (p.id === currentPortfolioId ? " active" : "");
    tab.innerHTML = `<span class="p-tab-name">${esc(p.name)}</span>`;
    tab.addEventListener("click", () => switchPortfolio(p.id));
    wrap.appendChild(tab);
  });
  const addBtn = document.createElement("button");
  addBtn.className = "p-tab-add";
  addBtn.textContent = "+ New Portfolio";
  addBtn.addEventListener("click", createPortfolio);
  wrap.appendChild(addBtn);
}

