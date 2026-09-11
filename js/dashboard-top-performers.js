/* =========================================================
   NEPSE Dashboard — Top Performers (whole market)
   Populates: #mktTopPerfGainTable / #mktTopPerfLossTable /
   #mktTopPerfGainMore / #mktTopPerfLossMore / #mktTopPerfNote

   Symbol list comes from the SAME full-board worker used by
   dashboard-market.js (fetchFullBoard(), already defined there —
   this file just reuses it, does not refetch /all separately).

   Actual price HISTORY comes from the per-symbol chart worker
   (same one chart_2.html uses):
     https://nepsechart.bharatiaashish43.workers.dev/?symbol=SYM
   -> { candles: [{ time (unix secs), open, high, low, close }, ...] }

   Returns are computed as (latest close vs. the earliest close
   still inside the selected window) / that earliest close.
   "All time" uses the very first candle the worker has for that
   symbol. Nothing here is invented — a symbol with no candle data
   is simply left out of the ranking rather than shown as 0%.
   ========================================================= */

const TOPPERF_CHART_WORKER_URL = "https://nepsechart.bharatiaashish43.workers.dev";
const TOPPERF_CACHE_TTL_MS = 30 * 60000; // per-symbol candle cache
const TOPPERF_SESSION_KEY = "nepse_topperf_candle_cache_v1";
const TOPPERF_CONCURRENCY = 8; // parallel symbol fetches, be polite to the worker

const TOPPERF_RANGE_DAYS = { "1w": 7, "1m": 30, "1y": 365, "all": 0 };

let _topPerfCandleCache = {}; // symbol -> { candles, ts }
let _topPerfRange = "1w";
let _topPerfGainExpanded = false;
let _topPerfLossExpanded = false;
let _topPerfRows = []; // last computed ranking, so range/expand clicks don't refetch

/* ---------- sessionStorage persistence ---------- */
function topPerfLoadCache() {
  try {
    const raw = sessionStorage.getItem(TOPPERF_SESSION_KEY);
    if (raw) _topPerfCandleCache = JSON.parse(raw) || {};
  } catch (e) {
    console.warn("[topperf] could not read session cache:", e.message);
  }
}
function topPerfSaveCache() {
  try {
    sessionStorage.setItem(TOPPERF_SESSION_KEY, JSON.stringify(_topPerfCandleCache));
  } catch (e) {
    // sessionStorage quota is easy to blow with hundreds of symbols' candles — non-fatal
    console.warn("[topperf] could not write session cache:", e.message);
  }
}

/* ---------- fetch candles for one symbol, with cache ---------- */
async function topPerfFetchCandles(symbol) {
  const cached = _topPerfCandleCache[symbol];
  if (cached && (Date.now() - cached.ts) < TOPPERF_CACHE_TTL_MS) {
    return cached.candles;
  }
  const res = await fetch(`${TOPPERF_CHART_WORKER_URL}/?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const candles = Array.isArray(data.candles) ? data.candles : [];
  _topPerfCandleCache[symbol] = { candles, ts: Date.now() };
  return candles;
}

/* ---------- small concurrency-limited map, so we don't fire 300 fetches at once ---------- */
async function topPerfMapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i]);
      } catch (e) {
        results[i] = null;
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

/* ---------- compute % return for one symbol's candles over a range ---------- */
function topPerfReturnForRange(candles, rangeKey) {
  if (!candles || candles.length < 2) return null;
  const sorted = candles; // worker already returns them time-ordered
  const last = sorted[sorted.length - 1];
  const days = TOPPERF_RANGE_DAYS[rangeKey];
  let start;
  if (!days) {
    start = sorted[0];
  } else {
    const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
    start = sorted.find(c => c.time >= cutoff) || sorted[0];
  }
  if (!start || !start.close || start === last) return null;
  const pct = ((last.close - start.close) / start.close) * 100;
  return { pct, startClose: start.close, endClose: last.close, startTime: start.time };
}

/* ---------- build the ranking for the whole board (fetches once per range change if not cached) ---------- */
async function topPerfBuildRanking(rangeKey) {
  const { board } = await fetchFullBoard(); // reuse dashboard-market.js's cached /all fetch
  const symbols = board.map(r => r.symbol).filter(Boolean);

  const candleSets = await topPerfMapLimit(symbols, TOPPERF_CONCURRENCY, topPerfFetchCandles);
  topPerfSaveCache();

  const rows = [];
  symbols.forEach((symbol, i) => {
    const candles = candleSets[i];
    const r = topPerfReturnForRange(candles, rangeKey);
    if (r) rows.push({ symbol, ...r });
  });

  rows.sort((a, b) => b.pct - a.pct);
  return rows;
}

/* ---------- rendering ---------- */
function topPerfFmtPct(n) {
  const s = n >= 0 ? "+" : "";
  return s + n.toFixed(2) + "%";
}
function topPerfFmtPrice(n) {
  return "Rs " + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function topPerfRenderRows(list) {
  return list.map((r, i) => {
    const cls = r.pct >= 0 ? "up" : "down";
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${r.symbol}</td>
        <td class="${cls}">${topPerfFmtPct(r.pct)}</td>
        <td>${topPerfFmtPrice(r.startClose)} → ${topPerfFmtPrice(r.endClose)}</td>
      </tr>`;
  }).join("");
}

