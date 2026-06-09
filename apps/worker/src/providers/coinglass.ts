const BASE = 'https://open-api-v4.coinglass.com';

export async function fetchLiquidationHeatmap(symbol: string, apiKey: string): Promise<any | null> {
  if (!apiKey) return null;
  try {
    const url = `${BASE}/api/futures/liquidation/heatmap/model2?symbol=${symbol}`;
    const res = await fetch(url, { headers: { 'coinglassSecret': apiKey } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchLiquidations(symbol: string, apiKey: string): Promise<any[]> {
  if (!apiKey) return [];
  try {
    const url = `${BASE}/api/futures/liquidation/history?symbol=${symbol}`;
    const res = await fetch(url, { headers: { 'coinglassSecret': apiKey } });
    if (!res.ok) return [];
    const data: any = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}
