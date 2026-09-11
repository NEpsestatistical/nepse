/* =========================================================
   NTC — storage.js
   All persistence for the standalone chart, namespaced under
   NTC_CONFIG.STORAGE_PREFIX ("ntc_") so it can never read or
   clobber the existing site's localStorage keys.
   ========================================================= */
(function (global) {
  "use strict";
  const P = global.NTC_CONFIG.STORAGE_PREFIX;

  const KEYS = {
    PREFS: P + "prefs_v1", // { symbol, timeframe, chartType }
    INDICATORS: P + "indicators_v1",
    WATCHLISTS: P + "watchlists_v1", // { activeId, lists: [{id,name,symbols:[]}] }
    BOARD_CACHE: P + "board_cache_v1", // sessionStorage: { data, ts }
    WORKSPACE: P + "workspace_v1",
  };

  function readJSON(store, key, fallback) {
    try {
      const raw = store.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
      console.warn("[ntc-storage] failed to read", key, e.message);
      return fallback;
    }
  }
  function writeJSON(store, key, value) {
    try {
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("[ntc-storage] failed to write", key, e.message);
      return false;
    }
  }

  const DEFAULT_WATCHLISTS = {
    activeId: "default",
    lists: [
      { id: "default", name: "Watchlist", symbols: ["NABIL", "NLIC", "NICA", "HIDCL", "UPPER"] },
    ],
  };

  const NTC_STORAGE = {
    loadPrefs() {
      return readJSON(localStorage, KEYS.PREFS, { symbol: "NABIL", timeframe: "1D", chartType: "candles" });
    },
    savePrefs(prefs) {
      return writeJSON(localStorage, KEYS.PREFS, prefs);
    },
    loadIndicators() { return readJSON(localStorage, KEYS.INDICATORS, []); },
    saveIndicators(items) { return writeJSON(localStorage, KEYS.INDICATORS, items); },
    loadWorkspace() { return readJSON(localStorage, KEYS.WORKSPACE, null); },
    saveWorkspace(data) { return writeJSON(localStorage, KEYS.WORKSPACE, data); },

    loadWatchlists() {
      const data = readJSON(localStorage, KEYS.WATCHLISTS, null);
      if (!data || !Array.isArray(data.lists) || !data.lists.length) {
        // seed on first run, but don't clobber a corrupted-but-present value
        writeJSON(localStorage, KEYS.WATCHLISTS, DEFAULT_WATCHLISTS);
        return JSON.parse(JSON.stringify(DEFAULT_WATCHLISTS));
      }
      return data;
    },
    saveWatchlists(data) {
      return writeJSON(localStorage, KEYS.WATCHLISTS, data);
    },

    loadBoardCache() {
      return readJSON(sessionStorage, KEYS.BOARD_CACHE, null);
    },
    saveBoardCache(cache) {
      return writeJSON(sessionStorage, KEYS.BOARD_CACHE, cache);
    },
    exportData() {
      return {
        version: 1, exportedAt: new Date().toISOString(),
        prefs: this.loadPrefs(), indicators: this.loadIndicators(),
        watchlists: this.loadWatchlists(), workspace: this.loadWorkspace()
      };
    },
    importData(data) {
      if (!data || typeof data !== "object") throw new Error("Invalid workspace file.");
      if (data.prefs) writeJSON(localStorage, KEYS.PREFS, data.prefs);
      if (Array.isArray(data.indicators)) writeJSON(localStorage, KEYS.INDICATORS, data.indicators);
      if (data.watchlists && Array.isArray(data.watchlists.lists)) writeJSON(localStorage, KEYS.WATCHLISTS, data.watchlists);
      if (data.workspace && typeof data.workspace === "object") writeJSON(localStorage, KEYS.WORKSPACE, data.workspace);
      return true;
    },
  };

  global.NTC_STORAGE = NTC_STORAGE;
})(window);
