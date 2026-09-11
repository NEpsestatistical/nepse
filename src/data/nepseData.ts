import { Candle, StockSymbol, Timeframe } from '../types';

export const NEPSE_STOCKS: StockSymbol[] = [
  { symbol: 'NABIL', name: 'Nabil Bank Limited', sector: 'Commercial Banks', ltp: 840.0, change: 15.5, changePercent: 1.88, high52: 950, low52: 680, volume: 142500 },
  { symbol: 'NICA', name: 'NIC Asia Bank Ltd.', sector: 'Commercial Banks', ltp: 522.0, change: -4.0, changePercent: -0.76, high52: 640, low52: 430, volume: 98400 },
  { symbol: 'HDL', name: 'Himalayan Distillery Ltd.', sector: 'Manufacturing & Processing', ltp: 1850.0, change: 42.0, changePercent: 2.32, high52: 2100, low52: 1350, volume: 64200 },
  { symbol: 'CIT', name: 'Citizen Investment Trust', sector: 'Others', ltp: 2190.0, change: 35.0, changePercent: 1.62, high52: 2450, low52: 1720, volume: 28900 },
  { symbol: 'SHIVM', name: 'Shivam Cements Ltd.', sector: 'Manufacturing & Processing', ltp: 510.0, change: 8.5, changePercent: 1.69, high52: 620, low52: 380, volume: 215000 },
  { symbol: 'GBIME', name: 'Global IME Bank Limited', sector: 'Commercial Banks', ltp: 245.0, change: 2.2, changePercent: 0.91, high52: 290, low52: 210, volume: 189000 },
  { symbol: 'NTC', name: 'Nepal Telecom', sector: 'Others', ltp: 895.0, change: -2.0, changePercent: -0.22, high52: 1020, low52: 780, volume: 45000 },
  { symbol: 'SCB', name: 'Standard Chartered Bank Nepal', sector: 'Commercial Banks', ltp: 680.0, change: 11.0, changePercent: 1.64, high52: 750, low52: 520, volume: 51200 },
  { symbol: 'UNL', name: 'Unilever Nepal Limited', sector: 'Manufacturing & Processing', ltp: 49500.0, change: 500.0, changePercent: 1.02, high52: 54000, low52: 38000, volume: 1200 },
  { symbol: 'CZBIL', name: 'Citizen Bank International', sector: 'Commercial Banks', ltp: 198.0, change: 1.5, changePercent: 0.76, high52: 235, low52: 165, volume: 112000 },
];

export function generateHistoricalData(symbol: string, timeframe: Timeframe): Candle[] {
  // Determine number of candles and interval multiplier based on timeframe
  let count = 150;
  let intervalSeconds = 86400; // 1D

  switch (timeframe) {
    case '1m':
      count = 200;
      intervalSeconds = 60;
      break;
    case '5m':
      count = 200;
      intervalSeconds = 300;
      break;
    case '15m':
      count = 180;
      intervalSeconds = 900;
      break;
    case '30m':
      count = 180;
      intervalSeconds = 1800;
      break;
    case '1H':
      count = 180;
      intervalSeconds = 3600;
      break;
    case '4H':
      count = 150;
      intervalSeconds = 14400;
      break;
    case '1D':
      count = 200;
      intervalSeconds = 86400;
      break;
    case '1W':
      count = 150;
      intervalSeconds = 604800;
      break;
    case '1M':
      count = 120;
      intervalSeconds = 2592000;
      break;
  }

  const stock = NEPSE_STOCKS.find((s) => s.symbol === symbol) || NEPSE_STOCKS[0];
  let basePrice = stock.ltp;

  // Seed pseudo-random generator deterministically based on symbol string
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed += symbol.charCodeAt(i) * (i + 1);
  }
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - count * intervalSeconds;

  // Work backward or forward
  let currentClose = basePrice * (0.75 + random() * 0.4);

  for (let i = 0; i < count; i++) {
    const time = startTime + i * intervalSeconds;
    const volatility = basePrice * 0.015;
    const changePct = (random() - 0.48) * volatility;
    const open = currentClose;
    const close = Math.max(10, open + changePct);
    const high = Math.max(open, close) + random() * (volatility * 0.6);
    const low = Math.min(open, close) - random() * (volatility * 0.6);
    const volume = Math.floor(1000 + random() * 50000);

    candles.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume,
    });

    currentClose = close;
  }

  // Ensure the latest candle matches stock LTP closely
  if (candles.length > 0) {
    candles[candles.length - 1].close = stock.ltp;
    candles[candles.length - 1].high = Math.max(candles[candles.length - 1].high, stock.ltp);
    candles[candles.length - 1].low = Math.min(candles[candles.length - 1].low, stock.ltp);
  }

  return candles;
}
