/* =========================================================
   NEPSE Dashboard — full-market discovery layer
   Populates: #pulseBreadth/#pulseFillUp/#pulseFillDown/#pulseVerdict,
   #gainersTable, #losersTable, #moversTable, #sectorTable

   Uses the SAME worker as dashboard.js (single-symbol quotes) but hits
   its /all endpoint for the full board in one call. Does NOT touch
   WORKER_URL, portfolio storage, or anything in dashboard.js.

   INDEX POINTS — how they're computed, and the honesty limits:
   The worker's /all also returns `index: { date, value, pointChange,
   percentChange }` — the OFFICIAL NEPSE point change, scraped from
   merolagani's real daily index table. That table only updates once a
   trading day fully closes, so during live market hours this is the
   most recently closed day's point change, not a live tick — labeled
   as such in the UI.

   Individual stocks don't come with an official per-stock point-
   contribution figure (that requires float-adjusted market-cap weights,
   which NEPSE doesn't publish). So each stock's point figure is: its
   share of total market impact, signed to match its OWN direction,
   scaled to the magnitude of the real index point change:

     pointsContribution_i = sign(impact_i) * (|impact_i| / totalAbsImpact) * |index.pointChange|

   IMPACT WEIGHTING — market cap, not turnover:
   impact_i should be changeAmount_i x totalListedShares_i (i.e. the
   change in that company's market value), NOT changeAmount_i x qtyTraded_i
   (that's turnover / money-flow, and previously was the only option this
   file computed — a bug). totalListedShares comes from a second worker
   (see worker/shares-worker.js) that scrapes each company's total listed
   shares (tradeable + non-tradeable/promoter). Configure its URL in
   SHARES_WORKER_URL below. Per symbol, if listed-share data isn't
   available, that symbol alone falls back to the old turnover proxy
   (changeAmount x qty) rather than being dropped — and every place this
   shows up in the UI says which basis was actually used
   (contributionBasisNote()). With SHARES_WORKER_URL unset, the whole
   board runs on the turnover proxy exactly as before.

   This means a rising stock always shows positive points and a falling
   stock always shows negative points — sized by its share of the day's
   total market-cap-weighted impact — and the magnitudes are anchored to
   the real NEPSE point move, not an invented number. It is still an
   apportionment model, not NEPSE's own weighting, and is labeled as such.

   CHANGES IN THIS VERSION:
   1. Market Pulse — total gainer-side contribution vs total loser-side
      contribution (impact-weighted, not just a headcount), with a
      visual bar and a plain-language verdict on who's leading the tape.
   2. Contribution Leaderboard — the old "movers" table (previously
      capped to the top 10) now lists every board symbol with a valid
      impact figure, ranked by contribution magnitude, highest first.
   3. Sector table now ranks by contribution MAGNITUDE (biggest mover,
      whichever direction, first) instead of most-negative-first.
   4. Carried over from the previous update: dedupe by symbol, HTML
      escaping on all scraped strings, retry/backoff on repeated fetch
      failures, and sessionStorage caching so a reload isn't blank.
   ========================================================= */

const MARKET_WORKER_URL = "https://shiny-term-f599.bharatiaashish43.workers.dev";
const MARKET_CACHE_TTL_MS = 45000;
const MARKET_BACKOFF_TTL_MS = 5 * 60000; // after repeated failures, stop hammering the worker for this long
const MARKET_MAX_CONSECUTIVE_FAILS = 3;
const MARKET_SESSION_KEY = "nepse_market_cache_v1";

// Separate worker that serves { shares: { SYMBOL: totalListedShares, ... } }
// (tradeable + non-tradeable/promoter — the same share count NEPSE's own
// market cap is built from). See worker/shares-worker.js + worker/README.md.
// PASTE YOUR DEPLOYED WORKER URL HERE — until it's set, contribution silently
// falls back to the old turnover-weighted (price change x qty traded) proxy.
const SHARES_WORKER_URL = "https://nepse-share.bharatiaashish43.workers.dev";
const SHARES_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 24h upstream; refetch client cache every 12h
const SHARES_SESSION_KEY = "nepse_shares_cache_v1";

let _marketCache = { data: null, ts: 0 };
let _marketFailCount = 0;
let _sharesCache = { data: null, ts: 0 }; // { data: { SYMBOL: listedShares }, ts }

