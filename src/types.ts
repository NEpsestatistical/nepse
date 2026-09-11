export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1H' | '4H' | '1D' | '1W' | '1M';

export interface Candle {
  time: number; // timestamp in seconds or string 'YYYY-MM-DD'
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockSymbol {
  symbol: string;
  name: string;
  sector: string;
  ltp: number;
  change: number;
  changePercent: number;
  high52: number;
  low52: number;
  volume: number;
}

export type DrawingToolType =
  | 'cursor'
  | 'trendline'
  | 'ray'
  | 'horizLine'
  | 'vertLine'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'text'
  | 'measure'
  | 'longPos'
  | 'shortPos'
  | 'fibonacci';

export interface Point {
  time: number;
  price: number;
}

export interface DrawingObject {
  id: string;
  type: DrawingToolType;
  points: Point[];
  color: string;
  lineWidth: number;
  text?: string;
  fibLevels?: number[];
  selected?: boolean;
}

export type IndicatorType =
  | 'SMA'
  | 'EMA'
  | 'WMA'
  | 'VWAP'
  | 'RSI'
  | 'MACD'
  | 'Bollinger'
  | 'Stochastic'
  | 'ATR'
  | 'Volume';

export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  enabled: boolean;
  params: {
    period?: number;
    period2?: number;
    period3?: number;
    stdDev?: number;
    fastPeriod?: number;
    slowPeriod?: number;
    signalPeriod?: number;
    color?: string;
  };
}

export interface PortfolioHolding {
  id: string;
  symbol: string;
  shares: number;
  buyPrice: number;
  buyDate: string;
  notes?: string;
}

export interface Transaction {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  date: string;
  totalAmount: number;
  commission: number;
}
