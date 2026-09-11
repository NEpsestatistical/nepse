import { Candle } from '../types';

export function calculateSMA(data: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j].close;
      }
      result.push(sum / period);
    }
  }
  return result;
}

export function calculateEMA(data: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  let prevEMA: number | null = null;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += data[j].close;
      }
      prevEMA = sum / period;
      result.push(prevEMA);
    } else {
      if (prevEMA !== null) {
        prevEMA = (data[i].close - prevEMA) * multiplier + prevEMA;
        result.push(prevEMA);
      } else {
        result.push(null);
      }
    }
  }
  return result;
}

export function calculateWMA(data: Candle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const denominator = (period * (period + 1)) / 2;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - period + 1 + j].close * (j + 1);
      }
      result.push(sum / denominator);
    }
  }
  return result;
}

export function calculateVWAP(data: Candle[]): (number | null)[] {
  const result: (number | null)[] = [];
  let cumulativeTypicalVolume = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumulativeTypicalVolume += typicalPrice * c.volume;
    cumulativeVolume += c.volume;
    if (cumulativeVolume === 0) {
      result.push(c.close);
    } else {
      result.push(cumulativeTypicalVolume / cumulativeVolume);
    }
  }
  return result;
}

export function calculateRSI(data: Candle[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(null);
      continue;
    }
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i < period) {
      gains += gain;
      losses += loss;
      result.push(null);
    } else if (i === period) {
      gains += gain;
      losses += loss;
      const avgGain = gains / period;
      const avgLoss = losses / period;
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      }
    } else {
      const prevGain = (result[i - 1] as number) ? (gains * (period - 1) + gain) / period : gain;
      // standard Wilder smoothing approximation
      const avgGain = (gains * (period - 1) + gain) / period;
      const avgLoss = (losses * (period - 1) + loss) / period;
      gains = avgGain;
      losses = avgLoss;
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        result.push(100 - 100 / (1 + rs));
      }
    }
  }
  return result;
}

export function calculateMACD(
  data: Candle[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
) {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  const macdLine: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    const f = fastEMA[i];
    const s = slowEMA[i];
    if (f !== null && s !== null) {
      macdLine.push(f - s);
    } else {
      macdLine.push(null);
    }
  }

  // Calculate signal line (EMA of macdLine)
  // We can convert macdLine into pseudo candles to use calculateEMA
  const validMacdCandles: Candle[] = macdLine.map((val) => ({
    time: 0,
    open: val || 0,
    high: val || 0,
    low: val || 0,
    close: val || 0,
    volume: 0,
  }));
  const signalLineRaw = calculateEMA(validMacdCandles, signalPeriod);
  const signalLine = signalLineRaw.map((val, idx) => (macdLine[idx] === null ? null : val));
  const histogram = macdLine.map((m, i) => (m !== null && signalLine[i] !== null ? m - (signalLine[i] as number) : null));

  return { macdLine, signalLine, histogram };
}

export function calculateBollingerBands(data: Candle[], period: number = 20, stdDevMultiplier: number = 2) {
  const sma = calculateSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    const mean = sma[i];
    if (mean === null || i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      let sumSqDiff = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const diff = data[j].close - mean;
        sumSqDiff += diff * diff;
      }
      const stDev = Math.sqrt(sumSqDiff / period);
      upper.push(mean + stDev * stdDevMultiplier);
      lower.push(mean - stDev * stdDevMultiplier);
    }
  }
  return { upper, middle: sma, lower };
}

export function calculateStochastic(data: Candle[], kPeriod: number = 14, dPeriod: number = 3) {
  const kLine: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < kPeriod - 1) {
      kLine.push(null);
    } else {
      let highestHigh = -Infinity;
      let lowestLow = Infinity;
      for (let j = i - kPeriod + 1; j <= i; j++) {
        if (data[j].high > highestHigh) highestHigh = data[j].high;
        if (data[j].low < lowestLow) lowestLow = data[j].low;
      }
      const currentClose = data[i].close;
      const denom = highestHigh - lowestLow;
      const k = denom === 0 ? 50 : ((currentClose - lowestLow) / denom) * 100;
      kLine.push(k);
    }
  }

  const kCandles: Candle[] = kLine.map((val) => ({
    time: 0,
    open: val || 0,
    high: val || 0,
    low: val || 0,
    close: val || 0,
    volume: 0,
  }));
  const dLineRaw = calculateSMA(kCandles, dPeriod);
  const dLine = dLineRaw.map((val, idx) => (kLine[idx] === null ? null : val));

  return { kLine, dLine };
}

export function calculateATR(data: Candle[], period: number = 14): (number | null)[] {
  const trs: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    if (i === 0) {
      trs.push(c.high - c.low);
    } else {
      const prevClose = data[i - 1].close;
      const tr = Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
      trs.push(tr);
    }
  }

  const atr: (number | null)[] = [];
  let sumTr = 0;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sumTr += trs[i];
      atr.push(null);
    } else if (i === period - 1) {
      sumTr += trs[i];
      atr.push(sumTr / period);
    } else {
      const prevAtr = atr[i - 1] as number;
      const currentAtr = (prevAtr * (period - 1) + trs[i]) / period;
      atr.push(currentAtr);
    }
  }
  return atr;
}
