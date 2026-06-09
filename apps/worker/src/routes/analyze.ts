import type { Context } from 'hono';
import type { Env, TradeReport } from '../types';
import { fetchCandles, fetchOpenInterest, fetchOpenInterestHistory, fetchFundingRate, fetchLongShortRatio } from '../providers/binance';
import { fetchLiquidationHeatmap } from '../providers/coinglass'; // now uses Binance free endpoint
import { analyzeStructure } from '../engines/smc';
import { analyzeFlow } from '../engines/flow';
import { computeScores } from '../engines/scoring';
import { generateZones, generateScenarios } from '../engines/confluence';
import { getCache, setCache } from '../db/cache';

export async function handleAnalyze(c: Context<{ Bindings: Env }>) {
  const symbol = c.req.query('symbol') || 'BTCUSDT';
  const cacheKey = `analyze:${symbol}`;

  const cached = await getCache(c.env.DB, cacheKey);
  if (cached) return c.json(cached);

  try {
    const [candles1D, candles4H, candles1H, oiRaw, oiHistory, fundingRaw, lsRaw, heatmap] = await Promise.all([
      fetchCandles(symbol, '1d', 100),
      fetchCandles(symbol, '4h', 100),
      fetchCandles(symbol, '1h', 100),
      fetchOpenInterest(symbol),
      fetchOpenInterestHistory(symbol),
      fetchFundingRate(symbol, 1),
      fetchLongShortRatio(symbol, '5m', 1),
      fetchLiquidationHeatmap(symbol),
    ]);

    const structure1D = analyzeStructure(symbol, '1D', candles1D);
    const structure4H = analyzeStructure(symbol, '4H', candles4H);
    const structure1H = analyzeStructure(symbol, '1H', candles1H);

    const fundingData = fundingRaw[0] || null;
    const lsData = lsRaw[0] || null;
    const flow = analyzeFlow(candles4H, oiRaw, oiHistory, fundingData, lsData);
    const score = computeScores(structure4H, flow, heatmap);
    const { primary, alternative } = generateScenarios(structure4H, flow, score);
    const { long_zones, short_zones, invalidation_level } = generateZones(structure4H, flow);

    const report: TradeReport = {
      symbol,
      timestamp: Date.now(),
      scenario_primary: primary,
      scenario_alternative: alternative,
      long_zones,
      short_zones,
      invalidation_level,
      confidence: score.confidence,
      bullish_score: score.bullish,
      bearish_score: score.bearish,
      structure: { '1D': structure1D, '4H': structure4H, '1H': structure1H },
      flow,
      score,
    };

    await setCache(c.env.DB, cacheKey, report, 300);
    return c.json(report);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
}
