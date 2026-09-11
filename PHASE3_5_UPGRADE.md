# Phases 3–5 Upgrade Checkpoint

This checkpoint extends the standalone `chart.html` without touching TMS/broker logic or the main portfolio/dashboard application.

## Phase 3 — Drawing tools
Implemented in `js/chart/drawings.js` and `css/chart/drawings.css`:
- Cursor / selection mode
- Trend line
- Ray
- Horizontal line
- Vertical line
- Rectangle
- Fibonacci retracement (0 / 23.6 / 38.2 / 50 / 61.8 / 78.6 / 100)
- Text annotation
- Measure tool (price and percentage delta)
- Undo last drawing
- Hide/show drawings
- Lock/unlock drawings
- Clear all drawings
- Per-symbol localStorage persistence
- Drawings are anchored to chart time/price, so zoom/pan does not permanently distort them

## Phase 4 — Advanced chart types and chart controls
Implemented:
- Renko
- Line Break
- Kagi
- Point & Figure
- Range
- Heikin Ashi retained
- Fit/autoscale
- Logarithmic price scale
- Percentage price scale
- Invert price scale

Price-based chart types are deterministic transforms of the real daily OHLCV feed; no synthetic market data is fetched.

## Phase 5 — Advanced analysis additions
Added to the existing indicator registry:
- Anchored VWAP (configurable lookback anchor)
- Volume Profile summary levels: POC / VAH / VAL

The Volume Profile implementation is a price-bin summary using the available daily OHLCV volume and is intentionally exposed as a lightweight chart overlay rather than pretending to have exchange-level order-flow data.

## Validation
- JavaScript syntax checked with `node --check` for modified chart modules.
- All 58 registered indicators were executed against synthetic OHLCV data with no calculation exceptions.
- All five new price-transform functions were smoke-tested.

## Not included yet
- Broker/TMS integration
- Real intraday data
- Full multi-chart grid layouts
- Full DOM/order book
- Paper trading engine
- Alerts/replay/backtesting
- Advanced automatic pattern recognition
- Full Gann/Elliott drawing suites