/* ---------- Formatting helpers ---------- */
function mfmt(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function mfmtSigned(n, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = Number(n) >= 0 ? "+" : "";
  return s + mfmt(n, d);
}

// Nepali market-value convention: Lakh (1e5), Crore (1e7), Arab (1e9) — a raw
// rupee figure with commas is unreadable at NEPSE's typical daily turnover size.
function mfmtRs(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}Rs ${mfmt(abs / 1e9, 2)} Arab`;
  if (abs >= 1e7) return `${sign}Rs ${mfmt(abs / 1e7, 2)} Crore`;
  if (abs >= 1e5) return `${sign}Rs ${mfmt(abs / 1e5, 2)} Lakh`;
  return `${sign}Rs ${mfmt(abs, 0)}`;
}

// All scraped text (symbol, sector, drags list) must go through this before
// touching innerHTML — it's third-party data, not something we control.
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- sessionStorage persistence, so a reload isn't a blank slate ---------- */
function loadCacheFromSession() {
  try {
    const raw = sessionStorage.getItem(MARKET_SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data && parsed.ts) {
      _marketCache = parsed;
    }
  } catch (e) {
    console.warn("[market] could not read session cache:", e.message);
  }
}

function saveCacheToSession() {
  try {
    sessionStorage.setItem(MARKET_SESSION_KEY, JSON.stringify(_marketCache));
  } catch (e) {
    console.warn("[market] could not write session cache:", e.message);
  }
}

/* ---------- Fetch the full board (+ index summary) from the worker's /all endpoint ---------- */
async function fetchFullBoard(force) {
  const effectiveTtl = _marketFailCount >= MARKET_MAX_CONSECUTIVE_FAILS
    ? MARKET_BACKOFF_TTL_MS
    : MARKET_CACHE_TTL_MS;

  if (!force && _marketCache.data && (Date.now() - _marketCache.ts) < effectiveTtl) {
    return _marketCache.data;
  }

  try {
    const res = await fetch(`${MARKET_WORKER_URL}/all`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const rawBoard = Array.isArray(json.board) ? json.board : [];

    const seen = new Set();
    const board = rawBoard.filter(r => {
      if (!r.symbol || seen.has(r.symbol)) return false;
      seen.add(r.symbol);
      return true;
    });

    const index = json.index || null; // { date, value, pointChange, percentChange } | null

    _marketCache = { data: { board, index }, ts: Date.now() };
    _marketFailCount = 0;
    saveCacheToSession();
    return _marketCache.data;
  } catch (e) {
    _marketFailCount += 1;
    console.error(`[market] fetch failed (consecutive fail #${_marketFailCount}):`, e.message);
    if (_marketCache.data) {
      return _marketCache.data;
    }
    throw e;
  }
}

/* ---------- Listed shares (for real market-cap-weighted contribution) ---------- */
async function fetchListedShares(force) {
  if (!SHARES_WORKER_URL) return null; // not configured yet — caller falls back to turnover proxy

  if (!force && _sharesCache.data && (Date.now() - _sharesCache.ts) < SHARES_CACHE_TTL_MS) {
    return _sharesCache.data;
  }

  if (!_sharesCache.data) {
    try {
      const raw = sessionStorage.getItem(SHARES_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && parsed.ts) _sharesCache = parsed;
      }
    } catch (e) {
      console.warn("[market] could not read shares session cache:", e.message);
    }
    if (!force && _sharesCache.data && (Date.now() - _sharesCache.ts) < SHARES_CACHE_TTL_MS) {
      return _sharesCache.data;
    }
  }

  try {
    const res = await fetch(`${SHARES_WORKER_URL}/shares`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const shares = json && json.shares ? json.shares : null;
    if (!shares) throw new Error("worker response missing 'shares'");

    _sharesCache = { data: shares, ts: Date.now() };
    try {
      sessionStorage.setItem(SHARES_SESSION_KEY, JSON.stringify(_sharesCache));
    } catch (e) {
      console.warn("[market] could not write shares session cache:", e.message);
    }
    return shares;
  } catch (e) {
    console.error("[market] listed-shares fetch failed, falling back to turnover proxy:", e.message);
    return _sharesCache.data || null; // stale cache beats nothing; null beats a wrong number
  }
}

/* ---------- Impact: market-cap-weighted (changeAmount x totalListedShares) when shares data
   is available, otherwise a turnover-weighted fallback (changeAmount x qty traded) which is
   labeled as such wherever it's shown, since it measures money-flow, not market-cap impact. ---------- */
