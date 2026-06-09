import { useState, useEffect } from 'react';
import type { Candle } from '../types';

export function useMarketData(symbol: string, timeframe: string) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=200`)
      .then(r => r.json())
      .then((data: any[][]) => {
        if (cancelled) return;
        setCandles(data.map(c => ({
          t: c[0], open: parseFloat(c[1]), high: parseFloat(c[2]),
          low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5]),
        })));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, timeframe]);

  return { candles, loading };
}