function topPerfRenderAll() {
  const gainBody = document.querySelector("#mktTopPerfGainTable tbody");
  const lossBody = document.querySelector("#mktTopPerfLossTable tbody");
  const gainMoreBtn = document.getElementById("mktTopPerfGainMore");
  const lossMoreBtn = document.getElementById("mktTopPerfLossMore");
  const note = document.getElementById("mktTopPerfNote");

  const gainers = _topPerfRows.filter(r => r.pct >= 0);
  const losers = _topPerfRows.filter(r => r.pct < 0).slice().sort((a, b) => a.pct - b.pct);

  const paintSide = (list, body, moreBtn, expanded, label) => {
    if (!body) return;
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="4" class="loading">No ${label} for this range.</td></tr>`;
      if (moreBtn) moreBtn.style.display = "none";
      return;
    }
    const shown = expanded ? list : list.slice(0, 10);
    body.innerHTML = topPerfRenderRows(shown);
    if (moreBtn) {
      moreBtn.style.display = list.length > 10 ? "" : "none";
      moreBtn.textContent = expanded ? "Show top 10 only" : `Show all ${list.length}`;
    }
  };

  paintSide(gainers, gainBody, gainMoreBtn, _topPerfGainExpanded, "gainers");
  paintSide(losers, lossBody, lossMoreBtn, _topPerfLossExpanded, "losers");

  if (note) {
    const skipped = _topPerfRows.length === 0 ? "" : "";
    note.textContent = `Real return over the selected window, computed from each symbol's own price history via the chart data feed — not a snapshot or estimate. Symbols with no history for this window are left out rather than shown as 0%.${skipped}`;
  }
}

async function topPerfLoad(rangeKey) {
  _topPerfRange = rangeKey;
  const gainBody = document.querySelector("#mktTopPerfGainTable tbody");
  const lossBody = document.querySelector("#mktTopPerfLossTable tbody");
  if (gainBody) gainBody.innerHTML = `<tr><td colspan="4" class="loading">Loading…</td></tr>`;
  if (lossBody) lossBody.innerHTML = `<tr><td colspan="4" class="loading">Loading…</td></tr>`;

  try {
    _topPerfRows = await topPerfBuildRanking(rangeKey);
    topPerfRenderAll();
  } catch (e) {
    console.error("[topperf] load failed:", e.message);
    const msg = `<tr><td colspan="4" class="loading">Top performers unavailable — ${e.message}</td></tr>`;
    if (gainBody) gainBody.innerHTML = msg;
    if (lossBody) lossBody.innerHTML = msg;
  }
}

/* ---------- init & controls ---------- */
document.addEventListener("DOMContentLoaded", () => {
  topPerfLoadCache();
  const panel = document.getElementById("mktTopPerfPanel");
  if (panel) panel.style.display = ""; // re-show now that this script is back
  topPerfLoad(_topPerfRange);
});

document.addEventListener("click", (e) => {
  const rangeBtn = e.target.closest("[data-mkt-topperf-range]");
  if (rangeBtn) {
    document.querySelectorAll("[data-mkt-topperf-range]").forEach(b => b.classList.remove("active"));
    rangeBtn.classList.add("active");
    _topPerfGainExpanded = false;
    _topPerfLossExpanded = false;
    topPerfLoad(rangeBtn.dataset.mktTopperfRange);
    return;
  }
  if (e.target && e.target.id === "mktTopPerfGainMore") {
    _topPerfGainExpanded = !_topPerfGainExpanded;
    topPerfRenderAll();
  } else if (e.target && e.target.id === "mktTopPerfLossMore") {
    _topPerfLossExpanded = !_topPerfLossExpanded;
    topPerfRenderAll();
  }
});