function computeImpact(board, index, sharesMap) {
  const hasShares = !!(sharesMap && Object.keys(sharesMap).length);

  const rows = board
    .filter(r => r.symbol && r.percentChange !== null && r.percentChange !== undefined)
    .map(r => {
      const changeAmount = r.changeAmount !== null && r.changeAmount !== undefined
        ? Number(r.changeAmount)
        : null;

      const listedShares = hasShares && sharesMap[r.symbol] !== undefined
        ? Number(sharesMap[r.symbol])
        : null;
      const qty = r.qty !== null && r.qty !== undefined ? Number(r.qty) : null;

      // Prefer real market-cap weighting (total listed shares, tradeable + non-tradeable).
      // Only fall back to the turnover proxy (traded qty) for a symbol if its listed-share
      // count isn't available, so partial shares-data coverage doesn't wreck the whole board.
      const usedProxy = !(listedShares !== null && !Number.isNaN(listedShares));
      const weight = usedProxy ? qty : listedShares;

      const impact = (changeAmount !== null && weight !== null && !Number.isNaN(changeAmount) && !Number.isNaN(weight))
        ? changeAmount * weight
        : null;
      return { ...r, impact, usedProxy };
    });

  const totalAbsImpact = rows.reduce((s, r) => s + (r.impact !== null ? Math.abs(r.impact) : 0), 0);
  const indexPointChange = index && !Number.isNaN(index.pointChange) ? Number(index.pointChange) : null;

  return rows.map(r => {
    const contributionPct = (r.impact !== null && totalAbsImpact > 0) ? (r.impact / totalAbsImpact) * 100 : null;
    const pointsContribution = (r.impact !== null && totalAbsImpact > 0 && indexPointChange !== null)
      ? Math.sign(r.impact) * (Math.abs(r.impact) / totalAbsImpact) * Math.abs(indexPointChange)
      : null;
    return { ...r, contributionPct, pointsContribution };
  });
}

/* ---------- Describes which weighting basis was actually used for a set of rows,
   since coverage of the shares worker can be partial (a new/renamed symbol not yet
   scraped) or entirely absent (SHARES_WORKER_URL not configured). ---------- */
function contributionBasisNote(rows) {
  const withImpact = rows.filter(r => r.impact !== null);
  if (!withImpact.length) return "";
  const proxyCount = withImpact.filter(r => r.usedProxy).length;
  if (proxyCount === 0) return " Weighted by each company's total listed shares (market cap), not turnover.";
  if (proxyCount === withImpact.length) return " Weighted by traded turnover (price change × qty) — listed-share data unavailable this refresh, so this is a money-flow proxy, not market cap.";
  return ` Weighted by total listed shares (market cap) where available; ${proxyCount} of ${withImpact.length} symbols fell back to a turnover proxy (listed-share data missing for them).`;
}

/* ---------- Turnover: actual traded value (ltp x qty) — separate from, and not to
   be confused with, the market-cap-weighted contribution above. This is real
   money-flow, not an index-impact figure. ---------- */
function computeTurnover(board) {
  return board
    .filter(r => r.symbol)
    .map(r => {
      const ltp = r.ltp !== null && r.ltp !== undefined ? Number(r.ltp) : null;
      const qty = r.qty !== null && r.qty !== undefined ? Number(r.qty) : null;
      const turnoverValue = (ltp !== null && qty !== null && !Number.isNaN(ltp) && !Number.isNaN(qty))
        ? ltp * qty
        : null;
      return { ...r, turnoverValue };
    });
}

function renderTurnover(board) {
  const totalEl = document.getElementById("turnoverTotal");
  const noteEl = document.getElementById("turnoverNote");
  const body = document.querySelector("#turnoverTable tbody");

  const rows = computeTurnover(board).filter(r => r.turnoverValue !== null);
  const total = rows.reduce((s, r) => s + r.turnoverValue, 0);

  if (totalEl) {
    totalEl.textContent = rows.length ? mfmtRs(total) : "—";
  }
  if (noteEl) {
    noteEl.textContent = rows.length
      ? `Estimated from LTP × traded quantity per symbol, summed across ${rows.length} symbols — an approximation of NEPSE's official turnover figure, not a scrape of it.`
      : "Turnover data unavailable — check the worker's ltp/qty fields.";
  }

  if (!body) return;
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="3" class="loading">Turnover data unavailable.</td></tr>`;
    return;
  }

  const top = rows.slice().sort((a, b) => b.turnoverValue - a.turnoverValue).slice(0, 10);
  body.innerHTML = top.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.symbol)}</td>
        <td>${mfmtRs(r.turnoverValue)}</td>
      </tr>`).join("");
}

