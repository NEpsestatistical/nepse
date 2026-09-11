# NTC Phase 6 — Multi-Chart & Layouts

## Checkpoint
This checkpoint continues the standalone NEPSE chart from Phases 1–5.

### What we were building
A TradingView-inspired NEPSE chart terminal, isolated in `chart.html`, with the existing main site protected. TMS/broker integration is intentionally NOT part of this work yet.

### Completed before Phase 6
- Phase 1: standalone chart foundation, NEPSE candle/board feeds, symbol search, watchlist, chart controls and chart types.
- Phase 2: indicator registry and ~56 technical indicators with overlays/panes and persistence.
- Phase 3: drawing tools and per-symbol drawing persistence.
- Phase 4: advanced chart-type transforms (Heikin Ashi, Renko, Line Break, Kagi, Point & Figure, Range) and price-scale controls.
- Phase 5: advanced analysis additions including Anchored VWAP and Volume Profile levels (POC/VAH/VAL).

## Phase 6 additions
- Multi-chart layouts: 1, 2 horizontal, 2 stacked, 4, 6, 8, 12 and 16.
- Independent chart instances with separate symbol/timeframe/chart type/indicators/drawings.
- Active-chart selection by click/double-click.
- Optional symbol, timeframe and crosshair synchronization.
- Workspace persistence in `ntc_workspace_v1`.
- Reuse of the existing data feed; no TMS/broker changes.
- Responsive behavior that keeps one active chart usable on small screens.
- Engine lifecycle cleanup via `destroy()`.

## Files added/changed for Phase 6
- `js/chart/layout-manager.js` — layout lifecycle and active-chart manager.
- `css/chart/multichart.css` — grid/card/responsive styling.
- `js/chart/app.js` — multi-chart orchestration and per-chart state.
- `js/chart/engine.js` — chart-engine cleanup method.
- `js/chart/storage.js` — workspace persistence.
- `chart.html` — layout selector, sync controls and chart grid.

## Important implementation notes
- The top toolbar controls the currently active chart.
- Each chart owns its own `NTCEngine` and drawing engine.
- Candle data is reused for synchronized symbols where possible.
- The legacy single-indicator storage remains as a compatibility fallback; workspace state is the preferred source for multi-chart indicator state.

## What remains
Phase 7: alerts.
Phase 8: paper trading engine.
Phase 9: replay/backtesting.
Phase 10: production polish and, only after that, TMS/broker integration.

## Testing performed
- JavaScript syntax checks with `node --check` on all changed JS modules.
- Static architecture review of chart creation/destruction, workspace persistence and synchronization paths.

Browser UI automation was not available in the build environment, so visual/browser interaction should be manually tested after opening `chart.html`.

# Phase 7 — Alerts (included in this checkpoint)

Added a lightweight client-side alert system in `js/chart/alerts.js` with persistence under `ntc_alerts_v1`.

Supported now:
- Price crosses above/below a level.
- Indicator-vs-indicator crossover alerts using IDs such as `ema:sma`.
- Enable/pause/resume/delete alert management.
- In-app toast notifications.
- Optional browser notifications when the user has granted notification permission.
- 30-second refresh/check loop for visible chart symbols.

This is deliberately client-side and uses the existing NEPSE candle feed. It does not claim server-side guarantees, background alerts while the page is closed, or broker/order alerts.
