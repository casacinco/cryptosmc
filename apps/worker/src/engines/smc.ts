import type {
  Candle, SwingPoint, OrderBlock, FVG, LiquidityPool, MarketStructure,
  EnrichedBOS, EnrichedCHoCH, EnrichedOrderBlock, EnrichedFVG, EnrichedLiquidityPool,
  StructureDebugInfo, BacktestResult,
} from '../types';

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

// ─── FIX 1: Structure Debug Info ──────────────────────────────────────────────

export function getStructureDebugInfo(candles: Candle[], timeframe: string): StructureDebugInfo {
  const structure = analyzeStructure('', timeframe, candles);
  const allSwingHighs = findSwingHighs(candles);
  const allSwingLows = findSwingLows(candles);
  const allBOS = detectBOS(candles);
  const allCHoCH = detectCHoCH(candles);

  // Structure quality: diversity of signals (not all same direction)
  const bosDirectionRatio = allBOS.length > 0
    ? Math.abs(allBOS.filter(b => b.type === 'bullish').length - allBOS.filter(b => b.type === 'bearish').length) / allBOS.length
    : 0;
  const structureQuality = Math.round((1 - bosDirectionRatio) * 50 + (Math.min(allBOS.length, 10) / 10) * 50);

  // Trend strength: dominance of one direction in recent BOS
  const last5BOS = allBOS.slice(-5);
  const bullBOS = last5BOS.filter(b => b.type === 'bullish').length;
  const bearBOS = last5BOS.filter(b => b.type === 'bearish').length;
  const trendStrength = last5BOS.length > 0 ? Math.round(Math.max(bullBOS, bearBOS) / last5BOS.length * 100) : 50;

  // Market efficiency: price range covered vs candle count (higher = more directional)
  const priceRange = candles.length > 0 ? Math.abs(candles[candles.length - 1].close - candles[0].close) / candles[0].close * 100 : 0;
  const marketEfficiency = Math.min(100, Math.round(priceRange / (candles.length / 10)));

  return {
    timeframe,
    candlesAnalyzed: candles.length,
    swingHighsDetected: allSwingHighs.length,
    swingLowsDetected: allSwingLows.length,
    bosCount: allBOS.length,
    chochCount: allCHoCH.length,
    obCount: structure.orderBlocks.length,
    fvgCount: structure.fvgs.length,
    structureQuality,
    trendStrength,
    marketEfficiency,
  };
}

// ─── Enrichment Functions ─────────────────────────────────────────────────────

/** Returns enriched BOS with candle timestamps and strength scores (FIX 5: 4-factor breakdown) */
export function enrichBOS(
  candles: Candle[],
  bos: MarketStructure['bos'],
  timeframe: string,
): EnrichedBOS[] {
  const highs = findSwingHighs(candles);
  const lows = findSwingLows(candles);

  return bos.map((b, i) => {
    const candle = candles[b.index] ?? candles[candles.length - 1];
    const candleTime = candle ? candle.t : Date.now();

    // Find the previous swing that was broken
    let brokenSwingPrice = b.price;
    if (b.type === 'bullish') {
      const prevHighs = highs.filter(h => h.index < b.index);
      if (prevHighs.length > 0) {
        brokenSwingPrice = prevHighs[prevHighs.length - 1].price;
      }
    } else {
      const prevLows = lows.filter(l => l.index < b.index);
      if (prevLows.length > 0) {
        brokenSwingPrice = prevLows[prevLows.length - 1].price;
      }
    }

    // FIX 5: 4-factor strength breakdown
    // Displacement (40%): % move from broken swing to break candle
    const displacement = Math.min(40, Math.abs(b.price - brokenSwingPrice) / (brokenSwingPrice || 1) * 400);

    // Volume (25%): break candle volume vs average of prior 10 candles
    const priorSlice = candles.slice(Math.max(0, b.index - 10), b.index);
    const avgVol = priorSlice.length > 0
      ? priorSlice.reduce((s, c) => s + c.volume, 0) / priorSlice.length
      : 1;
    const breakCandle = candles[b.index];
    const volumeScore = breakCandle ? Math.min(25, (breakCandle.volume / (avgVol || 1)) * 12.5) : 0;

    // Distance (20%): how far the broken swing was from current structure
    const distancePct = brokenSwingPrice > 0 ? Math.abs(b.price - brokenSwingPrice) / brokenSwingPrice * 100 : 0;
    const distanceScore = Math.min(20, distancePct * 4);

    // Speed (15%): simplified — full score since we detect at break candle
    const speedScore = 15;

    const total = Math.round(displacement + volumeScore + distanceScore + speedScore);

    const strengthBreakdown = {
      displacement: Math.round(displacement),
      volume: Math.round(volumeScore),
      distance: Math.round(distanceScore),
      speed: speedScore,
      total: Math.min(100, total),
    };

    const strengthScore = Math.min(
      100,
      Math.max(0, Math.round(Math.abs(b.price - brokenSwingPrice) / (brokenSwingPrice || 1) * 1000)),
    );

    return {
      id: `BOS-${String(i + 1).padStart(3, '0')}`,
      timeframe,
      type: b.type,
      breakPrice: b.price,
      brokenSwingPrice,
      candleTime,
      strengthScore,
      strengthBreakdown,
    };
  });
}

