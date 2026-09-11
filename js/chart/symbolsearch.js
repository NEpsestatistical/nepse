/* =========================================================
   NTC — symbolsearch.js
   Searches the real NEPSE board snapshot (NTC_DATAFEED.fetchBoard)
   client-side. No hardcoded/fake symbol list.
   ========================================================= */
(function (global) {
  "use strict";

  const NTC_SYMBOLSEARCH = {
    _board: [],
    _loaded: false,

    async ensureLoaded() {
      if (this._loaded) return this._board;
      try {
        this._board = await global.NTC_DATAFEED.fetchBoard(false);
        this._loaded = true;
      } catch (e) {
        console.error("[ntc-symbolsearch] board load failed:", e.message);
        this._board = [];
      }
      return this._board;
    },

    search(query) {
      const q = (query || "").trim().toUpperCase();
      if (!q) return this._board.slice(0, 30);
      return this._board.filter((r) => r.symbol.toUpperCase().includes(q) || (r.name || "").toUpperCase().includes(q)).slice(0, 30);
    },
  };

  global.NTC_SYMBOLSEARCH = NTC_SYMBOLSEARCH;
})(window);
