/* =========================================================
   NTC — panels.js
   OHLC readout, crosshair legend, and symbol title bar.
   ========================================================= */
(function (global) {
  "use strict";

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const NTC_PANELS = {
    els: null,

    init(els) {
      this.els = els; // { symTitle, ohO, ohH, ohL, ohC, ohV, ohChg }
    },

    setSymbol(symbol, quote) {
      this.els.symTitle.textContent = symbol;
      if (quote) {
        const up = Number(quote.changeAmount) >= 0;
        this.els.symMeta.textContent = quote.sector || "";
        this.els.symMeta.style.display = quote.sector ? "" : "none";
      } else {
        this.els.symMeta.textContent = "";
      }
    },

    updateFromCandle(candle, prevCandle) {
      if (!candle) {
        this.els.ohO.textContent = this.els.ohH.textContent = this.els.ohL.textContent = this.els.ohC.textContent = "—";
        this.els.ohV.textContent = "—";
        this.els.ohChg.textContent = "";
        return;
      }
      this.els.ohO.textContent = fmt(candle.open);
      this.els.ohH.textContent = fmt(candle.high);
      this.els.ohL.textContent = fmt(candle.low);
      this.els.ohC.textContent = fmt(candle.close);
      this.els.ohV.textContent = (candle.volume || 0).toLocaleString("en-US");

      const dirClass = candle.close >= candle.open ? "up" : "down";
      [this.els.ohO, this.els.ohH, this.els.ohL, this.els.ohC].forEach((e) => {
        e.classList.remove("up", "down");
        e.classList.add(dirClass);
      });

      if (prevCandle) {
        const chg = candle.close - prevCandle.close;
        const pct = prevCandle.close ? (chg / prevCandle.close) * 100 : 0;
        const sign = chg >= 0 ? "+" : "";
        this.els.ohChg.textContent = `${sign}${fmt(chg)} (${sign}${pct.toFixed(2)}%)`;
        this.els.ohChg.className = "ntc-ohlc-chg " + (chg >= 0 ? "up" : "down");
      } else {
        this.els.ohChg.textContent = "";
      }
    },
  };

  global.NTC_PANELS = NTC_PANELS;
})(window);