/** Returns enriched CHoCH */
export function enrichCHoCH(
  candles: Candle[],
  choch: MarketStructure['choch'],
  timeframe: string,
  trend: MarketStructure['trend'],
): EnrichedCHoCH[] {
  const allBOS = detectBOS(candles);

  return choch.map((c, i) => {
    const candle = candles[c.index] ?? candles[candles.length - 1];
    const candleTime = candle ? candle.t : Date.now();

    // Count same-direction BOS before this CHoCH
    const sameDirBOSBefore = allBOS.filter(b => b.index < c.index && b.type === c.type).length;
    const confidence = Math.min(100, 50 + sameDirBOSBefore * 10);

    // Determine previous trend (opposite of CHoCH direction implies a flip)
    const previousTrend: 'bullish' | 'bearish' | 'ranging' =
      c.type === 'bullish' ? 'bearish' : c.type === 'bearish' ? 'bullish' : 'ranging';

    return {
      id: `CHOCH-${String(i + 1).padStart(3, '0')}`,
      timeframe,
      type: c.type,
      breakPrice: c.price,
      previousTrend,
      candleTime,
      confidence,
    };
  });
}

/** Returns enriched OBs with displacement %, touch count, score */
export function enrichOrderBlocks(candles: Candle[], obs: OrderBlock[]): EnrichedOrderBlock[] {
  return obs.map((ob, i) => {
    // Displacement: max move in 3 candles after OB
    let displacementPct = 0;
    const obEdge = ob.type === 'bull' ? ob.high : ob.low;
    for (let k = ob.index + 1; k <= ob.index + 3 && k < candles.length; k++) {
      const c = candles[k];
      if (ob.type === 'bull') {
        const disp = (c.high - obEdge) / (obEdge || 1) * 100;
        if (disp > displacementPct) displacementPct = disp;
      } else {
        const disp = (obEdge - c.low) / (obEdge || 1) * 100;
        if (disp > displacementPct) displacementPct = disp;
      }
    }

    // Touch count: how many times price entered the OB zone after formation
    let touchCount = 0;
    for (let k = ob.index + 2; k < candles.length; k++) {
      if (ob.type === 'bull' && candles[k].low <= ob.high && candles[k].low >= ob.low) touchCount++;
      if (ob.type === 'bear' && candles[k].high >= ob.low && candles[k].high <= ob.high) touchCount++;
    }

    const mitigated = touchCount > 0;

    const candleTime = candles[ob.index] ? candles[ob.index].t : Date.now();

    const score = Math.min(
      100,
      Math.round(
        ob.strength * 25 +
        (displacementPct > 3 ? 25 : displacementPct * 8) +
        (touchCount === 1 ? 15 : touchCount === 0 ? 5 : 0) +
        (mitigated ? 0 : 20),
      ),
    );

    return {
      id: `OB-${String(i + 1).padStart(3, '0')}`,
      type: ob.type,
      high: ob.high,
      low: ob.low,
      candleTime,
      displacementPct: Math.round(displacementPct * 100) / 100,
      mitigated,
      touchCount,
      strength: ob.strength,
      score,
    };
  });
}

/** Returns enriched FVGs with size %, fill % */
export function enrichFVGs(candles: Candle[], fvgs: FVG[]): EnrichedFVG[] {
  return fvgs.map((fvg, i) => {
    const sizePct = Math.round((fvg.end - fvg.start) / (fvg.start || 1) * 10000) / 100;
    const gapSize = fvg.end - fvg.start || 0.0001;

    let fillPct = 0;
    let filled = false;

    for (let k = fvg.index + 1; k < candles.length; k++) {
      const c = candles[k];
      if (fvg.type === 'bull') {
        // Bull FVG: gap is above (start=prev2.high, end=curr.low)
        // Filled when price drops back below start
        if (c.low <= fvg.start) {
          fillPct = 100;
          filled = true;
          break;
        }
        // Partial: how far has price penetrated into the gap from the top?
        const lowestLow = c.low;
        const partial = Math.min(100, Math.max(0, (fvg.end - lowestLow) / gapSize * 100));
        if (partial > fillPct) fillPct = partial;
      } else {
        // Bear FVG: gap is below (start=curr.high, end=prev2.low)
        // Filled when price rises above end
        if (c.high >= fvg.end) {
          fillPct = 100;
          filled = true;
          break;
        }
        // Partial: how far has price risen into the gap?
        const highestHigh = c.high;
        const partial = Math.min(100, Math.max(0, (highestHigh - fvg.start) / gapSize * 100));
        if (partial > fillPct) fillPct = partial;
      }
    }

    fillPct = Math.round(fillPct * 100) / 100;

    const score = Math.min(
      100,
      Math.round(
        (sizePct > 0.5 ? 30 : sizePct * 60) +
        (filled ? 0 : 40) +
        30,
      ),
    );

    const candleTime = candles[fvg.index] ? candles[fvg.index].t : Date.now();

    return {
      id: `FVG-${String(i + 1).padStart(3, '0')}`,
      type: fvg.type,
      start: fvg.start,
      end: fvg.end,
      sizePct,
      fillPct,
      filled,
      candleTime,
      score,
    };
  });
}

