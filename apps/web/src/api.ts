const BASE = import.meta.env.VITE_API_URL || '';

export async function fetchAnalysis(symbol: string): Promise<any> {
  const res = await fetch(`${BASE}/api/analyze?symbol=${symbol}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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
