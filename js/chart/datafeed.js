/* =========================================================
   NTC — datafeed.js
   Every value here comes from the site's existing Cloudflare
   Worker endpoints. Nothing in this file invents or synthesizes
   candles, prices, or symbols.
   ========================================================= */
(function (global) {
  "use strict";
  const CFG = global.NTC_CONFIG;
  async function fetchWithTimeout(url, options){
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(), CFG.REQUEST_TIMEOUT_MS || 12000);
    try { return await fetch(url, Object.assign({}, options, {signal: controller.signal, cache:"no-store"})); }
    catch(e){ if(e && e.name === "AbortError") throw new Error("Request timed out. Check the market feed or your connection."); throw e; }
    finally { clearTimeout(timer); }
  }

  let _boardCache = { data: null, ts: 0 };
  (function primeFromSession() {
    const cached = global.NTC_STORAGE.loadBoardCache();
    if (cached && cached.data) _boardCache = cached;
  })();

  const NTC_DATAFEED = {
    // ---- Candles for one symbol (daily OHLCV — the only resolution
    // the worker provides today; see NTC_TIMEFRAMES in config.js) ----
    async fetchCandles(symbol) {
      const url = `${CFG.CANDLE_WORKER_URL}/?symbol=${encodeURIComponent(symbol)}`;
      const res = await fetchWithTimeout(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.candles || !data.candles.length) throw new Error("No data returned for this symbol.");
      // normalize + sort ascending by time, drop malformed rows rather than fake them
      return data.candles
        .filter((c) => c && typeof c.time === "number" && isFinite(c.open) && isFinite(c.high) && isFinite(c.low) && isFinite(c.close))
        .sort((a, b) => a.time - b.time);
    },

    // ---- Full market board (symbol, ltp, change, sector, qty traded) —
    // used for symbol search and to show watchlist quotes. Same worker +
    // endpoint dashboard-market.js already relies on, with the same
    // caching convention (45s TTL, session-persisted so a reload isn't blank). ----
    async fetchBoard(force) {
      if (!force && _boardCache.data && Date.now() - _boardCache.ts < CFG.BOARD_CACHE_TTL_MS) {
        return _boardCache.data;
      }
      try {
        const res = await fetchWithTimeout(`${CFG.BOARD_WORKER_URL}/all`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rawBoard = Array.isArray(json.board) ? json.board : [];
        const seen = new Set();
        const board = rawBoard.filter((r) => {
          if (!r || !r.symbol || seen.has(r.symbol)) return false;
          seen.add(r.symbol);
          return true;
        });
        _boardCache = { data: board, ts: Date.now() };
        global.NTC_STORAGE.saveBoardCache(_boardCache);
        return board;
      } catch (e) {
        console.error("[ntc-datafeed] board fetch failed:", e.message);
        if (_boardCache.data) return _boardCache.data; // stale beats nothing
        throw e;
      }
    },

    async lookupQuote(symbol) {
      const board = await this.fetchBoard(false).catch(() => []);
      return board.find((r) => r.symbol === symbol) || null;
    },
  };

  global.NTC_DATAFEED = NTC_DATAFEED;
})(window);
