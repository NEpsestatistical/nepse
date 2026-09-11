/* =========================================================
   Market-wide Top Performers — best/worst % return across the
   WHOLE NEPSE board (not just your holdings), over 1 Week / 1
   Month / 1 Year / All Time.

   Uses the same full-board snapshot as the Contribution
   Leaderboard (_marketCache from dashboard-market.js) for the
   "now" price, and the candle worker (same one chart_2.html uses)
   for each symbol's historical daily closes. Candle fetches are
   cached per-symbol in sessionStorage (1hr TTL) and run with
   limited concurrency so a ~300-500 symbol board doesn't fire
   hundreds of requests at once.
   ========================================================= */

const MKT_TOPPERF_CANDLE_URL = "https://nepsechart.bharatiaashish43.workers.dev";
const MKT_TOPPERF_CACHE_TTL_MS = 60 * 60 * 1000;
const MKT_TOPPERF_RANGE_DAYS = { "1w": 7, "1m": 30, "1y": 365 };
let _mktTopPerfRange = "1w";
let _mktTopPerfGainExpanded = false;
let _mktTopPerfLossExpanded = false;
let _mktCandleCache = {};

function mktCandleSessionKey(symbol) { return `mkt_candles_${symbol}`; }

function mktLoadCandlesFromSession(symbol) {
  try {
    const raw = sessionStorage.getItem(mktCandleSessionKey(symbol));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (Date.now() - parsed.ts) < MKT_TOPPERF_CACHE_TTL_MS) return parsed;
  } catch (e) {}
  return null;
}
function mktSaveCandlesToSession(symbol, entry) {
  try { sessionStorage.setItem(mktCandleSessionKey(symbol), JSON.stringify(entry)); } catch (e) {}
}

async function mktFetchSymbolCandles(symbol) {
  const mem = _mktCandleCache[symbol];
  if (mem && (Date.now() - mem.ts) < MKT_TOPPERF_CACHE_TTL_MS) return mem.candles;

  const cached = mktLoadCandlesFromSession(symbol);
  if (cached) { _mktCandleCache[symbol] = cached; return cached.candles; }

  try {
    const res = await fetch(`${MKT_TOPPERF_CANDLE_URL}/?symbol=${encodeURIComponent(symbol)}`);
    const data = await res.json();
    if (!res.ok || data.error || !data.candles || !data.candles.length) throw new Error(data.error || "No data");
    const entry = { candles: data.candles, ts: Date.now() };
    _mktCandleCache[symbol] = entry;
    mktSaveCandlesToSession(symbol, entry);
    return data.candles;
  } catch (e) {
    const entry = { candles: null, ts: Date.now() };
    _mktCandleCache[symbol] = entry;
    mktSaveCandlesToSession(symbol, entry);
    return null;
  }
}

// Limited-concurrency runner so a full board doesn't fire everything at once.
async function mktRunLimited(items, worker, concurrency = 6, staggerMs = 60) {
  const results = new Array(items.length);
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const i = next++;
      if (staggerMs) await new Promise((r) => setTimeout(r, staggerMs));
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return results;
}

function mktUnixToDateLabel(t) { return new Date(t * 1000).toISOString().slice(0, 10); }

function mktFindCandleNear(candles, targetUnix, toleranceDays = 6) {
  if (!candles || !candles.length) return null;
  let best = null;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].time <= targetUnix) { best = candles[i]; break; }
  }
  if (!best) return null;
  const diffDays = Math.abs(targetUnix - best.time) / 86400;
  if (diffDays > toleranceDays) return null;
  return best;
}

async function computeMktTopPerformers(rangeKey, board) {
  const isAllTime = rangeKey === "all";
  const rangeDays = MKT_TOPPERF_RANGE_DAYS[rangeKey];
  const targetUnix = isAllTime ? null : Math.floor(Date.now() / 1000) - rangeDays * 86400;

  const symbols = board.filter((r) => r.symbol && typeof r.ltp === "number").map((r) => r.symbol);
  const candleSets = await mktRunLimited(symbols, (sym) => mktFetchSymbolCandles(sym));

  const rows = [];
  board.forEach((r) => {
    if (!r.symbol || typeof r.ltp !== "number") return;
    const idx = symbols.indexOf(r.symbol);
    const candles = idx !== -1 ? candleSets[idx] : null;
    if (!candles) return;

    const past = isAllTime ? candles[0] : mktFindCandleNear(candles, targetUnix);
    if (!past || !(past.close > 0)) return;

    const pct = ((r.ltp - past.close) / past.close) * 100;
    rows.push({ symbol: r.symbol, sector: r.sector, ltp: r.ltp, pastPrice: past.close, pastDate: mktUnixToDateLabel(past.time), pct });
  });

  rows.sort((a, b) => b.pct - a.pct);
  return rows;
}

