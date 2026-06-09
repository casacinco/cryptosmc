const BASE = 'https://api.coinalyze.net/v1';

export async function fetchOI(symbols: string[], apiKey: string): Promise<any[]> {
  if (!apiKey) return [];
  try {
    const url = `${BASE}/open-interest?symbols=${symbols.join(',')}&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchFunding(symbols: string[], apiKey: string): Promise<any[]> {
  if (!apiKey) return [];
  try {
    const url = `${BASE}/funding-rate?symbols=${symbols.join(',')}&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchLongShortHistory(symbol: string, interval: string, apiKey: string): Promise<any[]> {
  if (!apiKey) return [];
  try {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 86400;
    const url = `${BASE}/long-short-ratio-history?symbols=${symbol}&interval=${interval}&from=${from}&to=${to}&api_key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
