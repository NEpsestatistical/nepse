/* NTC theme.js — dark/light/midnight/solarized theme switching, persisted
   per-browser. Applying the attribute is also done inline in <head> (see
   chart.html) so there is no flash of the wrong theme on load; this file
   provides the cycle/apply API and notifies the chart engines so their
   canvas-based colors (which CSS can't reach) stay in sync. */
(function (global) {
  "use strict";

  const THEMES = [
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
    { id: "midnight", label: "Midnight Blue" },
    { id: "solarized", label: "Solarized" },
  ];

  function storageKey() {
    return (global.NTC_CONFIG ? global.NTC_CONFIG.STORAGE_PREFIX : "ntc_") + "theme";
  }

  function current() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  function apply(theme, opts) {
    if (!THEMES.some((t) => t.id === theme)) theme = "dark";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(storageKey(), theme);
    } catch (e) {}
    if (!opts || !opts.silent) {
      global.dispatchEvent(new CustomEvent("ntc-theme-changed", { detail: { theme } }));
    }
  }

  function init() {
    let saved = null;
    try {
      saved = localStorage.getItem(storageKey());
    } catch (e) {}
    apply(saved || current(), { silent: true });
  }

  function next(theme) {
    const idx = THEMES.findIndex((t) => t.id === theme);
    return THEMES[(idx + 1) % THEMES.length].id;
  }

  function cycle() {
    apply(next(current()));
  }

  global.NTC_THEME = { THEMES, init, apply, cycle, current };
})(window);
