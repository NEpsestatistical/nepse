# Phase 8 — Paper Trading

## Status
Completed in this checkpoint.

## What was added
- Local-only simulated paper trading engine (`js/chart/paper-trading.js`).
- No TMS, broker, or live order routing.
- Persistent paper account in namespaced localStorage.
- Configurable starting balance, fees and slippage.
- Cash, equity, buying power, realized and unrealized P&L.
- Market, limit, stop and stop-limit orders.
- Buy/sell validation and cash/position checks.
- Order cancellation.
- Filled/pending/rejected/cancelled order states.
- Trade history and account history.
- Position table with average price, last price, market value, unrealized P&L and P&L percentage.
- Position close action.
- Stop-loss and take-profit bracket values for buy fills.
- Quote/candle evaluation for pending orders and brackets.
- Paper Trading modal in the standalone chart.
- Responsive paper-trading UI.

## Simulation limitations
- The current NEPSE feed is daily candle data, not a tick/order-book stream.
- Paper orders are therefore evaluated from the latest loaded candle/quote and periodic refreshes.
- No real exchange matching engine, queue priority, partial fills, or market depth is simulated.
- This is intentionally not connected to TMS/brokers.

## Important architecture rule
Continue to keep paper trading isolated from the main website. `chart.html` is the standalone trading terminal.

## Next phase
Phase 9 — Historical replay and backtesting.
