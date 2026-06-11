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

/**
 * Structure state machine — the SMC-correct way to detect BOS/CHoCH.
 *
 * Rules:
 * - A swing is only *confirmed* `range` candles after it forms (fractal confirmation).
 * - BOS  = candle BODY CLOSE beyond the last confirmed swing in the direction of the
 *          current trend (continuation), or the break that establishes trend from ranging.
 * - CHoCH = the FIRST body close against an established trend (trend flip).
 * - Once a swing is broken it is consumed: the next reference must be a swing formed
 *   AFTER the break (prevents repeated breaks of stale levels during strong moves).
 */
export interface StructureEvents {
  bos: MarketStructure['bos'];
  choch: MarketStructure['choch'];
  trend: MarketStructure['trend'];
}

export function detectStructureEvents(candles: Candle[], range = 2): StructureEvents {
  const highs = findSwingHighs(candles, range);
  const lows = findSwingLows(candles, range);
  const bos: MarketStructure['bos'] = [];
  const choch: MarketStructure['choch'] = [];

  let trend: MarketStructure['trend'] = 'ranging';
  let refHigh: SwingPoint | null = null;   // last confirmed swing high (resistance to break)
  let refLow: SwingPoint | null = null;    // last confirmed swing low (support to break)
  let hi = 0, li = 0;                      // pointers into swing arrays
  let minHighIndex = -1, minLowIndex = -1; // swings before a break are stale

  for (let i = 0; i < candles.length; i++) {
    // Promote swings that are confirmed by candle i (swing.index + range <= i)
    while (hi < highs.length && highs[hi].index + range <= i) {
      if (highs[hi].index > minHighIndex) refHigh = highs[hi];
      hi++;
    }
    while (li < lows.length && lows[li].index + range <= i) {
      if (lows[li].index > minLowIndex) refLow = lows[li];
      li++;
    }

    const close = candles[i].close;

    // Body close above last confirmed swing high
    if (refHigh && close > refHigh.price) {
      const ev = { type: 'bullish' as const, price: refHigh.price, index: i };
      if (trend === 'bearish') choch.push(ev);
      else bos.push(ev);
      trend = 'bullish';
      refHigh = null;
      minHighIndex = i; // next reference must form after this break
    }

    // Body close below last confirmed swing low
    if (refLow && close < refLow.price) {
      const ev = { type: 'bearish' as const, price: refLow.price, index: i };
      if (trend === 'bullish') choch.push(ev);
      else bos.push(ev);
      trend = 'bearish';
      refLow = null;
      minLowIndex = i;
    }
  }

  return { bos, choch, trend };
}

export function detectBOS(candles: Candle[]): MarketStructure['bos'] {
  return detectStructureEvents(candles).bos;
}

export function detectCHoCH(candles: Candle[]): MarketStructure['choch'] {
  return detectStructureEvents(candles).choch;
}

/** An OB is mitigated when price re-enters its zone after formation */
function isOBMitigated(ob: OrderBlock, candles: Candle[]): boolean {
  for (let i = ob.index + 2; i < candles.length; i++) {
    if (ob.type === 'bull' && candles[i].low <= ob.high && candles[i].low >= ob.low) return true;
    if (ob.type === 'bear' && candles[i].high >= ob.low && candles[i].high <= ob.high) return true;
  }
  return false;
}

/**
 * Institutional-grade OB detection. A candidate only qualifies when the impulse
 * after it shows real displacement (move >= 1.5× local average range within 3
 * candles). A liquidity sweep right before the OB (stop-hunt) boosts strength —
 * that is the footprint of institutional order placement.
 *
 * Raw variant: ALL qualified OBs across history (including mitigated) — used by
 * the backtest, which needs the historical population, not just live zones.
 */
