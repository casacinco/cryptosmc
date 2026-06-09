import type { MarketStructure, FlowData, InstitutionalScore } from '../types';

export function computeScores(structure: MarketStructure, flow: FlowData, heatmapData?: any): InstitutionalScore {
  let bullishRaw = 0;
  let bearishRaw = 0;
  const details: Record<string, number> = {};

  // Market Structure (20%)
  const bosScore = structure.bos.length > 0
    ? (structure.bos.filter(b => b.type === 'bullish').length / structure.bos.length) * 20
    : 10;
  const structureBullish = structure.trend === 'bullish' ? 20 : structure.trend === 'ranging' ? 10 : 0;
  const structureBearish = structure.trend === 'bearish' ? 20 : structure.trend === 'ranging' ? 10 : 0;
  bullishRaw += structureBullish;
  bearishRaw += structureBearish;
  details['structure'] = structureBullish - structureBearish;

  // Liquidity (20%)
  const bslCount = structure.liquidityPools.filter(p => p.type === 'BSL').length;
  const sslCount = structure.liquidityPools.filter(p => p.type === 'SSL').length;
  const liqBullish = sslCount > bslCount ? 20 : sslCount === bslCount ? 10 : 5;
  const liqBearish = bslCount > sslCount ? 20 : sslCount === bslCount ? 10 : 5;
  bullishRaw += liqBullish;
  bearishRaw += liqBearish;
  details['liquidity'] = liqBullish - liqBearish;

  // Funding (10%)
  const fundingRate = flow.funding.current;
  if (fundingRate > 0.03) { bearishRaw += 10; details['funding'] = -10; }
  else if (fundingRate > 0.01) { bearishRaw += 5; details['funding'] = -5; }
  else if (fundingRate < -0.03) { bullishRaw += 10; details['funding'] = 10; }
  else if (fundingRate < -0.01) { bullishRaw += 5; details['funding'] = 5; }
  else details['funding'] = 0;

  // L/S Ratio (10%)
  const lsRatio = flow.longShort.ratio;
  if (lsRatio > 1.5) { bearishRaw += 10; details['longShort'] = -10; }
  else if (lsRatio < 0.7) { bullishRaw += 10; details['longShort'] = 10; }
  else details['longShort'] = 0;

  // CVD (10%)
  const cvdDiv = flow.cvd.divergence;
  if (cvdDiv === 'bullish') { bullishRaw += 10; details['cvd'] = 10; }
  else if (cvdDiv === 'bearish') { bearishRaw += 10; details['cvd'] = -10; }
  else details['cvd'] = 0;

  // OI interpretation (15%)
  const oiInterp = flow.openInterest.interpretation;
  if (oiInterp.includes('buyers entering')) { bullishRaw += 15; details['oi'] = 15; }
  else if (oiInterp.includes('new shorts')) { bearishRaw += 15; details['oi'] = -15; }
  else if (oiInterp.includes('profit-taking')) { bearishRaw += 7; details['oi'] = -7; }
  else if (oiInterp.includes('short covering')) { bullishRaw += 7; details['oi'] = 7; }
  else details['oi'] = 0;

  // OB bias (15%)
  const bullOBs = structure.orderBlocks.filter(ob => ob.type === 'bull').length;
  const bearOBs = structure.orderBlocks.filter(ob => ob.type === 'bear').length;
  const obBullish = bullOBs > bearOBs ? 15 : bullOBs === bearOBs ? 7 : 3;
  const obBearish = bearOBs > bullOBs ? 15 : bullOBs === bearOBs ? 7 : 3;
  bullishRaw += obBullish;
  bearishRaw += obBearish;
  details['orderBlocks'] = obBullish - obBearish;

  const total = bullishRaw + bearishRaw || 1;
  const bullish = Math.round((bullishRaw / total) * 100);
  const bearish = 100 - bullish;

  // Confidence: how far from 50/50
  const spread = Math.abs(bullish - bearish);
  const confidence = Math.round(50 + spread / 2);

  return { bullish, bearish, confidence, details };
}
