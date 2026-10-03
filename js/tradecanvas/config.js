/* =========================================================
   TCN (TradeCanvas · NEPSE) — config.js
   Single place for every endpoint and tunable used by the new
   TradeCanvas chart page (chart.html). Nothing else in js/tradecanvas
   hard-codes a URL.

   Workers (both already used by the rest of the site):
   - BOARD_WORKER_URL  : market board  GET /all -> { board:[{symbol,name,ltp,
                         percentChange,qty,sector,...}], index:{...} }
                         Used for symbol search, quotes and watchlist prices.
   - CANDLE_WORKER_URL : GET /?symbol=XYZ -> { candles:[{time(unix secs),open,
                         high,low,close[,volume]}] }  (daily OHLC history).
                         The board worker does not serve candles, so the
                         existing candle worker (same one chart_2.html uses)
                         is kept for history. Remove/replace it here only.
   ========================================================= */
(function (global) {
  "use strict";

  global.TCN_CONFIG = Object.freeze({
    BOARD_WORKER_URL: "https://shiny-term-f599.bharatiaashish43.workers.dev",
    CANDLE_WORKER_URL: "https://nepsechart.bharatiaashish43.workers.dev",

    REQUEST_TIMEOUT_MS: 12000,
    BOARD_TTL_MS: 45000,          // board snapshot freshness (matches dashboard-market.js)
    CANDLE_TTL_MS: 60000,         // how long a symbol's candle series is reused
    POLL_INTERVAL_MS: 60000,      // periodic candle refresh for the open symbol
    WATCHLIST_REFRESH_MS: 45000,  // watchlist price refresh from the board

    DEFAULT_SYMBOL: "NABIL",
    DEFAULT_WATCHLIST: ["NABIL", "NICA", "SCB", "HDL", "UPPER", "NLIC"],
    MAX_WATCHLIST: 100,

    // Prefix keeps every localStorage key apart from "ee_*", "ntc_*" and portfolio keys.
    STORAGE_PREFIX: "tcn_",

    // NEPSE session schedule, used ONLY for the "schedule" market pill.
    // Holidays/special sessions are not detected.
    MARKET_TZ_OFFSET_MIN: 345,    // Asia/Kathmandu = UTC+5:45
    MARKET_OPEN_DAYS: [0, 1, 2, 3, 4], // Sun..Thu
    MARKET_OPEN_HHMM: [1100, 1500],
  });
})(window);
