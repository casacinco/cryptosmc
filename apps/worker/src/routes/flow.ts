import type { Context } from 'hono';
import type { Env } from '../types';
import { fetchCandles, fetchOpenInterest, fetchFundingRate, fetchLongShortRatio } from '../providers/binance';
import { analyzeFlow } from '../engines/flow';
import { getCache, setCache } from '../db/cache';

export async function handleFlow(c: Context<{ Bindings: Env }>) {
  const symbol = c.req.query('symbol') || 'BTCUSDT';
  const cacheKey = `flow:${symbol}`;

  const cached = await getCache(c.env.DB, cacheKey);
  if (cached) return c.json(cached);

  try {
    const [candles, oiRaw, fundingRaw, lsRaw] = await Promise.all([
      fetchCandles(symbol, '4h', 100),
      fetchOpenInterest(symbol),
      fetchFundingRate(symbol, 1),
      fetchLongShortRatio(symbol, '5m', 1),
    ]);

    const flow = analyzeFlow(candles, oiRaw, fundingRaw[0] || null, lsRaw[0] || null);
    await setCache(c.env.DB, cacheKey, flow, 120);
    return c.json(flow);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
}
