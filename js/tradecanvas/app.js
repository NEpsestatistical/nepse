/* =========================================================
   TCN — app.js
   Wires TradeCanvas' ChartWidget to the NEPSE adapter and the page
   shell in chart.html. No synthetic data: every number shown comes
   from the workers configured in config.js.
   ========================================================= */
(function (global) {
  "use strict";
  const CFG = global.TCN_CONFIG, FEED = global.TCN_FEED, TC = global.TradeCanvas;
  const $ = (id) => document.getElementById(id);
  const KEY = (k) => CFG.STORAGE_PREFIX + k;

  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(KEY(k)); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch (e) { /* storage full/blocked: non-fatal */ } },
  };

  if (!TC || !TC.ChartWidget) { fail("The chart library failed to load (vendor/tradecanvas/tradecanvas.iife.js)."); return; }

  /* ---------- helpers ---------- */
  const cleanSym = (s) => String(s || "").trim().toUpperCase().replace(/[^A-Z0-9_.&-]/g, "").slice(0, 20);
  const fmt = (n, d) => (n === null || n === undefined || !isFinite(n) ? "—" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
  function fail(msg) { const b = $("tcnBanner"); $("tcnBannerText").textContent = msg; b.hidden = false; }
  function clearFail() { $("tcnBanner").hidden = true; }

  /* ---------- initial state ---------- */
  const urlSym = cleanSym(new URLSearchParams(location.search).get("symbol"));
  let symbol = urlSym || cleanSym(store.get("last_symbol", "")) || CFG.DEFAULT_SYMBOL;
  let watchlist = (store.get("watchlist", null) || CFG.DEFAULT_WATCHLIST).map(cleanSym).filter(Boolean).slice(0, CFG.MAX_WATCHLIST);
  if (!watchlist.length) watchlist = CFG.DEFAULT_WATCHLIST.slice();

  /* ---------- status pills / banner ---------- */
  const state = { board: "loading", candles: "loading", msg: { board: "", candles: "" } };
  function renderFeed() {
    const pill = $("pillFeed");
    const worst = state.board === "error" || state.candles === "error" ? "error" : state.board === "loading" || state.candles === "loading" ? "loading" : "ok";
    pill.className = "tcn-pill " + worst;
    pill.textContent = worst === "ok" ? "Feed: live" : worst === "loading" ? "Feed: loading…" : "Feed: problem";
    const msg = state.candles === "error" ? state.msg.candles : state.board === "error" ? "Quotes/search: " + state.msg.board : "";
    if (msg) fail(msg); else clearFail();
  }
  FEED.onStatus((s) => { state[s.kind] = s.state; state.msg[s.kind] = s.message; renderFeed(); if (s.kind === "board" && s.state === "ok") { renderQuote(); pushWatchlistQuotes(); } if (s.kind === "candles" && s.state === "ok") { applyVolumeFeature(); pushWatchlistQuotes(); } });

  function nptNow() { const d = new Date(Date.now() + (CFG.MARKET_TZ_OFFSET_MIN + new Date().getTimezoneOffset()) * 60000); return d; }
  function renderMarket() {
    const d = nptNow(), hhmm = d.getHours() * 100 + d.getMinutes();
    const open = CFG.MARKET_OPEN_DAYS.indexOf(d.getDay()) >= 0 && hhmm >= CFG.MARKET_OPEN_HHMM[0] && hhmm < CFG.MARKET_OPEN_HHMM[1];
    const p = $("pillMarket");
    p.className = "tcn-pill " + (open ? "ok" : "");
    p.textContent = open ? "Market: in session (schedule)" : "Market: closed (schedule)";
  }

  /* ---------- quote strip ---------- */
  function renderQuote() {
    const q = FEED.quoteFor(symbol);
    $("qSym").textContent = symbol;
    $("qName").textContent = q ? q.name : "";
    $("qLtp").textContent = q ? fmt(q.ltp, 2) : "—";
    const chg = $("qChg");
    if (q && q.percentChange !== null) {
      const up = q.percentChange >= 0;
      chg.textContent = (up ? "+" : "") + fmt(q.percentChange, 2) + "%";
      chg.className = "tcn-q-chg " + (up ? "up" : "down");
    } else { chg.textContent = ""; chg.className = "tcn-q-chg"; }
    const bits = [];
    if (q && q.sector) bits.push(q.sector);
    if (q && q.qty !== null) bits.push("Qty " + fmt(q.qty, 0));
    $("qMeta").textContent = bits.join(" · ");
  }

  /* ---------- watchlist prices (real board values) ---------- */
  let widget = null;
  function pushWatchlistQuotes() {
    if (!widget) return;
    watchlist.forEach((s) => {
      const q = FEED.quoteFor(s);
      if (s === symbol) {
        // The widget tracks the open symbol from the chart's own last candle, so compare against the
        // chart's own previous close to keep price and change consistent with what is drawn.
        const pc = FEED.prevClose(s);
        if (pc !== null) widget.setWatchlistEntry(s, { refPrice: pc });
      } else if (q && q.ltp !== null) {
        widget.setWatchlistEntry(s, { lastPrice: q.ltp, refPrice: q.prevClose !== null ? q.prevClose : undefined });
      }
    });
  }

  function applyVolumeFeature() {
    if (!widget) return;
    const has = FEED.hasVolume(symbol);
    if (has === null) return;
    try { widget.getChart().setFeatures({ volume: has }); } catch (e) { /* older API: ignore */ }
  }

  /* ---------- create the widget ---------- */
  const wide = global.innerWidth >= 900;
  try {
    widget = new TC.ChartWidget($("tcnChart"), {
      symbol,
      timeframe: "1d",
      theme: "dark",
      adapter: FEED.create(),
      // NEPSE is cash equities with no broker connection here — trading UI is off rather than faked.
      trading: false, accountPanel: false, depthLadder: false,
      symbols: watchlist,
      searchSymbols: (q) => FEED.searchSymbols(q),
      timeframes: ["1d", "1w", "1M"],
      customTimeframes: false,
      chartTypes: ["candlestick", "hollowCandle", "bar", "line", "area", "baseline", "heikinAshi", "hlcArea", "stepLine", "renko", "lineBreak", "kagi", "pointAndFigure", "rangeBars"],
      watchlist: wide,
      historyLimit: 5000,
      historyPageSize: 500,
      dragDropImport: false,
      layouts: true,
      alerts: true,
      objectTree: true,
      persistLayouts: { keyPrefix: CFG.STORAGE_PREFIX + "layout_" },
      chartOptions: { timeZone: "Asia/Kathmandu" },
      onSymbolChange: (s) => { symbol = cleanSym(s) || symbol; store.set("last_symbol", symbol); renderQuote(); syncStar(); applyVolumeFeature(); try { history.replaceState(null, "", "?symbol=" + encodeURIComponent(symbol)); } catch (e) { /* ignore */ } },
    });
  } catch (e) {
    console.error("[tcn] widget init failed", e);
    fail("The chart failed to start: " + (e && e.message ? e.message : e));
    return;
  }

  /* ---------- watchlist add/remove (toolbar star) ---------- */
  let starBtn = null;
  function syncStar() { if (starBtn) starBtn.setActive(watchlist.indexOf(symbol) >= 0); }
  try {
    starBtn = widget.addToolbarButton({
      id: "tcn-watch", label: "Add / remove current symbol from watchlist", text: "★ Watch", toggle: true, side: "left",
      onClick: function () {
        const i = watchlist.indexOf(symbol);
        if (i >= 0) { if (watchlist.length > 1) watchlist.splice(i, 1); }
        else if (watchlist.length < CFG.MAX_WATCHLIST) watchlist.push(symbol);
        store.set("watchlist", watchlist);
        widget.setSymbols(watchlist.slice());
        pushWatchlistQuotes();
        syncStar();
      },
    });
  } catch (e) { console.warn("[tcn] watch button unavailable", e); }
  syncStar();

  /* ---------- periodic work ---------- */
  FEED.fetchBoard(true).then(() => { renderQuote(); pushWatchlistQuotes(); }).catch(() => { /* status handler already surfaced it */ });
  setInterval(() => { FEED.fetchBoard(true).then(() => { renderQuote(); pushWatchlistQuotes(); }).catch(() => {}); }, CFG.WATCHLIST_REFRESH_MS);
  renderMarket(); setInterval(renderMarket, 30000);
  renderQuote(); renderFeed();

  $("tcnRetry").addEventListener("click", () => {
    clearFail(); state.board = "loading"; state.candles = "loading"; renderFeed();
    FEED.fetchBoard(true).catch(() => {});
    widget.setSymbol(symbol);
  });

  global.addEventListener("beforeunload", () => { try { widget.destroy(); } catch (e) { /* ignore */ } });
  global.TCN_APP = { widget, getSymbol: () => symbol };
})(window);
