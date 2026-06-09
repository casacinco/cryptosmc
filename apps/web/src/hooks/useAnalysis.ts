import { useState, useEffect, useCallback } from 'react';
import { fetchAnalysis } from '../api';
import type { TradeReport } from '../types';

export function useAnalysis(symbol: string) {
  const [data, setData] = useState<TradeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAnalysis(symbol);
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return { data, loading, error, refetch: load };
}
