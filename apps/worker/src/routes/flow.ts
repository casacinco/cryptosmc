import type { Context } from 'hono';
import type { Env } from '../types';
import { fetchCandles, fetchOpenInterest, fetchOpenInterestHistory, fetchFundingRate, fetchLongShortRatio } from '../providers/binance';
import { fetchOI as coinalyzeOI, fetchFunding as coinalyzeFunding, fetchLongShortHistory as coinalyzeLS, toCoinalyzeSymbol } from '../providers/coinalyze';
import { analyzeFlow } from '../engines/flow';
import { getCache, setCache } from '../db/cache';

export async function handleFlow(c: Context<{ Bindings: Env }>) {
  const symbol = c.req.query('symbol') || 'BTCUSDT';
  const cacheKey = `flow:${symbol}`;

  const cached = await getCache(c.env.DB, cacheKey);
  if (cached) return c.json(cached);

  try {
    const clzSymbol = toCoinalyzeSymbol(symbol);
    const apiKey = c.env.COINALYZE_API_KEY;

    const [candles, oiRaw, oiHistory, fundingRaw, lsRaw, clzOIData, clzFundingData, clzLSData] = await Promise.all([
      fetchCandles(symbol, '4h', 100),
      fetchOpenInterest(symbol),
      fetchOpenInterestHistory(symbol),
      fetchFundingRate(symbol, 1),
      fetchLongShortRatio(symbol, '5m', 1),
      coinalyzeOI([clzSymbol], apiKey),
      coinalyzeFunding([clzSymbol], apiKey),
      coinalyzeLS(clzSymbol, '1hour', apiKey),
    ]);

    const clzLS = clzLSData.length > 0 ? clzLSData[clzLSData.length - 1] : null;

    const flow = analyzeFlow(candles, {
      binanceOI: oiRaw,
      binanceOIHistory: oiHistory,
      binanceFunding: fundingRaw[0] || null,
      binanceLS: lsRaw[0] || null,
      coinalyzeOI: clzOIData[0] ?? null,
      coinalyzeFunding: clzFundingData[0] ?? null,
      coinalyzeLS: clzLS,
    });

    await setCache(c.env.DB, cacheKey, flow, 120);
    return c.json(flow);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
}
