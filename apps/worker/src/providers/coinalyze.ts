const BASE = 'https://api.coinalyze.net/v1';

/**
 * Coinalyze aggregates data from all major exchanges.
 * Symbol format: "BTCUSDT_PERP" aggregates Binance+Bybit+OKX+etc.
 * Response OI value is already in USD (not coins).
 * Response funding value is already a decimal (0.0001 = 0.01%/8h).
 */

/**
 * Map a trading pair to Coinalyze symbol.
 * Free tier only resolves exchange-specific symbols (suffix .3 = Binance).
 * Paid tier supports aggregated symbols without suffix.
 */
export function toCoinalyzeSymbol(pair: string): string {
  const base = pair.replace(/USDT$|USDC$|BUSD$/, '');
  return `${base}USDT_PERP.3`; // .3 = Binance (free tier supported)
}

/** OI from Coinalyze is in base asset (BTC, ETH…), same as Binance */
export function coinalyzeOItoUSD(value: number, currentPrice: number): number {
  return value * currentPrice;
}

export interface CoinalyzeOI {
  symbol: string;
  value: number;   // USD
  update: number;  // unix seconds
}

export interface CoinalyzeFunding {
  symbol: string;
  value: number;   // decimal (0.0001 = 0.01%/8h)
  update: number;
}

export interface CoinalyzeLongShort {
  symbol: string;
  longRatio: number;
  shortRatio: number;
  update: number;
}

export async function fetchOI(symbols: string[], apiKey: string): Promise<CoinalyzeOI[]> {
  if (!apiKey) return [];
  try {
    const url = `${BASE}/open-interest?symbols=${symbols.join(',')}&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return data.map(d => ({ symbol: d.symbol, value: d.value ?? 0, update: d.update ?? 0 }));
  } catch {
    return [];
  }
}

export async function fetchFunding(symbols: string[], apiKey: string): Promise<CoinalyzeFunding[]> {
  if (!apiKey) return [];
  try {
    const url = `${BASE}/funding-rate?symbols=${symbols.join(',')}&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return data.map(d => ({ symbol: d.symbol, value: d.value ?? 0, update: d.update ?? 0 }));
  } catch {
    return [];
  }
}

export async function fetchLongShortHistory(symbol: string, interval: string, apiKey: string): Promise<CoinalyzeLongShort[]> {
  if (!apiKey) return [];
  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 86400;
    const url = `${BASE}/long-short-ratio-history?symbols=${symbol}&interval=${interval}&from=${from}&to=${to}&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: any[] = await res.json();
    // Coinalyze returns array of [{t, l, s}] or [{symbol, history:[...]}]
    // Normalize to our format
    if (!data.length) return [];
    const rows = data[0]?.history ?? data;
    return rows.map((r: any) => ({
      symbol,
      longRatio: r.l ?? r.longRatio ?? 0.5,
      shortRatio: r.s ?? r.shortRatio ?? 0.5,
      update: r.t ?? r.update ?? 0,
    }));
  } catch {
    return [];
  }
}