export function findOrderBlocksRaw(candles: Candle[]): OrderBlock[] {
  const obs: OrderBlock[] = [];
  const SWEEP_LOOKBACK = 10;

  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const bodySize = Math.abs(curr.close - curr.open);
    const range = curr.high - curr.low || 0.0001;
    if (bodySize / range <= 0.55) continue; // impulse candle must be conviction-bodied

    // Local volatility: average true range proxy over the prior 14 candles
    const volSlice = candles.slice(Math.max(0, i - 14), i);
    const avgRange = volSlice.length > 0
      ? volSlice.reduce((s, c) => s + (c.high - c.low), 0) / volSlice.length
      : range;

    // Bearish OB: bullish candle followed by strong bearish impulse
    if (prev.close > prev.open && curr.close < curr.open) {
      // Displacement: within 3 candles price must travel >= 1.5× avgRange below the OB low
      let maxDrop = 0;
      for (let k = i; k <= i + 3 && k < candles.length; k++) {
        maxDrop = Math.max(maxDrop, prev.low - candles[k].low);
      }
      if (maxDrop < avgRange * 1.5) continue; // no displacement → noise, not an OB

      // Sweep: did the OB candle take out the prior N-candle high first (stop-hunt above)?
      const lookback = candles.slice(Math.max(0, i - 1 - SWEEP_LOOKBACK), i - 1);
      const sweptHigh = lookback.length > 0 && prev.high > Math.max(...lookback.map(c => c.high));

      let strength = 1;
      if (maxDrop >= avgRange * 2.5) strength++;   // exceptional displacement
      if (sweptHigh) strength++;                    // institutional stop-hunt footprint
      obs.push({ high: prev.high, low: prev.low, type: 'bear', strength, index: i - 1 });
    }

    // Bullish OB: bearish candle followed by strong bullish impulse
    if (prev.close < prev.open && curr.close > curr.open) {
      let maxRise = 0;
      for (let k = i; k <= i + 3 && k < candles.length; k++) {
        maxRise = Math.max(maxRise, candles[k].high - prev.high);
      }
      if (maxRise < avgRange * 1.5) continue;

      // Sweep: did the OB candle take out the prior N-candle low first (stop-hunt below)?
      const lookback = candles.slice(Math.max(0, i - 1 - SWEEP_LOOKBACK), i - 1);
      const sweptLow = lookback.length > 0 && prev.low < Math.min(...lookback.map(c => c.low));

      let strength = 1;
      if (maxRise >= avgRange * 2.5) strength++;
      if (sweptLow) strength++;
      obs.push({ high: prev.high, low: prev.low, type: 'bull', strength, index: i - 1 });
    }
  }
  return obs;
}

/** Live zones: only unmitigated OBs are actionable — filter then take most recent 6 */
export function findOrderBlocks(candles: Candle[]): OrderBlock[] {
  return findOrderBlocksRaw(candles).filter(ob => !isOBMitigated(ob, candles)).slice(-6);
}

/** A FVG is filled when price passes through the gap after formation */
function isFVGFilled(fvg: FVG, candles: Candle[]): boolean {
  for (let i = fvg.index + 1; i < candles.length; i++) {
    if (fvg.type === 'bull' && candles[i].low <= fvg.start) return true;
    if (fvg.type === 'bear' && candles[i].high >= fvg.end) return true;
  }
  return false;
}

/** Raw variant: all FVGs across history (including filled) — used by the backtest */
export function findFairValueGapsRaw(candles: Candle[]): FVG[] {
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
  return fvgs;
}

export function findFairValueGaps(candles: Candle[]): FVG[] {
  // Only unfilled FVGs are relevant for live zones
  return findFairValueGapsRaw(candles).filter(fvg => !isFVGFilled(fvg, candles)).slice(-6);
}

