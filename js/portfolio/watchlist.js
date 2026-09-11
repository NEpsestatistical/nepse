/* ---------- Watchlist Workspace (Checkpoint 09) ---------- */
let watchlistActiveFilter = "all";
let watchlistSearchQuery = "";

function getWatchlist() {
  const p = getCurrentPortfolio();
  if (!p) return [];
  if (!Array.isArray(p.watchlist)) p.watchlist = [];
  return p.watchlist;
}

function updateWatchlistNavBadge() {
  const badge = document.getElementById("watchlistBadge");
  if (!badge) return;
  const list = getWatchlist();
  if (list.length === 0) {
    badge.style.display = "none";
    badge.classList.remove("has-triggered");
    return;
  }
  let hits = 0;
  list.forEach(w => {
    const pr = prices[w.symbol];
    if (!pr || pr.ltp === undefined || pr.ltp === null) return;
    const target = Number(w.targetPrice);
    if (!target || isNaN(target)) return;
    if (w.targetType === "buy_below" && pr.ltp <= target) hits++;
    if (w.targetType === "sell_above" && pr.ltp >= target) hits++;
  });
  if (hits > 0) {
    badge.textContent = `${hits} HIT`;
    badge.style.display = "inline-block";
    badge.classList.add("has-triggered");
  } else {
    badge.textContent = list.length;
    badge.style.display = "inline-block";
    badge.classList.remove("has-triggered");
  }
}

