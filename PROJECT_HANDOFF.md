# PROJECT HANDOFF — NEPSE Trading Terminal

Read this first if another AI takes over.

## Mission
Build a professional TradingView-inspired NEPSE trading/charting terminal while keeping the existing website safe.

## Current checkpoint
Phases 1–10 are implemented, with the live broker/TMS portion intentionally left at the adapter-boundary stage until a specific broker API contract is supplied.

### Completed
1. Chart Foundation
2. Indicators
3. Drawing Tools
4. Advanced Chart Types / Controls
5. Advanced Analysis
6. Multi-Chart & Layouts
7. Alerts
8. Paper Trading
9. Replay & Backtesting

## Standalone app
`chart.html`

Main-site pages must not be rebuilt or refactored for chart features.

## Important modules
js/chart/broker.js
`js/chart/engine.js`
`js/chart/layout-manager.js`
`js/chart/indicators.js`
`js/chart/drawings.js`
`js/chart/transforms.js`
`js/chart/datafeed.js`
`js/chart/storage.js`
`js/chart/alerts.js`
`js/chart/paper-trading.js`
`js/chart/replay.js`
`js/chart/app.js`

## Data sources — preserve
Candle worker:
`https://nepsechart.bharatiaashish43.workers.dev`

Board/search/quotes worker:
`https://shiny-term-f599.bharatiaashish43.workers.dev`

Do not invent replacement market data.

## Phase 8 paper trading
Paper trading is local simulation only. It supports cash/equity/P&L, market/limit/stop/stop-limit, positions, order cancellation, history, fees/slippage and basic SL/TP.

Because the current candle feed is daily, fills are evaluated against loaded candle/quote values rather than a live order book.

## Development rules
- Never rewrite the whole project.
- Never delete working functionality to make a new feature easier.
- Never fake unavailable market data.
- Never add TMS/broker integration until Phase 10.
- Inspect the current checkpoint before editing.
- Make controlled changes.
- Test changed modules.
- Create a checkpoint after major phases.
- Document what changed and limitations.

## Roadmap
### Phase 9 — Replay & Backtesting
Historical replay, candle stepping, future-data hiding, isolated replay orders, trade journal, EMA crossover backtesting and performance statistics.

See `PHASE9_REPLAY_BACKTESTING.md` for implementation details and limitations.

### Phase 10 — Production Polish / TMS Integration
Production polish, responsive UX, request timeouts, error handling, persistence backup/import, connector boundary and session-safe broker/TMS configuration.

See `PHASE10_PRODUCTION_POLISH_TMS.md`.

### Live TMS/broker status
The frontend adapter is ready, but **live integration is not claimed complete** without a specific broker's authenticated API contract. Do not invent endpoints or credentials. The next concrete step is to map `js/chart/broker.js` to the chosen broker's documented login, quote, order, cancel, position and order-status APIs using a secure backend/session flow.


## Phase 11 — Drawing Interaction Upgrade ✅
The chart drawing system was upgraded after the Phase 10 audit. The standalone chart now supports selecting existing drawings in Cursor mode, dragging drawings to move them, Delete/Backspace removal of the selected drawing, Escape deselection, lock protection, and persistence through the existing drawing storage. Supported drawings include trend/ray, horizontal/vertical lines, rectangle, Fibonacci, text, and measure. Existing creation, hide/show, undo, lock/unlock, clear, zoom/pan anchoring, and multi-chart isolation were preserved.

Phase 11 files changed:
- `js/chart/drawings.js`
- `js/chart/app.js`
- `css/chart/drawings.css`
- `PHASE11_DRAWING_INTERACTION.md`

Phase 11 limitations:
- Drawing dragging is whole-object movement; individual anchor editing is not yet implemented.
- Final manual browser click-through is still recommended.

## Current Priority
Chart quality remains the project priority. Do not spend development time on TMS/broker integration unless explicitly requested. The next chart-focused work should be selected based on real usability/testing findings, with drawing anchor editing, keyboard shortcuts, mobile toolbar UX, and performance as possible future priorities.