/** Returns enriched liquidity pools with distance from current price */
export function enrichLiquidityPools(candles: Candle[], pools: LiquidityPool[]): EnrichedLiquidityPool[] {
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 1;

  return pools.map(pool => {
    const distancePct = Math.round(Math.abs(pool.price - currentPrice) / currentPrice * 10000) / 100;
    const relevance: 'high' | 'medium' | 'low' =
      distancePct < 1 ? 'high' : distancePct < 3 ? 'medium' : 'low';

    return {
      type: pool.type,
      price: pool.price,
      distanceFromPrice: distancePct,
      distancePct,
      strength: pool.strength,
      relevance,
    };
  });
}

// ─── FIX 7: Backtest Functions ────────────────────────────────────────────────

export function backtestOrderBlocks(candles: Candle[]): BacktestResult {
  const obs = findOrderBlocks(candles.slice(0, Math.floor(candles.length * 0.7)));
  let wins = 0, losses = 0, totalRR = 0;
  const testCandles = candles.slice(Math.floor(candles.length * 0.7));

  for (const ob of obs) {
    const touched = testCandles.some(c =>
      ob.type === 'bull' ? (c.low <= ob.high && c.low >= ob.low) :
      (c.high >= ob.low && c.high <= ob.high)
    );
    if (!touched) continue;
    const touchIdx = testCandles.findIndex(c =>
      ob.type === 'bull' ? (c.low <= ob.high && c.low >= ob.low) :
      (c.high >= ob.low && c.high <= ob.high)
    );
    if (touchIdx < 0 || touchIdx >= testCandles.length - 1) continue;
    const obSize = ob.high - ob.low;
    const afterCandles = testCandles.slice(touchIdx + 1, touchIdx + 6);
    const won = ob.type === 'bull'
      ? afterCandles.some(c => c.close > ob.high + obSize)
      : afterCandles.some(c => c.close < ob.low - obSize);
    if (won) { wins++; totalRR += 2; }
    else { losses++; totalRR += -1; }
  }
  const total = wins + losses;
  return {
    signalType: 'OB',
    totalSignals: obs.length,
    wins,
    losses,
    winRate: total > 0 ? Math.round(wins / total * 100) : 0,
    avgRR: total > 0 ? Math.round(totalRR / total * 100) / 100 : 0,
    sampleNote: `Based on ${candles.length} candles (70/30 split)`,
  };
}

export function backtestFVGs(candles: Candle[]): BacktestResult {
  const fvgs = findFairValueGaps(candles.slice(0, Math.floor(candles.length * 0.7)));
  let wins = 0, losses = 0, totalRR = 0;
  const testCandles = candles.slice(Math.floor(candles.length * 0.7));

  for (const fvg of fvgs) {
    const gapSize = fvg.end - fvg.start;
    const touchIdx = testCandles.findIndex(c =>
      fvg.type === 'bull' ? (c.low <= fvg.end && c.low >= fvg.start) :
      (c.high >= fvg.start && c.high <= fvg.end)
    );
    if (touchIdx < 0 || touchIdx >= testCandles.length - 1) continue;
    const afterCandles = testCandles.slice(touchIdx + 1, touchIdx + 5);
    const won = fvg.type === 'bull'
      ? afterCandles.some(c => c.close > fvg.end + gapSize)
      : afterCandles.some(c => c.close < fvg.start - gapSize);
    if (won) { wins++; totalRR += 2; }
    else { losses++; totalRR += -1; }
  }
  const total = wins + losses;
  return {
    signalType: 'FVG',
    totalSignals: fvgs.length,
    wins,
    losses,
    winRate: total > 0 ? Math.round(wins / total * 100) : 0,
    avgRR: total > 0 ? Math.round(totalRR / total * 100) / 100 : 0,
    sampleNote: `Based on ${candles.length} candles (70/30 split)`,
  };
}
