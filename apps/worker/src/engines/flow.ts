import type { Candle, FlowData } from '../types';

export function interpretOpenInterest(priceDelta: number, oiDelta: number): string {
  if (priceDelta > 0 && oiDelta > 0) return 'OI rising with price: buyers entering — bullish confirmation';
  if (priceDelta > 0 && oiDelta < 0) return 'OI falling as price rises: profit-taking — potential weakness';
  if (priceDelta < 0 && oiDelta > 0) return 'OI rising as price falls: new shorts entering — bearish confirmation';
  if (priceDelta < 0 && oiDelta < 0) return 'OI falling with price: short covering — potential reversal';
  return 'Neutral / inconclusive';
}

export function interpretFunding(rate: number): { status: string; meaning: string } {
  // Binance funding is a decimal: 0.0001 = 0.01% per 8h (typical neutral)
  // High positive: > 0.05% = 0.0005 | Extreme: > 0.1% = 0.001
  if (rate > 0.001)  return { status: 'Extremely High',     meaning: 'Longs paying heavily — long squeeze risk elevated' };
  if (rate > 0.0005) return { status: 'Very High',          meaning: 'Market overextended to upside — caution for longs' };
  if (rate > 0.0001) return { status: 'Positive',           meaning: 'Slight long bias — healthy market' };
  if (rate > -0.0001) return { status: 'Neutral',           meaning: 'Balanced market — no directional bias' };
  if (rate > -0.0005) return { status: 'Negative',          meaning: 'Short bias — shorts paying premium' };
  return               { status: 'Extremely Negative',      meaning: 'Shorts paying heavily — short squeeze risk elevated' };
}

export function interpretLongShort(ratio: number): string {
  if (ratio > 2.0) return 'Heavily long — high long squeeze risk';
  if (ratio > 1.5) return 'Long-biased — moderate squeeze risk';
  if (ratio > 1.1) return 'Slightly long — neutral to bullish';
  if (ratio > 0.9) return 'Balanced — no directional bias';
  if (ratio > 0.5) return 'Slightly short — neutral to bearish';
  return 'Heavily short — high short squeeze risk';
}

export function computeCVD(candles: Candle[]): number[] {
  let cvd = 0;
  return candles.map(c => {
    cvd += c.close > c.open ? c.volume : -c.volume;
    return cvd;
  });
}

export function detectCVDDivergence(candles: Candle[], cvd: number[]): 'bullish' | 'bearish' | 'none' {
  if (candles.length < 20 || cvd.length < 20) return 'none';
  const slice = 20;
  const recentCandles = candles.slice(-slice);
  const recentCVD = cvd.slice(-slice);

  const priceStart = recentCandles[0].close;
  const priceEnd = recentCandles[recentCandles.length - 1].close;
  const cvdStart = recentCVD[0];
  const cvdEnd = recentCVD[recentCVD.length - 1];

  const priceDir = priceEnd > priceStart ? 1 : -1;
  const cvdDir = cvdEnd > cvdStart ? 1 : -1;

  if (priceDir !== cvdDir) {
    return priceDir < 0 ? 'bullish' : 'bearish';
  }
  return 'none';
}

export interface FlowSources {
  // Binance (single-exchange, always available)
  binanceOI: any;
  binanceOIHistory: any[];
  binanceFunding: any;
  binanceLS: any;
  // Coinalyze (multi-exchange aggregated, preferred when available)
  coinalyzeOI?: { value: number; update: number } | null;
  coinalyzeFunding?: { value: number; update: number } | null;
  coinalyzeLS?: { longRatio: number; shortRatio: number } | null;
}

export function analyzeFlow(candles: Candle[], sources: FlowSources): FlowData {
  const cvdValues = computeCVD(candles);
  const cvdDivergence = detectCVDDivergence(candles, cvdValues);
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  // ── Open Interest ────────────────────────────────────────────────────────────
  // Prefer Coinalyze (USD, multi-exchange) over Binance (coins, single-exchange)
  let currentOI = 0;
  let oiChange = 0;

  if (sources.coinalyzeOI && sources.coinalyzeOI.value > 0) {
    // Coinalyze OI is in base asset (BTC/ETH…), same as Binance — convert to USD
    currentOI = sources.coinalyzeOI.value * currentPrice;
  } else {
    // Binance: convert coins → USD
    const oiCoins = sources.binanceOI?.openInterest ? parseFloat(sources.binanceOI.openInterest) : 0;
    currentOI = oiCoins * currentPrice;
  }

  if (sources.binanceOIHistory.length >= 2) {
    const oldest = parseFloat(sources.binanceOIHistory[0].sumOpenInterest) * currentPrice;
    const newest = parseFloat(sources.binanceOIHistory[sources.binanceOIHistory.length - 1].sumOpenInterest) * currentPrice;
    oiChange = oldest > 0 ? ((newest - oldest) / oldest) * 100 : 0;
  }

  const priceDelta = candles.length > 1 ? candles[candles.length - 1].close - candles[candles.length - 2].close : 0;
  const oiInterpretation = interpretOpenInterest(priceDelta, oiChange);

  // ── Funding Rate ─────────────────────────────────────────────────────────────
  // Prefer Coinalyze (aggregated avg across all exchanges)
  let fundingRate = 0;
  if (sources.coinalyzeFunding && sources.coinalyzeFunding.value !== 0) {
    fundingRate = sources.coinalyzeFunding.value;
  } else {
    fundingRate = sources.binanceFunding ? parseFloat(sources.binanceFunding.fundingRate ?? '0') : 0;
  }
  const fundingInfo = interpretFunding(fundingRate);

  // ── Long/Short Ratio ─────────────────────────────────────────────────────────
  // Prefer Coinalyze (multi-exchange)
  let lsRatio = 1;
  if (sources.coinalyzeLS && sources.coinalyzeLS.longRatio > 0) {
    const total = sources.coinalyzeLS.longRatio + sources.coinalyzeLS.shortRatio;
    lsRatio = total > 0 ? sources.coinalyzeLS.longRatio / sources.coinalyzeLS.shortRatio : 1;
  } else {
    lsRatio = sources.binanceLS ? parseFloat(sources.binanceLS.longShortRatio ?? '1') : 1;
  }
  const lsInterpretation = interpretLongShort(lsRatio);

  return {
    openInterest: { current: currentOI, change24h: parseFloat(oiChange.toFixed(2)), interpretation: oiInterpretation },
    funding: { current: fundingRate, status: fundingInfo.status, meaning: fundingInfo.meaning },
    longShort: { ratio: lsRatio, interpretation: lsInterpretation },
    cvd: { values: cvdValues.slice(-50), divergence: cvdDivergence },
  };
}
