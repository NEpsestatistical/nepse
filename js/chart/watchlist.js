/* =========================================================
   NTC — watchlist.js
   Multiple named watchlists, persisted via NTC_STORAGE (isolated
   "ntc_" localStorage key — separate from chart_2.html's
   single "ee_watchlist_v1" list).
   ========================================================= */
(function (global) {
  "use strict";
  const STATE = global.NTC_STATE;
  const STORE = global.NTC_STORAGE;

  function uid() {
    return "wl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  const NTC_WATCHLIST = {
    init() {
      STATE.watchlists = STORE.loadWatchlists();
      STATE.activeWatchlistId = STATE.watchlists.activeId || STATE.watchlists.lists[0].id;
    },

    _persist() {
      STORE.saveWatchlists(STATE.watchlists);
    },

    getActive() {
      return STATE.watchlists.lists.find((l) => l.id === STATE.activeWatchlistId) || STATE.watchlists.lists[0];
    },

    getAll() {
      return STATE.watchlists.lists;
    },

    setActive(id) {
      if (!STATE.watchlists.lists.some((l) => l.id === id)) return;
      STATE.activeWatchlistId = id;
      STATE.watchlists.activeId = id;
      this._persist();
    },

    createList(name) {
      const list = { id: uid(), name: (name || "New watchlist").trim() || "New watchlist", symbols: [] };
      STATE.watchlists.lists.push(list);
      this.setActive(list.id);
      return list;
    },

    renameList(id, name) {
      const list = STATE.watchlists.lists.find((l) => l.id === id);
      if (!list || !name || !name.trim()) return;
      list.name = name.trim();
      this._persist();
    },

    deleteList(id) {
      if (STATE.watchlists.lists.length <= 1) return false; // always keep at least one
      STATE.watchlists.lists = STATE.watchlists.lists.filter((l) => l.id !== id);
      if (STATE.activeWatchlistId === id) {
        STATE.activeWatchlistId = STATE.watchlists.lists[0].id;
        STATE.watchlists.activeId = STATE.activeWatchlistId;
      }
      this._persist();
      return true;
    },

    addSymbol(symbol) {
      symbol = (symbol || "").trim().toUpperCase();
      if (!symbol) return false;
      const list = this.getActive();
      if (list.symbols.includes(symbol)) return false;
      const maxSymbols = (global.NTC_CONFIG && global.NTC_CONFIG.MAX_WATCHLIST_SYMBOLS) || 250;
      if (list.symbols.length >= maxSymbols) return false;
      list.symbols.push(symbol);
      this._persist();
      return true;
    },

    removeSymbol(symbol) {
      const list = this.getActive();
      list.symbols = list.symbols.filter((s) => s !== symbol);
      this._persist();
    },

    reorder(fromIndex, toIndex) {
      const list = this.getActive();
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.symbols.length || toIndex >= list.symbols.length) return;
      const [moved] = list.symbols.splice(fromIndex, 1);
      list.symbols.splice(toIndex, 0, moved);
      this._persist();
    },
  };

  global.NTC_WATCHLIST = NTC_WATCHLIST;
})(window);
