# Phase 2 — Indicators

This checkpoint adds a standalone modular indicator system to `chart.html`.

Implemented categories: Trend, Momentum, Oscillators, Volatility, Volume, Market Structure.

The indicator calculations run entirely from the existing OHLCV candles supplied by the project's existing NEPSE worker. Indicator selections/settings are persisted under the chart app's `ntc_` localStorage namespace.

Phase 2 intentionally does not add TMS/broker integration, paper trading, alerts, replay, DOM, multi-chart layouts, or new market-data sources.
