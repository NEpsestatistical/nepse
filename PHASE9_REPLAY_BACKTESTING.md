# Phase 9 — Historical Replay & Backtesting

## Completed
- Historical replay on the active chart only.
- Future candles are hidden from the chart while replay is active.
- Play/pause, step backward/forward, speed controls and replay-position slider.
- Replay account is isolated from the normal Phase 8 paper account.
- Manual replay Buy/Sell orders execute at the visible candle close only.
- Replay cash, position, equity and trade journal.
- Reset replay account without changing normal paper trading.
- EMA-crossover backtest with configurable fast/slow periods, starting cash and fees.
- Backtest entries/exits execute at the next candle open after a crossover signal, avoiding look-ahead bias.
- Backtest statistics: net P&L, trade count, win rate, profit factor, max drawdown and average trade.
- Backtest trade table.

## Limitations
- Current NEPSE source is daily OHLCV, so replay is daily-bar replay, not tick/intraday replay.
- Replay currently operates on the active chart; multi-chart replay synchronization is not added.
- Replay manual fills use candle close and do not model queue priority, depth or partial fills.
- The built-in strategy backtest is intentionally limited to EMA crossover; a full strategy builder belongs in a later enhancement if desired.
- No TMS/broker integration was added. That remains Phase 10.
