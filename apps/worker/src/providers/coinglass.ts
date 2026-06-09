// CoinGlass replaced with Binance Futures liquidation endpoints (free, no API key needed)
const BINANCE_BASE = 'https://fapi.binance.com';

export interface LiquidationEvent {
  symbol: string;
  side: 'BUY' | 'SELL'; // BUY = short was liquidated, SELL = long was liquidated
  price: number;
  quantity: number;
  time: number;
}

export interface LiquidationSummary {
  longLiquidations: number;  // USD value of longs liquidated
  shortLiquidations: number; // USD value of shorts liquidated
  dominantSide: 'longs' | 'shorts' | 'balanced';
  events: LiquidationEvent[];
}

/**
 * Fetch recent forced liquidation orders from Binance Futures.
 * Endpoint: GET /fapi/v1/allForceOrders — public, no auth required.
 * Returns last 100 liquidation events.
 */
export async function fetchLiquidations(symbol: string): Promise<LiquidationSummary> {
  try {
    const url = `${BINANCE_BASE}/fapi/v1/allForceOrders?symbol=${symbol}&limit=100`;
    const res = await fetch(url);
    if (!res.ok) return emptyLiqSummary();
    const data: any[] = await res.json();

    const events: LiquidationEvent[] = data.map(e => ({
      symbol: e.symbol,
      side: e.side,
      price: parseFloat(e.price),
      quantity: parseFloat(e.origQty),
      time: e.time,
    }));

    // BUY side = short positions being liquidated (price went up, shorts blown out)
    // SELL side = long positions being liquidated (price went down, longs blown out)
    const longLiq = events
      .filter(e => e.side === 'SELL')
      .reduce((sum, e) => sum + e.price * e.quantity, 0);

    const shortLiq = events
      .filter(e => e.side === 'BUY')
      .reduce((sum, e) => sum + e.price * e.quantity, 0);

    const dominantSide =
      longLiq > shortLiq * 1.5 ? 'longs' :
      shortLiq > longLiq * 1.5 ? 'shorts' :
      'balanced';

    return { longLiquidations: longLiq, shortLiquidations: shortLiq, dominantSide, events };
  } catch {
    return emptyLiqSummary();
  }
}

/**
 * Build a simple liquidation "heatmap" — groups liquidations by price bucket.
 * Returns price levels with highest liquidation concentration.
 */
export async function fetchLiquidationHeatmap(symbol: string): Promise<{ price: number; usdValue: number; side: 'long' | 'short' }[]> {
  try {
    const summary = await fetchLiquidations(symbol);
    if (summary.events.length === 0) return [];

    const prices = summary.events.map(e => e.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const bucketSize = (maxPrice - minPrice) / 20 || 1;

    const buckets: Map<number, { usdValue: number; side: 'long' | 'short' }> = new Map();

    for (const event of summary.events) {
      const bucket = Math.floor((event.price - minPrice) / bucketSize) * bucketSize + minPrice;
      const existing = buckets.get(bucket) ?? { usdValue: 0, side: event.side === 'SELL' ? 'long' : 'short' };
      existing.usdValue += event.price * event.quantity;
      buckets.set(bucket, existing);
    }

    return Array.from(buckets.entries())
      .map(([price, v]) => ({ price, ...v }))
      .sort((a, b) => b.usdValue - a.usdValue)
      .slice(0, 10);
  } catch {
    return [];
  }
}

function emptyLiqSummary(): LiquidationSummary {
  return { longLiquidations: 0, shortLiquidations: 0, dominantSide: 'balanced', events: [] };
}
