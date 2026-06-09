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

/** An OB is mitigated when price re-enters its zone after formation */
function isOBMitigated(ob: OrderBlock, candles: Candle[]): boolean {
  for (let i = ob.index + 2; i < candles.length; i++) {
    if (ob.type === 'bull' && candles[i].low <= ob.high && candles[i].low >= ob.low) return true;
    if (ob.type === 'bear' && candles[i].high >= ob.low && candles[i].high <= ob.high) return true;
  }
  return false;
}

export function findOrderBlocks(candles: Candle[]): OrderBlock[] {
  const obs: OrderBlock[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const bodySize = Math.abs(curr.close - curr.open);
    const range = curr.high - curr.low || 0.0001;

    // Bearish OB: bullish candle followed by strong bearish impulse
    if (prev.close > prev.open && curr.close < curr.open && bodySize / range > 0.55) {
      const strength = Math.min(3, Math.ceil(bodySize / range * 3));
      obs.push({ high: prev.high, low: prev.low, type: 'bear', strength, index: i - 1 });
    }
    // Bullish OB: bearish candle followed by strong bullish impulse
    if (prev.close < prev.open && curr.close > curr.open && bodySize / range > 0.55) {
      const strength = Math.min(3, Math.ceil(bodySize / range * 3));
      obs.push({ high: prev.high, low: prev.low, type: 'bull', strength, index: i - 1 });
    }
  }
  // Only unmitigated OBs are actionable — filter then take most recent 6
  return obs.filter(ob => !isOBMitigated(ob, candles)).slice(-6);
}

/** A FVG is filled when price passes through the gap after formation */
function isFVGFilled(fvg: FVG, candles: Candle[]): boolean {
  for (let i = fvg.index + 1; i < candles.length; i++) {
    if (fvg.type === 'bull' && candles[i].low <= fvg.start) return true;
    if (fvg.type === 'bear' && candles[i].high >= fvg.end) return true;
  }
  return false;
}

export function findFairValueGaps(candles: Candle[]): FVG[] {
  const fvgs: FVG[] = [];
  for (let i = 2; i < candles.length; i++) {
    const prev2 = candles[i - 2];
    const curr = candles[i];
    // Bullish FVG: gap between prev2 high and curr low
    if (prev2.high < curr.low) {
      fvgs.push({ start: prev2.high, end: curr.low, type: 'bull', index: i });
    }
    // Bearish FVG: gap between curr high and prev2 low
    if (prev2.low > curr.high) {
      fvgs.push({ start: curr.high, end: prev2.low, type: 'bear', index: i });
    }
  }
  // Only unfilled FVGs are relevant
  return fvgs.filter(fvg => !isFVGFilled(fvg, candles)).slice(-6);
}

export function findLiquidityPools(candles: Candle[]): LiquidityPool[] {
  const pools: LiquidityPool[] = [];
  const highs = findSwingHighs(candles, 3);
  const lows = findSwingLows(candles, 3);
  const tolerance = 0.002; // 0.2% price tolerance for "equal" highs/lows

  // Equal highs = Buy Side Liquidity (BSL) above current price
  for (let i = 0; i < highs.length - 1; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      if (Math.abs(highs[i].price - highs[j].price) / highs[i].price < tolerance) {
        pools.push({ price: (highs[i].price + highs[j].price) / 2, type: 'BSL', strength: 2 });
        break;
      }
    }
  }
  // Equal lows = Sell Side Liquidity (SSL) below current price
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
  const last4 = bos.slice(-4);
  const bullCount = last4.filter(b => b.type === 'bullish').length;
  const bearCount = last4.filter(b => b.type === 'bearish').length;
  if (bullCount >= 3) return 'bullish';
  if (bearCount >= 3) return 'bearish';
  // Also check last CHoCH direction
  const choch = detectCHoCH(candles);
  if (choch.length > 0) {
    const lastChoch = choch[choch.length - 1];
    if (bullCount === bearCount) return lastChoch.type === 'bullish' ? 'bullish' : 'bearish';
  }
  return 'ranging';
}

export function analyzeStructure(symbol: string, timeframe: string, candles: Candle[]): MarketStructure {
  const allBOS = detectBOS(candles);
  const allCHoCH = detectCHoCH(candles);
  return {
    symbol,
    timeframe,
    trend: determineTrend(candles),
    swingHighs: findSwingHighs(candles).slice(-5),
    swingLows: findSwingLows(candles).slice(-5),
    bos: allBOS.slice(-5),
    choch: allCHoCH.slice(-3),
    orderBlocks: findOrderBlocks(candles),
    fvgs: findFairValueGaps(candles),
    liquidityPools: findLiquidityPools(candles),
  };
}