/* ---------- Market Pulse: impact-weighted gainers vs losers verdict ---------- */
function renderMarketPulse(rows, index) {
  const hasPoints = index && !Number.isNaN(index.pointChange);

  const rising = rows.filter(r => r.percentChange > 0);
  const falling = rows.filter(r => r.percentChange < 0);
  const flat = rows.filter(r => r.percentChange === 0);

  const contribValue = r => hasPoints ? (r.pointsContribution || 0) : (r.contributionPct || 0);

  const upImpact = rows
    .filter(r => r.impact !== null && r.impact > 0)
    .reduce((s, r) => s + contribValue(r), 0);
  const downImpact = Math.abs(rows
    .filter(r => r.impact !== null && r.impact < 0)
    .reduce((s, r) => s + contribValue(r), 0));

  const totalImpact = upImpact + downImpact;
  const upShare = totalImpact > 0 ? (upImpact / totalImpact) * 100 : 50;
  const downShare = 100 - upShare;

  const breadthEl = document.getElementById("pulseBreadth");
  const barUp = document.getElementById("pulseFillUp");
  const barDown = document.getElementById("pulseFillDown");
  const verdictEl = document.getElementById("pulseVerdict");

  if (breadthEl) {
    breadthEl.innerHTML = `<span class="up">${rising.length} rising</span> &nbsp;·&nbsp; <span class="down">${falling.length} falling</span> &nbsp;·&nbsp; <span>${flat.length} unchanged</span>`;
  }
  if (barUp) barUp.style.width = `${upShare.toFixed(1)}%`;
  if (barDown) barDown.style.width = `${downShare.toFixed(1)}%`;

  if (verdictEl) {
    const unit = hasPoints ? "pts" : "% of total move";
    const upText = mfmt(upImpact, 1);
    const downText = mfmt(downImpact, 1);

    let lead;
    if (totalImpact === 0) {
      lead = "No net movement to compare yet.";
    } else if (Math.abs(upImpact - downImpact) < (totalImpact * 0.01)) {
      lead = "Gainers and losers are roughly evenly matched right now.";
    } else if (upImpact > downImpact) {
      lead = "Gainers are currently leading the tape.";
    } else {
      lead = "Losers are currently leading the tape.";
    }

    const sourceNote = hasPoints
      ? ` (apportioned from NEPSE's ${index.date} close-to-close change — not live-updating intraday)`
      : " (impact share — official NEPSE points unavailable this refresh)";

    verdictEl.textContent = `${lead} Gainers: +${upText} ${unit} · Losers: -${downText} ${unit}${sourceNote}.${contributionBasisNote(rows)}`;
  }
}

/* ---------- Gainers / Losers (top 10 by % change — unchanged) ---------- */
function renderGainersLosers(rows) {
  const ranked = rows.filter(r => r.percentChange !== null).slice().sort((a, b) => b.percentChange - a.percentChange);
  const gainers = ranked.filter(r => r.percentChange > 0).slice(0, 10);
  const losers = ranked.filter(r => r.percentChange < 0).slice(-10).reverse();

  const gainersBody = document.querySelector("#gainersTable tbody");
  const losersBody = document.querySelector("#losersTable tbody");

  gainersBody.innerHTML = gainers.length
    ? gainers.map(r => `
        <tr>
          <td>${escapeHtml(r.symbol)}</td>
          <td>Rs ${mfmt(r.ltp)}</td>
          <td class="up">${mfmtSigned(r.percentChange)}%</td>
        </tr>`).join("")
    : `<tr><td colspan="3" class="loading">No gainers today.</td></tr>`;

  losersBody.innerHTML = losers.length
    ? losers.map(r => `
        <tr>
          <td>${escapeHtml(r.symbol)}</td>
          <td>Rs ${mfmt(r.ltp)}</td>
          <td class="down">${mfmtSigned(r.percentChange)}%</td>
        </tr>`).join("")
    : `<tr><td colspan="3" class="loading">No losers today.</td></tr>`;
}

/* ---------- Contribution Leaderboard: split green/red, top 10 each with expand-to-all ---------- */
let _moversGainExpanded = false;
let _moversLossExpanded = false;

