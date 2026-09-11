/* =========================================================
   NTC — toolbar.js
   Renders the timeframe selector and chart-type selector from
   the architecture defined in config.js (NTC_TIMEFRAMES /
   NTC_CHART_TYPES), disabling anything not actually backed by data.
   ========================================================= */
(function (global) {
  "use strict";

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  const NTC_TOOLBAR = {
    init({ timeframeEl, chartTypeEl, onTimeframe, onChartType }) {
      this._renderTimeframes(timeframeEl, onTimeframe);
      this._renderChartTypes(chartTypeEl, onChartType);
      this.timeframeEl = timeframeEl;
      this.chartTypeEl = chartTypeEl;
    },

    _renderTimeframes(container, onSelect) {
      container.innerHTML = "";
      global.NTC_TIMEFRAMES.forEach((tf) => {
        const btn = el("button", "ntc-btn ntc-tf-btn", tf.label);
        btn.dataset.tf = tf.id;
        if (!tf.available) {
          btn.disabled = true;
          btn.title = "Unavailable — the NEPSE data source doesn't provide " + tf.label + " candles yet.";
          btn.classList.add("ntc-disabled");
        } else {
          btn.addEventListener("click", () => onSelect(tf.id));
        }
        container.appendChild(btn);
      });
    },

    _renderChartTypes(container, onSelect) {
      container.innerHTML = "";
      global.NTC_CHART_TYPES.forEach((ct) => {
        const opt = el("option", null, ct.label + (ct.available ? "" : " (coming soon)"));
        opt.value = ct.id;
        opt.disabled = !ct.available;
        container.appendChild(opt);
      });
      container.addEventListener("change", () => onSelect(container.value));
    },

    setActiveTimeframe(id) {
      if (!this.timeframeEl) return;
      this.timeframeEl.querySelectorAll(".ntc-tf-btn").forEach((b) => b.classList.toggle("active", b.dataset.tf === id));
    },

    setChartType(id) {
      if (this.chartTypeEl) this.chartTypeEl.value = id;
    },
  };

  global.NTC_TOOLBAR = NTC_TOOLBAR;
})(window);
