# PHASE 10 — Production Polish + TMS/Broker Integration Boundary

## Completed

- Added a production status bar to `chart.html` for market-feed and network state.
- Added timeout/error handling for NEPSE candle and board requests.
- Added a generic, isolated broker/TMS adapter in `js/chart/broker.js`.
- Added Broker/TMS configuration UI without hard-coding any credentials.
- Base URL, label, health path and auth mode are stored locally under the `ntc_` namespace.
- Session secret/token is memory-only and is cleared on disconnect/page reload.
- Generic adapter methods are available for health, orders, cancel, positions and raw requests.
- Added workspace export/import backup JSON support.
- Added a watchlist size guard using `MAX_WATCHLIST_SYMBOLS`.
- Added global runtime/unhandled-promise error feedback through an in-app toast.
- Added responsive Phase 10 styles for smaller screens.
- Added app version and configurable request timeout constants.

## TMS/Broker integration status

The frontend connector boundary is implemented, but a real live TMS/broker connection is intentionally **not claimed as complete** because the project does not specify a particular broker, authenticated API contract, endpoint paths, login/session flow, or live-order permissions.

The connector defaults to generic paths (`/`, `/orders`, `/positions`) and only becomes active after the user supplies a compatible API base URL and session secret. No fake broker response, fake order fill, or guessed broker endpoint has been added.

## Security posture

- Never commit API keys, passwords, cookies, TOTP seeds, or session tokens into this repository.
- The connector stores configuration metadata only; the session secret is memory-only.
- Real broker credentials should be supplied through a secure authenticated backend/session in a production deployment, not exposed as long-lived browser storage.

## Regression rules

- Existing `index.html`, `dashboard.html`, `portfolio.html`, and `chart_2.html` were not rewritten for Phase 10.
- Existing NEPSE workers remain unchanged.
- Paper trading remains local simulation.
- Replay/backtesting remains separate from live broker connectivity.