function renderWatchlist() {
  const list = getWatchlist();
  const statTotal = document.getElementById("watchStatTotal");
  const statNear = document.getElementById("watchStatNear");
  const statHit = document.getElementById("watchStatHit");
  const statTopMover = document.getElementById("watchStatTopMover");
  const tbody = document.getElementById("watchlistTableBody");

  let nearCount = 0;
  let hitCount = 0;
  let topMover = null;
  let maxAbsChange = -1;

  list.forEach(w => {
    const pr = prices[w.symbol];
    if (pr && pr.ltp !== undefined && pr.ltp !== null) {
      const dayChg = getDayChange(pr, pr.ltp);
      if (dayChg && Math.abs(dayChg.pct) > maxAbsChange) {
        maxAbsChange = Math.abs(dayChg.pct);
        topMover = { symbol: w.symbol, pct: dayChg.pct, ltp: pr.ltp };
      }
      const target = Number(w.targetPrice);
      if (target && !isNaN(target) && target > 0) {
        const diffPct = ((pr.ltp - target) / target) * 100;
        if (Math.abs(diffPct) <= 3) nearCount++;
        if (w.targetType === "buy_below" && pr.ltp <= target) hitCount++;
        if (w.targetType === "sell_above" && pr.ltp >= target) hitCount++;
      }
    }
  });

  if (statTotal) statTotal.textContent = list.length;
  if (statNear) statNear.textContent = nearCount;
  if (statHit) statHit.textContent = hitCount;
  if (statTopMover) {
    if (topMover) {
      const cls = topMover.pct >= 0 ? "up" : "down";
      const sign = topMover.pct >= 0 ? "+" : "";
      statTopMover.innerHTML = `<span class="sym">${esc(topMover.symbol)}</span> <span class="${cls}">(${sign}${fmt(topMover.pct, 2)}%)</span>`;
    } else {
      statTopMover.textContent = "—";
    }
  }

  updateWatchlistNavBadge();

  if (!tbody) return;

  let filtered = list.filter(w => {
    if (watchlistSearchQuery) {
      const q = watchlistSearchQuery.toLowerCase();
      const symMatch = w.symbol.toLowerCase().includes(q);
      const noteMatch = (w.note || "").toLowerCase().includes(q);
      if (!symMatch && !noteMatch) return false;
    }
    const pr = prices[w.symbol];
    const target = Number(w.targetPrice);
    const dayChg = pr && pr.ltp ? getDayChange(pr, pr.ltp) : null;
    const diffPct = (pr && pr.ltp && target) ? ((pr.ltp - target) / target) * 100 : null;
    const isHit = (pr && pr.ltp && target) ? (
      (w.targetType === "buy_below" && pr.ltp <= target) ||
      (w.targetType === "sell_above" && pr.ltp >= target)
    ) : false;

    if (watchlistActiveFilter === "near") return diffPct !== null && Math.abs(diffPct) <= 3;
    if (watchlistActiveFilter === "hit") return isHit;
    if (watchlistActiveFilter === "gainers") return dayChg && dayChg.pct > 0;
    if (watchlistActiveFilter === "losers") return dayChg && dayChg.pct < 0;
    return true;
  });

  if (filtered.length === 0) {
    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state" style="padding:32px 16px; text-align:center;">
            <div style="font-size:24px; margin-bottom:8px;">🔭</div>
            <div style="font-size:14px; font-weight:600; color:#EDEFF1; margin-bottom:6px;">Your Watchlist is Empty</div>
            <div style="font-size:12px; color:#8C9BA5; max-width:440px; margin:0 auto 16px;">
              Track prospective NEPSE stocks, monitor live distance to your target entry or exit levels, and execute quick trades with 1 click.
            </div>
            <div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap;">
              <span style="font-size:11.5px; color:#6B7680; align-self:center;">Quick add:</span>
              <button class="btn label watch-quick-add-chip" data-symbol="NABIL" data-target="520" data-rule="buy_below" style="font-size:11px; padding:4px 10px;">+ NABIL (520)</button>
              <button class="btn label watch-quick-add-chip" data-symbol="NICA" data-target="440" data-rule="buy_below" style="font-size:11px; padding:4px 10px;">+ NICA (440)</button>
              <button class="btn label watch-quick-add-chip" data-symbol="CIT" data-target="2200" data-rule="buy_below" style="font-size:11px; padding:4px 10px;">+ CIT (2200)</button>
              <button class="btn label watch-quick-add-chip" data-symbol="SHIVM" data-target="560" data-rule="sell_above" style="font-size:11px; padding:4px 10px;">+ SHIVM (560)</button>
            </div>
          </td>
        </tr>
      `;
      tbody.querySelectorAll(".watch-quick-add-chip").forEach(btn => {
        btn.addEventListener("click", () => {
          quickAddWatchlistSymbol(btn.dataset.symbol, btn.dataset.target, btn.dataset.rule);
        });
      });
      return;
    } else {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="padding:20px; text-align:center; color:#8C9BA5;">No watchlist stocks match the active filter or search query.</td></tr>`;
      return;
    }
  }

  tbody.innerHTML = filtered.map(w => {
    const pr = prices[w.symbol];
    const prevPr = prevPrices[w.symbol];
    const hasPrice = pr && pr.ltp !== undefined && pr.ltp !== null;
    const ltp = hasPrice ? pr.ltp : null;
    const dayChg = hasPrice ? getDayChange(pr, ltp) : null;
    const target = Number(w.targetPrice) || null;
    const sector = getSector(w.symbol);

    let ltpClass = "";
    if (hasPrice && prevPr && prevPr.ltp) {
      if (ltp > prevPr.ltp) ltpClass = "flash-up";
      else if (ltp < prevPr.ltp) ltpClass = "flash-down";
    }

    let dayChangeHtml = '<span class="muted">—</span>';
    if (dayChg) {
      const sign = dayChg.pct >= 0 ? "+" : "";
      const cls = dayChg.pct >= 0 ? "up" : "down";
      dayChangeHtml = `<span class="${cls}" style="font-weight:600;">${sign}${fmt(dayChg.pct, 2)}%</span> <span class="muted" style="font-size:11px;">(${sign}Rs ${fmt(dayChg.amt, 2)})</span>`;
    }

    let targetRuleLabel = "";
    if (w.targetType === "buy_below") targetRuleLabel = `<span class="alert-tag active" style="font-size:10.5px; padding:2px 6px;">Buy ≤ Rs ${target ? fmt(target, 2) : "—"}</span>`;
    else if (w.targetType === "sell_above") targetRuleLabel = `<span class="alert-tag triggered" style="font-size:10.5px; padding:2px 6px;">Sell ≥ Rs ${target ? fmt(target, 2) : "—"}</span>`;
    else targetRuleLabel = `<span class="alert-tag paused" style="font-size:10.5px; padding:2px 6px;">Track Only</span>`;

    let distanceHtml = '<span class="muted">—</span>';
    let statusPill = '<span class="alert-tag paused">MONITORING</span>';
    let isHit = false;

    if (hasPrice && target && target > 0) {
      const diffAmt = ltp - target;
      const diffPct = (diffAmt / target) * 100;
      const absPct = Math.abs(diffPct);
      const isNear = absPct <= 3;

      if (w.targetType === "buy_below" && ltp <= target) isHit = true;
      if (w.targetType === "sell_above" && ltp >= target) isHit = true;

      if (isHit) {
        statusPill = `<span class="alert-tag active" style="box-shadow:0 0 8px rgba(63,167,150,0.5);">🎯 TARGET HIT</span>`;
      } else if (isNear) {
        statusPill = `<span class="alert-tag active" style="background:rgba(212,163,58,0.2); color:#D4A33A; border-color:rgba(212,163,58,0.4);">NEAR (${fmt(absPct, 1)}%)</span>`;
      }

      const barFill = Math.min(100, Math.max(10, 100 - absPct * 5));
      const barColor = isHit ? "#3FA796" : (isNear ? "#D4A33A" : "#8C9BA5");
      const diffSign = diffPct >= 0 ? "+" : "";

      distanceHtml = `
        <div style="font-size:12px;">
          <span style="color:${isHit ? '#3FA796' : (isNear ? '#D4A33A' : '#EDEFF1')}; font-weight:600;">
            ${diffSign}${fmt(diffPct, 2)}% (${diffSign}Rs ${fmt(diffAmt, 2)})
          </span>
          <div style="width:110px; height:4px; background:#1C2227; border-radius:2px; margin-top:4px; overflow:hidden;">
            <div style="width:${barFill}%; height:100%; background:${barColor}; border-radius:2px;"></div>
          </div>
        </div>
      `;
    } else if (!hasPrice) {
      statusPill = `<span class="alert-tag paused">FEED PENDING</span>`;
    }

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="sym" style="font-size:13.5px;">${esc(w.symbol)}</span>
            <span class="muted" style="font-size:10.5px; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">${esc(sector)}</span>
          </div>
        </td>
        <td>
          <span class="${ltpClass}" style="font-weight:600; color:#EDEFF1; font-size:13px;">
            ${hasPrice ? "Rs " + fmt(ltp, 2) : '<span class="muted">Waiting…</span>'}
          </span>
        </td>
        <td>${dayChangeHtml}</td>
        <td>${targetRuleLabel}</td>
        <td>${distanceHtml}</td>
        <td style="color:#8C9BA5; font-size:11.5px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escAttr(w.note || '')}">
          ${esc(w.note || "—")}
        </td>
        <td>${statusPill}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="alert-action-btn" onclick="quickTradeFromWatchlist('${escAttr(w.symbol)}', ${ltp || 0})" title="Trade / Buy this stock" style="color:#3FA796; border-color:rgba(63,167,150,0.3);">
            🛒 Buy
          </button>
          <button class="alert-action-btn" onclick="quickAlertFromWatchlist('${escAttr(w.symbol)}', ${target || ltp || 0}, '${escAttr(w.targetType)}')" title="Create price alert">
            🔔 Alert
          </button>
          <button class="alert-action-btn" onclick="editWatchlistItem('${escAttr(w.id)}')" title="Edit target or note">
            ✏️
          </button>
          <button class="alert-action-btn del" onclick="deleteWatchlistItem('${escAttr(w.id)}')" title="Remove from watchlist">
            ✕
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function quickAddWatchlistSymbol(symbol, target, rule) {
  const p = getCurrentPortfolio();
  if (!p) return;
  if (!Array.isArray(p.watchlist)) p.watchlist = [];
  if (p.watchlist.some(w => w.symbol === symbol)) {
    appAlert({ title: "Already Watched", message: `${symbol} is already in your watchlist.` });
    return;
  }
  p.watchlist.unshift({
    id: uid(),
    symbol,
    targetPrice: Number(target) || null,
    targetType: rule || "buy_below",
    note: "Quick-added recommendation",
    createdAt: new Date().toISOString()
  });
  saveState();
  renderWatchlist();
  refresh();
}

function addWatchlistFromForm() {
  const symInput = document.getElementById("watchSymbolInput");
  const targetInput = document.getElementById("watchTargetPriceInput");
  const ruleSelect = document.getElementById("watchTargetTypeSelect");
  const noteInput = document.getElementById("watchNoteInput");

  const symbol = resolveWatchlistSymbol(symInput?.value || "");
  if (!symbol) {
    appAlert({ title: "Symbol Required", message: "Please enter a valid NEPSE stock symbol." });
    return;
  }
  const p = getCurrentPortfolio();
  if (!p) return;
  if (!Array.isArray(p.watchlist)) p.watchlist = [];
  if (p.watchlist.some(w => w.symbol === symbol)) {
    appAlert({ title: "Already Watched", message: `${symbol} is already in your watchlist.` });
    return;
  }

  const rawTarget = targetInput?.value.trim();
  const targetPrice = rawTarget ? Number(rawTarget) : null;
  if (rawTarget && isNaN(targetPrice)) {
    appAlert({ title: "Invalid Target Price", message: "Please enter a valid numeric target price." });
    return;
  }

  const targetType = ruleSelect?.value || "buy_below";
  const note = (noteInput?.value || "").trim();

  p.watchlist.unshift({
    id: uid(),
    symbol,
    targetPrice,
    targetType,
    note,
    createdAt: new Date().toISOString()
  });

  saveState();
  if (symInput) symInput.value = "";
  if (targetInput) targetInput.value = "";
  if (noteInput) noteInput.value = "";
  document.getElementById("watchLivePreview").textContent = "";

  renderWatchlist();
  refresh();
}

function editWatchlistItem(id) {
  const list = getWatchlist();
  const item = list.find(w => w.id === id);
  if (!item) return;

  appPrompt({
    title: `Edit Target for ${esc(item.symbol)}`,
    placeholder: "Target Price (Rs)",
    defaultValue: String(item.targetPrice || ""),
    confirmText: "Save",
    onSubmit: (val) => {
      const n = Number(val);
      if (val.trim() !== "" && isNaN(n)) {
        appAlert({ title: "Invalid Number", message: "Target price must be a valid number." });
        return;
      }
      item.targetPrice = val.trim() ? n : null;
      saveState();
      renderWatchlist();
    }
  });
}

function deleteWatchlistItem(id) {
  const list = getWatchlist();
  const item = list.find(w => w.id === id);
  if (!item) return;

  appConfirm({
    title: `Remove ${esc(item.symbol)}?`,
    message: `Remove ${esc(item.symbol)} from your watchlist? Your portfolio holdings and transaction history will not be affected.`,
    confirmText: "Remove",
    danger: true,
    onConfirm: () => {
      const p = getCurrentPortfolio();
      if (!p || !Array.isArray(p.watchlist)) return;
      p.watchlist = p.watchlist.filter(w => w.id !== id);
      saveState();
      renderWatchlist();
    }
  });
}

function quickTradeFromWatchlist(symbol, ltp) {
  const h = holdings.find(x => x.symbol === symbol);
  if (h) {
    openTradeModal("buy", h.id);
  } else {
    showView("holdings");
    const symEl = document.getElementById("symbolInput");
    const costEl = document.getElementById("costInput");
    const qtyEl = document.getElementById("qtyInput");
    if (symEl) symEl.value = symbol;
    if (costEl && ltp > 0) costEl.value = ltp;
    if (qtyEl) {
      qtyEl.value = "";
      qtyEl.focus();
    }
  }
}

function quickAlertFromWatchlist(symbol, target, targetType) {
  showView("alerts");
  const symEl = document.getElementById("alertSymbolInput");
  const typeEl = document.getElementById("alertTypeSelect");
  const thEl = document.getElementById("alertThresholdInput");
  if (symEl) symEl.value = symbol;
  if (typeEl) typeEl.value = "price_target";
  if (thEl && target > 0) thEl.value = target;
  const condEl = document.getElementById("alertConditionSelect");
  if (condEl) {
    condEl.value = targetType === "sell_above" ? "gte" : "lte";
  }
  updateAlertFormUI();
}

let watchHintTimer = null;
let watchHintRequest = 0;

async function updateWatchlistFormHint() {
  const symInput = document.getElementById("watchSymbolInput");
  const hintEl = document.getElementById("watchLivePreview");
  if (!symInput || !hintEl) return;
  const raw = symInput.value.trim();
  const sym = resolveWatchlistSymbol(raw);
  if (!raw) {
    hintEl.textContent = "";
    return;
  }
  const mapped = sym !== raw.toUpperCase();
  let pr = prices[sym];
  if (pr && pr.ltp) {
    const dayChg = getDayChange(pr, pr.ltp);
    const chgStr = dayChg ? ` (${dayChg.pct >= 0 ? "+" : ""}${fmt(dayChg.pct, 2)}%)` : "";
    hintEl.innerHTML = `${mapped ? `<strong>${esc(raw)}</strong> → ` : ""}Live LTP for <strong>${esc(sym)}</strong>: Rs ${fmt(pr.ltp, 2)}${chgStr} · Sector: ${esc(getSector(sym))}`;
    return;
  }

  const requestId = ++watchHintRequest;
  hintEl.textContent = `${mapped ? `${raw} → ${sym} · ` : ""}Fetching live feed for ${sym}…`;
  clearTimeout(watchHintTimer);
  watchHintTimer = setTimeout(async () => {
    try {
      const result = await fetchOne(getWorkerUrl(), sym, 8000);
      if (requestId !== watchHintRequest) return;
      if (result && result.symbol && result.ltp != null) {
        prices[result.symbol] = result;
        pr = result;
        const dayChg = getDayChange(pr, pr.ltp);
        const chgStr = dayChg ? ` (${dayChg.pct >= 0 ? "+" : ""}${fmt(dayChg.pct, 2)}%)` : "";
        hintEl.innerHTML = `${mapped ? `<strong>${esc(raw)}</strong> → ` : ""}Live LTP for <strong>${esc(sym)}</strong>: Rs ${fmt(pr.ltp, 2)}${chgStr} · Sector: ${esc(getSector(sym))}`;
      } else {
        hintEl.textContent = `${mapped ? `${raw} → ${sym} · ` : ""}No live feed found for ${sym}.`;
      }
    } catch (err) {
      if (requestId === watchHintRequest) hintEl.textContent = `${mapped ? `${raw} → ${sym} · ` : ""}Live feed unavailable right now.`;
    }
  }, 350);
}


// Event Listeners for Watchlist Workspace
document.getElementById("addWatchlistBtn")?.addEventListener("click", addWatchlistFromForm);
document.getElementById("watchSymbolInput")?.addEventListener("input", updateWatchlistFormHint);
document.getElementById("watchSearchInput")?.addEventListener("input", (e) => {
  watchlistSearchQuery = e.target.value.trim();
  renderWatchlist();
});

document.querySelectorAll("[data-watch-filter]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-watch-filter]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    watchlistActiveFilter = btn.dataset.watchFilter;
    renderWatchlist();
  });
});

document.querySelectorAll(".watch-quick-pct").forEach(btn => {
  btn.addEventListener("click", () => {
    const symInput = document.getElementById("watchSymbolInput");
    const targetInput = document.getElementById("watchTargetPriceInput");
    const sym = resolveWatchlistSymbol(symInput?.value || "");
    const pct = Number(btn.dataset.pct) || 0;
    const pr = prices[sym];
    if (pr && pr.ltp) {
      const calcPrice = pr.ltp * (1 + pct / 100);
      if (targetInput) targetInput.value = calcPrice.toFixed(2);
    } else {
      appAlert({ title: "No Live Price", message: `Enter a valid symbol with live feed data to use quick percentage targets.` });
    }
  });
});

