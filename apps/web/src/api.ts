const BASE = import.meta.env.VITE_API_URL || '';

const BINANCE_BASE = 'https://fapi.binance.com';

// ─── Binance client-side fetchers (browser → Binance direct, never blocked) ───

async function fetchBinanceCandles(symbol: string, interval: string, limit = 100) {
  const res = await fetch(`${BINANCE_BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (!res.ok) throw new Error(`Binance klines error: ${res.status}`);
  const data: any[][] = await res.json();
  return data.map(c => ({
    t: c[0],
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

async function fetchBinanceOI(symbol: string) {
  const res = await fetch(`${BINANCE_BASE}/fapi/v1/openInterest?symbol=${symbol}`);
  if (!res.ok) throw new Error(`Binance OI error: ${res.status}`);
  return res.json();
}

async function fetchBinanceOIHistory(symbol: string) {
  const res = await fetch(`${BINANCE_BASE}/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=25`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchBinanceFunding(symbol: string) {
  const res = await fetch(`${BINANCE_BASE}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`);
  if (!res.ok) throw new Error(`Binance funding error: ${res.status}`);
  return res.json();
}

async function fetchBinanceLongShort(symbol: string) {
  const res = await fetch(`${BINANCE_BASE}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`);
  if (!res.ok) throw new Error(`Binance L/S error: ${res.status}`);
  return res.json();
}

async function fetchBinanceLiquidations(symbol: string) {
  try {
    const res = await fetch(`${BINANCE_BASE}/fapi/v1/allForceOrders?symbol=${symbol}&limit=100`);
    if (!res.ok) return [];
    const data: any[] = await res.json();
    const events = data.map(e => ({
      symbol: e.symbol,
      side: e.side as 'BUY' | 'SELL',
      price: parseFloat(e.price),
      quantity: parseFloat(e.origQty),
      time: e.time,
    }));
    // Build simple heatmap buckets
    if (events.length === 0) return [];
    const prices = events.map(e => e.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const bucketSize = (maxPrice - minPrice) / 20 || 1;
    const buckets = new Map<number, { usdValue: number; side: 'long' | 'short' }>();
    for (const event of events) {
      const bucket = Math.floor((event.price - minPrice) / bucketSize) * bucketSize + minPrice;
      const existing = buckets.get(bucket) ?? { usdValue: 0, side: (event.side === 'SELL' ? 'long' : 'short') as 'long' | 'short' };
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

// ─── Main API call: fetch Binance client-side, POST to Worker for analysis ────

export async function fetchAnalysis(symbol: string): Promise<any> {
  // Step 1: Fetch all Binance data from the browser (bypasses Cloudflare IP blocks)
  const [candles1D, candles4H, candles1H, oi, oiHistory, funding, longShort, heatmap] = await Promise.all([
    fetchBinanceCandles(symbol, '1d', 100),
    fetchBinanceCandles(symbol, '4h', 100),
    fetchBinanceCandles(symbol, '1h', 100),
    fetchBinanceOI(symbol),
    fetchBinanceOIHistory(symbol),
    fetchBinanceFunding(symbol),
    fetchBinanceLongShort(symbol),
    fetchBinanceLiquidations(symbol),
  ]);

  // Step 2: POST data to Worker for SMC analysis (Coinalyze + engines run server-side)
  const res = await fetch(`${BASE}/api/analyze?symbol=${symbol}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      binanceData: { candles1D, candles4H, candles1H, oi, oiHistory, funding, longShort, heatmap },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function fetchStructure(symbol: string, tf: string): Promise<any> {
  const res = await fetch(`${BASE}/api/structure?symbol=${symbol}&tf=${tf}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchFlow(symbol: string): Promise<any> {
  const res = await fetch(`${BASE}/api/flow?symbol=${symbol}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