function mktRenderRows(list, expanded) {
  const shown = expanded ? list : list.slice(0, 10);
  return shown.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(r.symbol)}</td>
      <td class="${r.pct >= 0 ? "up" : "down"}">${mfmtSigned(r.pct, 2)}%</td>
      <td class="muted">Rs ${mfmt(r.pastPrice, 2)} (${escapeHtml(r.pastDate)}) → Rs ${mfmt(r.ltp, 2)}</td>
    </tr>`).join("");
}

let _mktTopPerfToken = 0;
async function renderMktTopPerformers() {
  const panel = document.getElementById("mktTopPerfPanel");
  if (!panel) return;

  const gainBody = document.querySelector("#mktTopPerfGainTable tbody");
  const lossBody = document.querySelector("#mktTopPerfLossTable tbody");
  const gainMoreBtn = document.getElementById("mktTopPerfGainMore");
  const lossMoreBtn = document.getElementById("mktTopPerfLossMore");
  const note = document.getElementById("mktTopPerfNote");

  if (!_marketCache.data) {
    const loadingMsg = `<tr><td colspan="4" class="loading">Waiting for market data…</td></tr>`;
    if (gainBody) gainBody.innerHTML = loadingMsg;
    if (lossBody) lossBody.innerHTML = loadingMsg;
    return;
  }

  const loadingMsg = `<tr><td colspan="4" class="loading">Loading historical prices for the board (this can take a moment)…</td></tr>`;
  if (gainBody) gainBody.innerHTML = loadingMsg;
  if (lossBody) lossBody.innerHTML = loadingMsg;

  const myToken = ++_mktTopPerfToken;
  const rows = await computeMktTopPerformers(_mktTopPerfRange, _marketCache.data.board);
  if (myToken !== _mktTopPerfToken) return;

  const gainers = rows.filter((r) => r.pct >= 0);
  const losers = rows.filter((r) => r.pct < 0).sort((a, b) => a.pct - b.pct);

  const paintSide = (list, body, moreBtn, expanded, sideLabel) => {
    if (!body) return;
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="4" class="loading">No ${sideLabel} with available history.</td></tr>`;
      if (moreBtn) moreBtn.style.display = "none";
      return;
    }
    body.innerHTML = mktRenderRows(list, expanded);
    if (moreBtn) {
      moreBtn.style.display = list.length > 10 ? "" : "none";
      moreBtn.textContent = expanded ? "Show top 10 only" : `Show all ${list.length}`;
    }
  };

  paintSide(gainers, gainBody, gainMoreBtn, _mktTopPerfGainExpanded, "gainers");
  paintSide(losers, lossBody, lossMoreBtn, _mktTopPerfLossExpanded, "losers");

  const rangeLabel = _mktTopPerfRange === "1w" ? "week" : _mktTopPerfRange === "1m" ? "month" : _mktTopPerfRange === "1y" ? "year" : "all-time (since earliest recorded candle)";
  if (note) {
    note.textContent = `Whole-board return over the last ${rangeLabel}, from the closest recorded daily candle to today's live LTP. ${rows.length} of ${_marketCache.data.board.length} board symbols had usable history this refresh.`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-mkt-topperf-range]").forEach((tab) => {
    tab.addEventListener("click", () => {
      _mktTopPerfRange = tab.getAttribute("data-mkt-topperf-range");
      document.querySelectorAll("[data-mkt-topperf-range]").forEach((t) => t.classList.toggle("active", t === tab));
      renderMktTopPerformers();
    });
  });
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "mktTopPerfGainMore") {
      _mktTopPerfGainExpanded = !_mktTopPerfGainExpanded;
      renderMktTopPerformers();
    } else if (e.target && e.target.id === "mktTopPerfLossMore") {
      _mktTopPerfLossExpanded = !_mktTopPerfLossExpanded;
      renderMktTopPerformers();
    }
  });

  // Wait for the board to load once (loadMarketDiscovery is called by dashboard-market.js's
  // own DOMContentLoaded listener), then do the first render. Poll briefly since script
  // load order doesn't guarantee _marketCache is populated yet.
  let tries = 0;
  const waitForBoard = setInterval(() => {
    tries++;
    if (_marketCache.data || tries > 100) {
      clearInterval(waitForBoard);
      renderMktTopPerformers();
    }
  }, 200);
});
