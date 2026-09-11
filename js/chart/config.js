/* =========================================================
   NTC (NEPSE Trading Chart) — config.js
   Standalone chart application config. Fully isolated from
   the existing chart_2.html / index.html / dashboard / portfolio code.

   Re-uses the SAME backend workers the rest of the site already
   depends on (no new backend, no invented data):
     - CANDLE_WORKER_URL  -> single-symbol OHLCV history (daily)
     - BOARD_WORKER_URL   -> full-market board snapshot (for symbol search
                              + last price / change in the watchlist)
   ========================================================= */
(function (global) {
  "use strict";

  const NTC_CONFIG = {
    // Same worker chart_2.html uses for candles. Confirmed to return
    // daily OHLCV only — see NTC_TIMEFRAMES below for what that means
    // for the timeframe selector.
    CANDLE_WORKER_URL: "https://nepsechart.bharatiaashish43.workers.dev",

    // Same worker dashboard-market.js uses for the full board (LTP,
    // change%, sector, qty traded) — used here for symbol search and
    // watchlist quotes so we don't invent a second data source.
    BOARD_WORKER_URL: "https://shiny-term-f599.bharatiaashish43.workers.dev",

    // How long a fetched board snapshot is considered fresh before a
    // background refetch is attempted (mirrors dashboard-market.js's TTL).
    BOARD_CACHE_TTL_MS: 45000,

    // Everything this app touches in localStorage/sessionStorage is
    // prefixed "ntc_" (NEPSE Trading Chart) so it can never collide with
    // the existing site's "ee_" keys, portfolio's keys, or chart_2.html's
    // "ee_watchlist_v1" / drawing keys.
    STORAGE_PREFIX: "ntc_",
    APP_VERSION: "10.0.0",
    REQUEST_TIMEOUT_MS: 12000,
    MAX_WATCHLIST_SYMBOLS: 250,
    MAX_WORKSPACE_CHARTS: 16,
  };

  // Timeframe architecture. `available` reflects reality: the candle
  // worker only ever returns one daily series per symbol, so every
  // intraday/weekly/monthly bucket is wired into the UI but disabled
  // rather than backed by synthesized candles.
  const NTC_TIMEFRAMES = [
    { id: "1m", label: "1m", available: false },
    { id: "3m", label: "3m", available: false },
    { id: "5m", label: "5m", available: false },
    { id: "15m", label: "15m", available: false },
    { id: "30m", label: "30m", available: false },
    { id: "45m", label: "45m", available: false },
    { id: "1H", label: "1H", available: false },
    { id: "2H", label: "2H", available: false },
    { id: "4H", label: "4H", available: false },
    { id: "1D", label: "1D", available: true },
    { id: "1W", label: "1W", available: false },
    { id: "1M", label: "1M", available: false },
  ];

  // Chart-type architecture. `available` = can be correctly rendered
  // today from the OHLCV data we actually get back (native lightweight-
  // charts series types, or a deterministic transform of real candles
  // like Heikin Ashi). Renko/Line Break/Kagi/P&F/Range are deterministic transforms of the real daily OHLCV data.
  const NTC_CHART_TYPES = [
    { id: "candles", label: "Candles", available: true },
    { id: "bars", label: "Bars", available: true },
    { id: "hollow", label: "Hollow Candles", available: true },
    { id: "line", label: "Line", available: true },
    { id: "area", label: "Area", available: true },
    { id: "baseline", label: "Baseline", available: true },
    { id: "heikinashi", label: "Heikin Ashi", available: true },
    { id: "renko", label: "Renko", available: true },
    { id: "linebreak", label: "Line Break", available: true },
    { id: "kagi", label: "Kagi", available: true },
    { id: "pnf", label: "Point & Figure", available: true },
    { id: "range", label: "Range", available: true },
  ];

  global.NTC_CONFIG = NTC_CONFIG;
  global.NTC_TIMEFRAMES = NTC_TIMEFRAMES;
  global.NTC_CHART_TYPES = NTC_CHART_TYPES;
})(window);
