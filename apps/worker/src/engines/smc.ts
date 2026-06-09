import type { Candle, SwingPoint, OrderBlock, FVG, LiquidityPool, MarketStructure } from '../types';

export function findSwingHighs(candles: Candle[], range = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = range; i < candles.length - range; i++) {
    let isHigh = true;
    for (let j = 1; j <= range; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) swings.push({ price: candles[i].high, index: i, type: 'high' });
  }
  return swings;
}

export function findSwingLows(candles: Candle[], range = 2): SwingPoint[] {
  const swings: SwingPoint[] = [];
  for (let i = range; i < candles.length - range; i++) {
    let isLow = true;
    for (let j = 1; j <= range; j++) {
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) {
        isLow = false;
        break;
      }
    }
    if (isLow) swings.push({ price: candles[i].low, index: i, type: 'low' });
  }
  return swings;
}

export function detectBOS(candles: Candle[]): MarketStructure['bos'] {
  const highs = findSwingHighs(candles);
  const lows = findSwingLows(candles);
  const events: MarketStructure['bos'] = [];

  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price > highs[i - 1].price) {
      events.push({ type: 'bullish', price: highs[i].price, index: highs[i].index });
    }
  }
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price < lows[i - 1].price) {
      events.push({ type: 'bearish', price: lows[i].price, index: lows[i].index });
    }
  }
  return events.sort((a, b) => a.index - b.index);
}

export function detectCHoCH(candles: Candle[]): MarketStructure['choch'] {
  const bos = detectBOS(candles);
  const choch: MarketStructure['choch'] = [];
  for (let i = 1; i < bos.length; i++) {
    if (bos[i].type !== bos[i - 1].type) {
      choch.push({ type: bos[i].type, price: bos[i].price, index: bos[i].index });
    }
  }
  return choch;
}

export function findOrderBlocks(candles: Candle[]): OrderBlock[] {
  const obs: OrderBlock[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];
    // Bearish OB: bullish candle followed by strong bearish move
    if (prev.close > prev.open && curr.close < curr.open && curr.open - curr.close > (curr.high - curr.low) * 0.6) {
      const strength = Math.min(3, Math.floor((curr.open - curr.close) / (curr.high - curr.low) * 3) + 1);
      obs.push({ high: prev.high, low: prev.low, type: 'bear', strength, index: i - 1 });
    }
    // Bullish OB: bearish candle followed by strong bullish move
    if (prev.close < prev.open && curr.close > curr.open && curr.close - curr.open > (curr.high - curr.low) * 0.6) {
      const strength = Math.min(3, Math.floor((curr.close - curr.open) / (curr.high - curr.low) * 3) + 1);
      obs.push({ high: prev.high, low: prev.low, type: 'bull', strength, index: i - 1 });
    }
  }
  return obs.slice(-10); // keep most recent 10
}

export function findFairValueGaps(candles: Candle[]): FVG[] {
  const fvgs: FVG[] = [];
  for (let i = 2; i < candles.length; i++) {
    const prev2 = candles[i - 2];
    const curr = candles[i];
    // Bullish FVG: gap up (prev2 high < curr low)
    if (prev2.high < curr.low) {
      fvgs.push({ start: prev2.high, end: curr.low, type: 'bull', index: i });
    }
    // Bearish FVG: gap down (prev2 low > curr high)
    if (prev2.low > curr.high) {
      fvgs.push({ start: curr.high, end: prev2.low, type: 'bear', index: i });
    }
  }
  return fvgs.slice(-8);
}

export function findLiquidityPools(candles: Candle[]): LiquidityPool[] {
  const pools: LiquidityPool[] = [];
  const highs = findSwingHighs(candles, 3);
  const lows = findSwingLows(candles, 3);
  const tolerance = 0.002; // 0.2% tolerance for equal highs/lows

  // Equal highs = Buy Side Liquidity (BSL)
  for (let i = 0; i < highs.length - 1; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      if (Math.abs(highs[i].price - highs[j].price) / highs[i].price < tolerance) {
        pools.push({ price: (highs[i].price + highs[j].price) / 2, type: 'BSL', strength: 2 });
        break;
      }
    }
  }
  // Equal lows = Sell Side Liquidity (SSL)
  for (let i = 0; i < lows.length - 1; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      if (Math.abs(lows[i].price - lows[j].price) / lows[i].price < tolerance) {
        pools.push({ price: (lows[i].price + lows[j].price) / 2, type: 'SSL', strength: 2 });
        break;
      }
    }
  }
  return pools.slice(-6);
}

export function determineTrend(candles: Candle[]): 'bullish' | 'bearish' | 'ranging' {
  const bos = detectBOS(candles);
  if (bos.length === 0) return 'ranging';
  const last3 = bos.slice(-3);
  const bullCount = last3.filter(b => b.type === 'bullish').length;
  const bearCount = last3.filter(b => b.type === 'bearish').length;
  if (bullCount >= 2) return 'bullish';
  if (bearCount >= 2) return 'bearish';
  return 'ranging';
}

export function analyzeStructure(symbol: string, timeframe: string, candles: Candle[]): MarketStructure {
  return {
    symbol,
    timeframe,
    trend: determineTrend(candles),
    swingHighs: findSwingHighs(candles).slice(-5),
    swingLows: findSwingLows(candles).slice(-5),
    bos: detectBOS(candles).slice(-5),
    choch: detectCHoCH(candles).slice(-3),
    orderBlocks: findOrderBlocks(candles),
    fvgs: findFairValueGaps(candles),
    liquidityPools: findLiquidityPools(candles),
  };
}
