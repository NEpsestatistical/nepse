/* =========================================================
   NTC — state.js
   Single shared state object for the standalone chart app.
   ========================================================= */
(function (global) {
  "use strict";

  const NTC_STATE = {
    symbol: null,
    timeframe: "1D",
    chartType: "candles",
    candles: [], // raw candles as returned by the datafeed (ascending time)
    watchlists: null, // loaded from NTC_STORAGE on boot
    activeWatchlistId: null,
    quoteCache: {}, // symbol -> board row, refreshed with fetchBoard()
  };

  global.NTC_STATE = NTC_STATE;
})(window);