export function findLiquidityPools(candles: Candle[]): LiquidityPool[] {
  const pools: { price: number; type: 'BSL' | 'SSL'; strength: number; lastIndex: number }[] = [];
  const highs = findSwingHighs(candles, 3);
  const lows = findSwingLows(candles, 3);
  const tolerance = 0.002; // 0.2% price tolerance for "equal" highs/lows

  // Equal highs = Buy Side Liquidity (BSL) above current price
  for (let i = 0; i < highs.length - 1; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      if (Math.abs(highs[i].price - highs[j].price) / highs[i].price < tolerance) {
        pools.push({
          price: (highs[i].price + highs[j].price) / 2,
          type: 'BSL',
          strength: 2,
          lastIndex: Math.max(highs[i].index, highs[j].index),
        });
        break;
      }
    }
  }
  // Equal lows = Sell Side Liquidity (SSL) below current price
  for (let i = 0; i < lows.length - 1; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      if (Math.abs(lows[i].price - lows[j].price) / lows[i].price < tolerance) {
        pools.push({
          price: (lows[i].price + lows[j].price) / 2,
          type: 'SSL',
          strength: 2,
          lastIndex: Math.max(lows[i].index, lows[j].index),
        });
        break;
      }
    }
  }

  // Swept pools are consumed liquidity — once price trades through the level
  // after the pool formed, it is no longer a valid target.
  const active = pools.filter(pool => {
    for (let k = pool.lastIndex + 1; k < candles.length; k++) {
      if (pool.type === 'BSL' && candles[k].high > pool.price) return false;
      if (pool.type === 'SSL' && candles[k].low < pool.price) return false;
    }
    return true;
  });

  return active.map(({ price, type, strength }) => ({ price, type, strength })).slice(-6);
}

export function determineTrend(candles: Candle[]): 'bullish' | 'bearish' | 'ranging' {
  // Trend = final state of the structure state machine (last structural break direction)
  return detectStructureEvents(candles).trend;
}

