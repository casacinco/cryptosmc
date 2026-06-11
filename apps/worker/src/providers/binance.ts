import type { Candle } from '../types';

const BASE = 'https://fapi.binance.com';

export async function fetchCandles(symbol: string, interval: string, limit = 200): Promise<Candle[]> {
  const url = `${BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines error: ${res.status}`);
  const data: any[][] = await res.json();
  return data.map(c => ({
    t: c[0],
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
    takerBuyVolume: parseFloat(c[9]), // taker buy base volume → true CVD delta
  }));
}

export async function fetchOpenInterest(symbol: string): Promise<{ symbol: string; openInterest: string; time: number }> {
  const url = `${BASE}/fapi/v1/openInterest?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance OI error: ${res.status}`);
  return res.json();
}

/** Returns last 25 hourly OI snapshots — used to compute 24h delta */
export async function fetchOpenInterestHistory(symbol: string): Promise<{ symbol: string; sumOpenInterest: string; timestamp: number }[]> {
  const url = `${BASE}/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=25`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchFundingRate(symbol: string, limit = 1): Promise<{ symbol: string; fundingRate: string; fundingTime: number }[]> {
  const url = `${BASE}/fapi/v1/fundingRate?symbol=${symbol}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance funding error: ${res.status}`);
  return res.json();
}

export async function fetchLongShortRatio(symbol: string, period = '5m', limit = 1): Promise<{ symbol: string; longShortRatio: string; longAccount: string; shortAccount: string; timestamp: number }[]> {
  // Top-trader POSITIONS ratio — institutional positioning beats retail account counts
  const url = `${BASE}/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=${period}&limit=${limit}`;
  const res = await fetch(url);
  if (res.ok) return res.json();
  // Fallback: global accounts ratio
  const fb = await fetch(`${BASE}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=${limit}`);
  if (!fb.ok) throw new Error(`Binance L/S error: ${fb.status}`);
  return fb.json();
}
