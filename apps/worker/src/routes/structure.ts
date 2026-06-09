import type { Context } from 'hono';
import type { Env } from '../types';
import { fetchCandles } from '../providers/binance';
import { analyzeStructure } from '../engines/smc';
import { getCache, setCache } from '../db/cache';

export async function handleStructure(c: Context<{ Bindings: Env }>) {
  const symbol = c.req.query('symbol') || 'BTCUSDT';
  const tf = c.req.query('tf') || '4h';
  const cacheKey = `structure:${symbol}:${tf}`;

  const cached = await getCache(c.env.DB, cacheKey);
  if (cached) return c.json(cached);

  try {
    const candles = await fetchCandles(symbol, tf, 100);
    const structure = analyzeStructure(symbol, tf.toUpperCase(), candles);
    await setCache(c.env.DB, cacheKey, structure, 180);
    return c.json(structure);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
}