export function analyzeStructure(symbol: string, timeframe: string, candles: Candle[]): MarketStructure {
  const events = detectStructureEvents(candles);
  return {
    symbol,
    timeframe,
    trend: events.trend,
    swingHighs: findSwingHighs(candles).slice(-5),
    swingLows: findSwingLows(candles).slice(-5),
    bos: events.bos.slice(-5),
    choch: events.choch.slice(-3),
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
  return bos.map((b, i) => {
    const candle = candles[b.index] ?? candles[candles.length - 1];
    const candleTime = candle ? candle.t : Date.now();

    // State machine semantics: b.price = the broken swing level; break candle = candles[b.index]
    const brokenSwingPrice = b.price;
    const breakPrice = candle ? candle.close : b.price;

    // FIX 5: 4-factor strength breakdown
    // Displacement (40%): % move from broken swing to break candle close
    const displacement = Math.min(40, Math.abs(breakPrice - brokenSwingPrice) / (brokenSwingPrice || 1) * 400);

    // Volume (25%): break candle volume vs average of prior 10 candles
    const priorSlice = candles.slice(Math.max(0, b.index - 10), b.index);
    const avgVol = priorSlice.length > 0
      ? priorSlice.reduce((s, c) => s + c.volume, 0) / priorSlice.length
      : 1;
    const breakCandle = candles[b.index];
    const volumeScore = breakCandle ? Math.min(25, (breakCandle.volume / (avgVol || 1)) * 12.5) : 0;

    // Distance (20%): how far the close traveled beyond the broken swing
    const distancePct = brokenSwingPrice > 0 ? Math.abs(breakPrice - brokenSwingPrice) / brokenSwingPrice * 100 : 0;
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
      Math.max(0, Math.round(Math.abs(breakPrice - brokenSwingPrice) / (brokenSwingPrice || 1) * 1000)),
    );

    return {
      id: `BOS-${String(i + 1).padStart(3, '0')}`,
      timeframe,
      type: b.type,
      breakPrice,
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

const MIN_RELIABLE_SAMPLE = 10;

/**
 * Walk-forward OB backtest over the full history.
 * Trade simulation per OB: first touch after formation = entry at zone edge;
 * stop = 25% of zone height beyond the zone; target = 2× zone height (2R).
 * Resolution is sequential — whichever of stop/target is CLOSED through first wins.
 * Unresolved trades (neither hit within 15 candles) are excluded, not guessed.
 */
export function backtestOrderBlocks(candles: Candle[]): BacktestResult {
  const obs = findOrderBlocksRaw(candles);
  let wins = 0, losses = 0, totalRR = 0;

  for (const ob of obs) {
    const obSize = ob.high - ob.low || 0.0001;
    // First touch at least 4 candles after formation (skip the displacement leg itself)
    let touchIdx = -1;
    for (let k = ob.index + 4; k < candles.length; k++) {
      const c = candles[k];
      if (ob.type === 'bull' && c.low <= ob.high && c.low >= ob.low) { touchIdx = k; break; }
      if (ob.type === 'bear' && c.high >= ob.low && c.high <= ob.high) { touchIdx = k; break; }
    }
    if (touchIdx < 0 || touchIdx >= candles.length - 1) continue;

    const stop = ob.type === 'bull' ? ob.low - obSize * 0.25 : ob.high + obSize * 0.25;
    const target = ob.type === 'bull' ? ob.high + obSize * 2 : ob.low - obSize * 2;

    // Sequential resolution: first close through stop or target decides
    for (let k = touchIdx + 1; k < Math.min(candles.length, touchIdx + 16); k++) {
      const c = candles[k];
      if (ob.type === 'bull') {
        if (c.close <= stop) { losses++; totalRR += -1; break; }
        if (c.close >= target) { wins++; totalRR += 2; break; }
      } else {
        if (c.close >= stop) { losses++; totalRR += -1; break; }
        if (c.close <= target) { wins++; totalRR += 2; break; }
      }
    }
  }

  const total = wins + losses;
  const reliable = total >= MIN_RELIABLE_SAMPLE;
  return {
    signalType: 'OB',
    totalSignals: obs.length,
    wins,
    losses,
    winRate: total > 0 ? Math.round(wins / total * 100) : 0,
    avgRR: total > 0 ? Math.round(totalRR / total * 100) / 100 : 0,
    reliable,
    sampleNote: reliable
      ? `${total} resolved trades over ${candles.length} candles (walk-forward, 2R target / 0.25-zone stop)`
      : `Only ${total} resolved trades — below ${MIN_RELIABLE_SAMPLE}, NOT statistically meaningful`,
  };
}

/** Walk-forward FVG backtest — same simulation rules as OBs */
export function backtestFVGs(candles: Candle[]): BacktestResult {
  const fvgs = findFairValueGapsRaw(candles);
  let wins = 0, losses = 0, totalRR = 0;

  for (const fvg of fvgs) {
    const gapSize = fvg.end - fvg.start || 0.0001;
    let touchIdx = -1;
    for (let k = fvg.index + 1; k < candles.length; k++) {
      const c = candles[k];
      if (fvg.type === 'bull' && c.low <= fvg.end && c.low >= fvg.start) { touchIdx = k; break; }
      if (fvg.type === 'bear' && c.high >= fvg.start && c.high <= fvg.end) { touchIdx = k; break; }
    }
    if (touchIdx < 0 || touchIdx >= candles.length - 1) continue;

    const stop = fvg.type === 'bull' ? fvg.start - gapSize * 0.25 : fvg.end + gapSize * 0.25;
    const target = fvg.type === 'bull' ? fvg.end + gapSize * 2 : fvg.start - gapSize * 2;

    for (let k = touchIdx + 1; k < Math.min(candles.length, touchIdx + 16); k++) {
      const c = candles[k];
      if (fvg.type === 'bull') {
        if (c.close <= stop) { losses++; totalRR += -1; break; }
        if (c.close >= target) { wins++; totalRR += 2; break; }
      } else {
        if (c.close >= stop) { losses++; totalRR += -1; break; }
        if (c.close <= target) { wins++; totalRR += 2; break; }
      }
    }
  }

  const total = wins + losses;
  const reliable = total >= MIN_RELIABLE_SAMPLE;
  return {
    signalType: 'FVG',
    totalSignals: fvgs.length,
    wins,
    losses,
    winRate: total > 0 ? Math.round(wins / total * 100) : 0,
    avgRR: total > 0 ? Math.round(totalRR / total * 100) / 100 : 0,
    reliable,
    sampleNote: reliable
      ? `${total} resolved trades over ${candles.length} candles (walk-forward, 2R target / 0.25-gap stop)`
      : `Only ${total} resolved trades — below ${MIN_RELIABLE_SAMPLE}, NOT statistically meaningful`,
  };
}