function renderMoverRows(list, hasPoints) {
  return list.map((r, i) => {
    const cls = r.impact >= 0 ? "up" : "down";
    const contribText = hasPoints
      ? `${mfmtSigned(r.pointsContribution, 2)} pts`
      : `${mfmtSigned(r.contributionPct, 2)}%`;
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.symbol)}</td>
        <td class="${cls}">${mfmtSigned(r.percentChange)}%</td>
        <td class="${cls}">${contribText}</td>
      </tr>`;
  }).join("");
}

function renderMovers(rows, index) {
  const gainBody = document.querySelector("#moversGainTable tbody");
  const lossBody = document.querySelector("#moversLossTable tbody");
  const gainMoreBtn = document.getElementById("moversGainMore");
  const lossMoreBtn = document.getElementById("moversLossMore");
  const note = document.getElementById("moversNote");

  const hasPoints = index && !Number.isNaN(index.pointChange);

  const ranked = rows
    .filter(r => r.impact !== null)
    .slice()
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const gainers = ranked.filter(r => r.impact >= 0);
  const losers = ranked.filter(r => r.impact < 0);

  if (!ranked.length) {
    const emptyMsg = `<tr><td colspan="4" class="loading">Turnover data unavailable — check the worker's qty field.</td></tr>`;
    if (gainBody) gainBody.innerHTML = emptyMsg;
    if (lossBody) lossBody.innerHTML = emptyMsg;
    if (note) note.textContent = "";
    if (gainMoreBtn) gainMoreBtn.style.display = "none";
    if (lossMoreBtn) lossMoreBtn.style.display = "none";
    return;
  }

  const paintSide = (list, body, moreBtn, expanded, sideLabel) => {
    if (!body) return;
    if (!list.length) {
      body.innerHTML = `<tr><td colspan="4" class="loading">No ${sideLabel} today.</td></tr>`;
      if (moreBtn) moreBtn.style.display = "none";
      return;
    }
    const shown = expanded ? list : list.slice(0, 10);
    body.innerHTML = renderMoverRows(shown, hasPoints);
    if (moreBtn) {
      moreBtn.style.display = list.length > 10 ? "" : "none";
      moreBtn.textContent = expanded ? "Show top 10 only" : `Show all ${list.length}`;
    }
  };

  paintSide(gainers, gainBody, gainMoreBtn, _moversGainExpanded, "gainers");
  paintSide(losers, lossBody, lossMoreBtn, _moversLossExpanded, "losers");

  if (note) {
    const base = hasPoints
      ? `Ranked by apportioned share of NEPSE's official close-to-close change on ${index.date} (${mfmtSigned(index.pointChange)} pts) — highest contribution first within each side. Not NEPSE's own float-adjusted weighting, and not live-updating intraday.`
      : `Ranked by impact share of total market movement — highest first within each side. Official NEPSE point figure wasn't available this refresh.`;
    note.textContent = base + contributionBasisNote(rows);
  }
}

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "moversGainMore") {
    _moversGainExpanded = !_moversGainExpanded;
    if (_marketCache.data) renderMovers(computeImpact(_marketCache.data.board, _marketCache.data.index, _sharesCache.data), _marketCache.data.index);
  } else if (e.target && e.target.id === "moversLossMore") {
    _moversLossExpanded = !_moversLossExpanded;
    if (_marketCache.data) renderMovers(computeImpact(_marketCache.data.board, _marketCache.data.index, _sharesCache.data), _marketCache.data.index);
  }
});

