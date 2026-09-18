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
      const ICONS = {
        candles: '<rect x="5" y="9" width="3" height="8"/><line x1="6.5" y1="9" x2="6.5" y2="4"/><line x1="6.5" y1="17" x2="6.5" y2="21"/><rect x="11" y="5" width="3" height="14"/><line x1="12.5" y1="5" x2="12.5" y2="2"/><line x1="12.5" y1="19" x2="12.5" y2="22"/><rect x="17" y="11" width="3" height="6"/><line x1="18.5" y1="11" x2="18.5" y2="7"/><line x1="18.5" y1="17" x2="18.5" y2="20"/>',
        hollow: '<rect x="5" y="9" width="3" height="8" fill="none"/><line x1="6.5" y1="9" x2="6.5" y2="4"/><line x1="6.5" y1="17" x2="6.5" y2="21"/><rect x="11" y="5" width="3" height="14" fill="none"/><line x1="12.5" y1="5" x2="12.5" y2="2"/><line x1="12.5" y1="19" x2="12.5" y2="22"/><rect x="17" y="11" width="3" height="6" fill="none"/><line x1="18.5" y1="11" x2="18.5" y2="7"/><line x1="18.5" y1="17" x2="18.5" y2="20"/>',
        bars: '<line x1="6" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="9" y2="6"/><line x1="6" y1="18" x2="3" y2="18"/><line x1="14" y1="3" x2="14" y2="21"/><line x1="14" y1="3" x2="17" y2="3"/><line x1="14" y1="21" x2="11" y2="21"/>',
        line: '<polyline points="3,17 9,10 13,14 21,5" fill="none"/>',
        area: '<polyline points="3,17 9,10 13,14 21,5" fill="none"/><path d="M3 17 L9 10 L13 14 L21 5 V21 H3 Z" fill="currentColor" fill-opacity=".15" stroke="none"/>',
        baseline: '<line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="2,2"/><polyline points="3,7 9,12 13,9 21,15" fill="none"/>',
        heikinashi: '<rect x="5" y="8" width="3" height="9"/><line x1="6.5" y1="8" x2="6.5" y2="5"/><rect x="11" y="6" width="3" height="12"/><line x1="12.5" y1="6" x2="12.5" y2="3"/><rect x="17" y="10" width="3" height="7"/><line x1="18.5" y1="10" x2="18.5" y2="7"/>',
        renko: '<rect x="4" y="13" width="5" height="6"/><rect x="10" y="7" width="5" height="6"/><rect x="16" y="3" width="5" height="6"/>',
        linebreak: '<rect x="4" y="6" width="4" height="10"/><rect x="10" y="11" width="4" height="7"/><rect x="16" y="4" width="4" height="10"/>',
        kagi: '<polyline points="4,18 4,10 11,10 11,5 18,5 18,14 21,14" fill="none" stroke-width="2.5"/>',
        pnf: '<text x="4" y="10" font-size="8" stroke="none" fill="currentColor">X X</text><text x="4" y="19" font-size="8" stroke="none" fill="currentColor">O O</text>',
        range: '<rect x="4" y="8" width="4" height="8"/><rect x="10" y="5" width="4" height="11"/><rect x="16" y="9" width="4" height="6"/>',
      };
      function iconSvg(id){
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ICONS[id]||ICONS.candles}</svg>`;
      }
      this._iconSvg = iconSvg;
      global.NTC_CHART_TYPES.forEach((ct) => {
        const row = el("button", "ntc-chart-type-row");
        row.dataset.type = ct.id;
        row.innerHTML = iconSvg(ct.id) + `<span>${ct.label}</span>` + (ct.available ? "" : ' <span class="ntc-soon">soon</span>');
        if (!ct.available) {
          row.disabled = true;
          row.classList.add("ntc-disabled");
        } else {
          row.addEventListener("click", () => {
            onSelect(ct.id);
            container.classList.remove("show");
          });
        }
        container.appendChild(row);
      });
    },

    setActiveTimeframe(id) {
      if (!this.timeframeEl) return;
      this.timeframeEl.querySelectorAll(".ntc-tf-btn").forEach((b) => b.classList.toggle("active", b.dataset.tf === id));
    },

    setChartType(id) {
      if (!this.chartTypeEl) return;
      this.chartTypeEl.querySelectorAll(".ntc-chart-type-row").forEach((r) => r.classList.toggle("active", r.dataset.type === id));
      const def = global.NTC_CHART_TYPES.find((ct) => ct.id === id);
      const labelEl = document.getElementById("ntcChartTypeLabel");
      const iconEl = document.getElementById("ntcChartTypeIcon");
      if (labelEl && def) labelEl.textContent = def.label;
      if (iconEl && this._iconSvg) iconEl.outerHTML = this._iconSvg(id).replace("<svg ", '<svg id="ntcChartTypeIcon" ');
    },
  };

  global.NTC_TOOLBAR = NTC_TOOLBAR;
})(window);
