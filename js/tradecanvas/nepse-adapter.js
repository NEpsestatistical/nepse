/* =========================================================
   TCN — nepse-adapter.js
   Converts the site's REAL Cloudflare Worker responses into the
   shapes TradeCanvas expects. Nothing here invents candles, prices
   or symbols: failures are surfaced, never papered over.

   - Candles : GET {CANDLE_WORKER_URL}/?symbol=SYM  (daily OHLC)
               unix-seconds -> ms (TradeCanvas wants ms); malformed rows dropped.
               The worker returns the whole series in one response, so
               "pagination" (scroll-back) is served from that cached series.
               1W / 1M are aggregated by TradeCanvas from the real daily bars.
   - Board   : GET {BOARD_WORKER_URL}/all -> symbol search + quotes.
   ========================================================= */
(function (global) {
  "use strict";
  const CFG = global.TCN_CONFIG;
  const TC = global.TradeCanvas;

  const listeners = new Set(); // status listeners: ({kind, state, message})
  function emitStatus(kind, state, message) {
    listeners.forEach((fn) => { try { fn({ kind, state, message: message || "" }); } catch (e) { /* ignore */ } });
  }

  async function fetchJson(url) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), CFG.REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctl.signal, cache: "no-store" });
      let body = null;
      try { body = await res.json(); } catch (e) { body = null; }
      if (!res.ok) throw new Error((body && body.error) || "HTTP " + res.status);
      if (body === null) throw new Error("The feed returned an unreadable (non-JSON) response.");
      if (body.error) throw new Error(String(body.error));
      return body;
    } catch (e) {
      if (e && e.name === "AbortError") throw new Error("Request timed out. Check your connection or the market feed.");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));

  /* ---------------- Board (symbols + quotes) ---------------- */
  let board = { rows: [], index: null, ts: 0 };
  let boardInflight = null;

  async function fetchBoard(force) {
    if (!force && board.rows.length && Date.now() - board.ts < CFG.BOARD_TTL_MS) return board;
    if (boardInflight) return boardInflight;
    boardInflight = (async () => {
      try {
        const json = await fetchJson(CFG.BOARD_WORKER_URL + "/all");
        const raw = Array.isArray(json.board) ? json.board : [];
        const seen = new Set();
        const rows = [];
        raw.forEach((r) => {
          if (!r || typeof r.symbol !== "string" || !r.symbol.trim()) return;
          const symbol = r.symbol.trim().toUpperCase();
          if (seen.has(symbol)) return;
          seen.add(symbol);
          rows.push(Object.assign({}, r, { symbol }));
        });
        if (!rows.length) throw new Error("The market board came back empty.");
        board = { rows, index: json.index || null, ts: Date.now() };
        emitStatus("board", "ok");
        return board;
      } catch (e) {
        emitStatus("board", "error", e.message);
        if (board.rows.length) return board; // stale beats nothing; status already flagged
        throw e;
      } finally {
        boardInflight = null;
      }
    })();
    return boardInflight;
  }

  function toSymbolInfo(r) {
    return {
      symbol: r.symbol,
      description: r.name || r.companyName || undefined,
      exchange: "NEPSE",
      type: "stock",
      pricePrecision: 2,
    };
  }

  async function searchSymbols(query) {
    const b = await fetchBoard(false);
    const q = String(query || "").trim().toUpperCase();
    let rows = b.rows;
    if (q) {
      rows = rows
        .map((r) => {
          const sym = r.symbol, name = String(r.name || r.companyName || "").toUpperCase();
          const score = sym === q ? 0 : sym.startsWith(q) ? 1 : sym.includes(q) ? 2 : name.includes(q) ? 3 : -1;
          return { r, score };
        })
        .filter((x) => x.score >= 0)
        .sort((a, b2) => a.score - b2.score || a.r.symbol.localeCompare(b2.r.symbol))
        .map((x) => x.r);
    }
    return rows.slice(0, 50).map(toSymbolInfo);
  }

  async function resolveSymbol(symbol) {
    try {
      const b = await fetchBoard(false);
      const row = b.rows.find((r) => r.symbol === String(symbol).toUpperCase());
      return row ? toSymbolInfo(row) : null;
    } catch (e) {
      return null;
    }
  }

  function quoteFor(symbol) {
    const row = board.rows.find((r) => r.symbol === String(symbol).toUpperCase());
    if (!row) return null;
    const ltp = num(row.ltp), pct = num(row.percentChange);
    return {
      symbol: row.symbol,
      name: row.name || row.companyName || "",
      sector: row.sector || "",
      ltp: isFinite(ltp) ? ltp : null,
      percentChange: isFinite(pct) ? pct : null,
      // previous close derived from the two real numbers above (not invented)
      prevClose: isFinite(ltp) && isFinite(pct) && pct > -100 ? ltp / (1 + pct / 100) : null,
      qty: isFinite(num(row.qty)) ? num(row.qty) : null,
      row,
    };
  }

  /* ---------------- Candles ---------------- */
  const candleCache = new Map(); // symbol -> { bars, hasVolume, ts }
  const candleInflight = new Map();

  function normalizeCandles(raw) {
    const out = [];
    const seen = new Set();
    let anyVol = false;
    raw.forEach((c) => {
      if (!c) return;
      let t = num(c.time);
      const o = num(c.open), h = num(c.high), l = num(c.low), cl = num(c.close);
      if (![t, o, h, l, cl].every(isFinite)) return;
      if (t < 1e11) t = t * 1000; // seconds -> ms
      if (seen.has(t)) return;
      seen.add(t);
      const v = num(c.volume);
      if (isFinite(v) && v > 0) anyVol = true;
      out.push({ time: t, open: o, high: Math.max(h, o, cl), low: Math.min(l, o, cl), close: cl, volume: isFinite(v) && v > 0 ? v : 0 });
    });
    out.sort((a, b) => a.time - b.time);
    return { bars: out, hasVolume: anyVol };
  }

  async function loadSeries(symbol, maxAgeMs) {
    const sym = String(symbol).toUpperCase();
    const cached = candleCache.get(sym);
    if (cached && Date.now() - cached.ts < maxAgeMs) return cached;
    if (candleInflight.has(sym)) return candleInflight.get(sym);
    const p = (async () => {
      emitStatus("candles", "loading");
      try {
        const json = await fetchJson(CFG.CANDLE_WORKER_URL + "/?symbol=" + encodeURIComponent(sym));
        if (!Array.isArray(json.candles) || !json.candles.length) throw new Error("No price history is available for " + sym + ".");
        const norm = normalizeCandles(json.candles);
        if (!norm.bars.length) throw new Error("Price history for " + sym + " was malformed (no valid candles).");
        const entry = { bars: norm.bars, hasVolume: norm.hasVolume, ts: Date.now() };
        candleCache.set(sym, entry);
        emitStatus("candles", "ok");
        return entry;
      } catch (e) {
        emitStatus("candles", "error", e.message);
        if (cached) return cached; // keep showing the last good series
        throw e;
      } finally {
        candleInflight.delete(sym);
      }
    })();
    candleInflight.set(sym, p);
    return p;
  }

  function create() {
    return new TC.PollingAdapter({
      name: "nepse-worker",
      supportedTimeframes: ["1d"],
      intervalMs: CFG.POLL_INTERVAL_MS,
      pollLimit: 2,
      defaultHistoryLimit: 5000,
      // limit>=100 => initial history (reuse cache); small limit => poll (refresh if stale)
      fetchBars: async (symbol, _tf, limit) => {
        const entry = await loadSeries(symbol, limit >= 100 ? CFG.CANDLE_TTL_MS : CFG.POLL_INTERVAL_MS - 1000);
        return entry.bars.slice(-Math.max(1, limit));
      },
      fetchHistoryBefore: async (symbol, _tf, before, limit) => {
        const entry = await loadSeries(symbol, CFG.CANDLE_TTL_MS * 5);
        const older = entry.bars.filter((b) => b.time < before);
        return older.slice(-limit);
      },
      searchSymbols,
      resolveSymbol,
    });
  }

  global.TCN_FEED = {
    create, fetchBoard, searchSymbols, resolveSymbol, quoteFor, loadSeries,
    // previous daily close from the loaded candle series (real data), for the active symbol's % change
    prevClose: (symbol) => { const e = candleCache.get(String(symbol).toUpperCase()); return e && e.bars.length > 1 ? e.bars[e.bars.length - 2].close : null; },
    hasVolume: (symbol) => { const e = candleCache.get(String(symbol).toUpperCase()); return e ? e.hasVolume : null; },
    onStatus: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    getIndex: () => board.index,
    lastBoardTs: () => board.ts,
  };
})(window);