/* ---------- Sector impact: ranked by contribution MAGNITUDE, highest first ---------- */
function renderSectors(rows, index) {
  const body = document.querySelector("#sectorTable tbody");
  const note = document.getElementById("sectorNote");
  const hasPoints = index && !Number.isNaN(index.pointChange);

  const bySector = {};
  rows.forEach(r => {
    const sec = r.sector || "Others";
    if (!bySector[sec]) bySector[sec] = [];
    bySector[sec].push(r);
  });

  const sectorRows = Object.keys(bySector).map(sector => {
    const list = bySector[sector];
    const withChange = list.filter(r => r.percentChange !== null);
    const avgChange = withChange.length
      ? withChange.reduce((s, r) => s + r.percentChange, 0) / withChange.length
      : null;
    const falling = withChange.filter(r => r.percentChange < 0).length;
    const total = withChange.length;
    const contributionPct = list.reduce((s, r) => s + (r.contributionPct || 0), 0);
    const pointsContribution = list.reduce((s, r) => s + (r.pointsContribution || 0), 0);
    const drags = list
      .filter(r => r.impact !== null && r.impact < 0)
      .sort((a, b) => a.impact - b.impact)
      .slice(0, 2)
      .map(r => `${escapeHtml(r.symbol)} (${mfmtSigned(r.percentChange)}%)`)
      .join(", ") || "—";

    return { sector, avgChange, falling, total, contributionPct, pointsContribution, drags };
  }).filter(s => s.total > 0)
    .sort((a, b) => {
      const av = Math.abs(hasPoints ? a.pointsContribution : a.contributionPct);
      const bv = Math.abs(hasPoints ? b.pointsContribution : b.contributionPct);
      return bv - av; // biggest mover first, whichever direction
    });

  if (!sectorRows.length) {
    body.innerHTML = `<tr><td colspan="6" class="loading">Sector data unavailable.</td></tr>`;
    if (note) note.textContent = "";
    return;
  }

  body.innerHTML = sectorRows.map((s, i) => {
    const cls = s.avgChange === null ? "" : (s.avgChange >= 0 ? "up" : "down");
    const contribVal = hasPoints ? s.pointsContribution : s.contributionPct;
    const contribCls = contribVal >= 0 ? "up" : "down";
    const contribText = hasPoints ? `${mfmtSigned(s.pointsContribution, 2)} pts` : `${mfmtSigned(s.contributionPct, 2)}%`;
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(s.sector)}</td>
        <td class="${cls}">${mfmtSigned(s.avgChange)}%</td>
        <td>${s.falling}/${s.total} falling</td>
        <td class="${contribCls}">${contribText}</td>
        <td>${s.drags}</td>
      </tr>`;
  }).join("");

  if (note) {
    const base = hasPoints
      ? `Sectors ranked by total contribution magnitude (sum of each constituent's apportioned share of NEPSE's ${index.date} close-to-close change), biggest mover first — whichever direction.`
      : "Sectors ranked by total contribution magnitude, biggest mover first — whichever direction.";
    note.textContent = base + contributionBasisNote(rows);
  }
}

/* ---------- init ---------- */
function renderAll(board, index) {
  const rows = computeImpact(board, index, _sharesCache.data);
  renderMarketPulse(rows, index);
  renderTurnover(board);
  renderGainersLosers(rows);
  renderMovers(rows, index);
  renderSectors(rows, index);
}

async function loadMarketDiscovery(force) {
  try {
    const [{ board, index }] = await Promise.all([
      fetchFullBoard(force),
      fetchListedShares(force), // populates _sharesCache; renderAll reads it
    ]);
    if (!board.length) throw new Error("Empty board");
    renderAll(board, index);
  } catch (e) {
    console.error("[market] discovery load failed:", e.message);
    const pb = document.getElementById("pulseBreadth");
    const pv = document.getElementById("pulseVerdict");
    const gb = document.querySelector("#gainersTable tbody");
    const lb = document.querySelector("#losersTable tbody");
    const mgb = document.querySelector("#moversGainTable tbody");
    const mlb = document.querySelector("#moversLossTable tbody");
    const sb = document.querySelector("#sectorTable tbody");
    const tt = document.getElementById("turnoverTotal");
    const tb = document.querySelector("#turnoverTable tbody");
    if (pb) pb.textContent = "Data unavailable.";
    if (pv) pv.textContent = "";
    if (gb) gb.innerHTML = `<tr><td colspan="3" class="loading">Data unavailable.</td></tr>`;
    if (lb) lb.innerHTML = `<tr><td colspan="3" class="loading">Data unavailable.</td></tr>`;
    if (mgb) mgb.innerHTML = `<tr><td colspan="4" class="loading">Market data unavailable — ${escapeHtml(e.message)}</td></tr>`;
    if (mlb) mlb.innerHTML = `<tr><td colspan="4" class="loading">Market data unavailable — ${escapeHtml(e.message)}</td></tr>`;
    if (sb) sb.innerHTML = `<tr><td colspan="6" class="loading">Market data unavailable — ${escapeHtml(e.message)}</td></tr>`;
    if (tt) tt.textContent = "—";
    if (tb) tb.innerHTML = `<tr><td colspan="3" class="loading">Market data unavailable — ${escapeHtml(e.message)}</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadCacheFromSession();
  fetchListedShares(); // async; populates _sharesCache from session storage/worker for next render
  if (_marketCache.data) {
    try {
      renderAll(_marketCache.data.board, _marketCache.data.index);
    } catch (e) {
      console.warn("[market] failed to paint cached data:", e.message);
    }
  }
  loadMarketDiscovery();
});
