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
  }));
}

export async function fetchOpenInterest(symbol: string): Promise<{ symbol: string; openInterest: string; time: number }> {
  const url = `${BASE}/fapi/v1/openInterest?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance OI error: ${res.status}`);
  return res.json();
}

export async function fetchFundingRate(symbol: string, limit = 1): Promise<{ symbol: string; fundingRate: string; fundingTime: number }[]> {
  const url = `${BASE}/fapi/v1/fundingRate?symbol=${symbol}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance funding error: ${res.status}`);
  return res.json();
}

export async function fetchLongShortRatio(symbol: string, period = '5m', limit = 1): Promise<{ symbol: string; longShortRatio: string; longAccount: string; shortAccount: string; timestamp: number }[]> {
  const url = `${BASE}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance L/S error: ${res.status}`);
  return res.json();
}
