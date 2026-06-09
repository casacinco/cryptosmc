import type { MarketStructure, FlowData, InstitutionalScore, ScoreBreakdownItem, ConfidenceBreakdownItem, MTFRow } from '../types';

export function computeScores(structure: MarketStructure, flow: FlowData, heatmapData?: any): InstitutionalScore {
  let bullishRaw = 0;
  let bearishRaw = 0;
  const details: Record<string, number> = {};

  // Market Structure (20%)
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

  // Funding (10%) — Binance decimal: 0.0001 = 0.01%/8h typical
  const fundingRate = flow.funding.current;
  // >= catches the Binance standard rate (0.0001 = 0.01%) which IS a positive funding signal
  if      (fundingRate >= 0.001)   { bearishRaw += 10; details['funding'] = -10; } // ≥0.1%  extreme long
  else if (fundingRate >= 0.0005)  { bearishRaw += 7;  details['funding'] = -7;  } // ≥0.05% very high
  else if (fundingRate >= 0.0001)  { bearishRaw += 4;  details['funding'] = -4;  } // ≥0.01% positive (standard rate)
  else if (fundingRate <= -0.001)  { bullishRaw += 10; details['funding'] = 10;  } // ≤-0.1% extreme short
  else if (fundingRate <= -0.0005) { bullishRaw += 7;  details['funding'] = 7;   } // ≤-0.05% very negative
  else if (fundingRate <= -0.0001) { bullishRaw += 4;  details['funding'] = 4;   } // ≤-0.01% negative
  else                             {                   details['funding'] = 0;   } // truly neutral (near zero)

  // L/S Ratio (10%)
  const lsRatio = flow.longShort.ratio;
  if (lsRatio > 1.5)      { bearishRaw += 10; details['longShort'] = -10; }
  else if (lsRatio > 1.2) { bearishRaw += 5;  details['longShort'] = -5;  }
  else if (lsRatio < 0.7) { bullishRaw += 10; details['longShort'] = 10;  }
  else if (lsRatio < 0.85){ bullishRaw += 5;  details['longShort'] = 5;   }
  else                     {                   details['longShort'] = 0;   }

  // CVD (10%) — divergence = strong signal; no divergence = use trend alignment as weaker signal
  const cvdDiv = flow.cvd.divergence;
  const cvdValues = flow.cvd.values;
  if (cvdDiv === 'bullish')      { bullishRaw += 10; details['cvd'] = 10;  }
  else if (cvdDiv === 'bearish') { bearishRaw += 10; details['cvd'] = -10; }
  else if (cvdValues.length >= 2) {
    // No divergence: check if CVD trend aligns with price trend (weaker signal, ±5)
    const cvdTrend = cvdValues[cvdValues.length - 1] - cvdValues[0];
    if (cvdTrend > 0 && structure.trend === 'bullish')      { bullishRaw += 5; details['cvd'] = 5;  }
    else if (cvdTrend < 0 && structure.trend === 'bearish') { bearishRaw += 5; details['cvd'] = -5; }
    else if (cvdTrend > 0 && structure.trend === 'bearish') { bullishRaw += 3; details['cvd'] = 3;  } // hidden bull div
    else if (cvdTrend < 0 && structure.trend === 'bullish') { bearishRaw += 3; details['cvd'] = -3; } // hidden bear div
    else details['cvd'] = 0;
  } else details['cvd'] = 0;

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

export function buildScoreBreakdown(structure: MarketStructure, flow: FlowData): ScoreBreakdownItem[] {
  const items: ScoreBreakdownItem[] = [];

  // Market Structure
  const structureBullish = structure.trend === 'bullish' ? 20 : structure.trend === 'ranging' ? 10 : 0;
  const structureBearish = structure.trend === 'bearish' ? 20 : structure.trend === 'ranging' ? 10 : 0;
  let structureReason = '';
  if (structure.trend === 'bullish') structureReason = `Bullish trend confirmed by BOS sequence (${structure.bos.filter(b => b.type === 'bullish').length} bullish BOS)`;
  else if (structure.trend === 'bearish') structureReason = `Bearish trend confirmed by BOS sequence (${structure.bos.filter(b => b.type === 'bearish').length} bearish BOS)`;
  else structureReason = 'Market ranging — no dominant BOS direction in last 4 events';
  items.push({
    factor: 'Market Structure',
    bullishContrib: structureBullish,
    bearishContrib: structureBearish,
    net: structureBullish - structureBearish,
    reason: structureReason,
  });

  // Liquidity
  const bslCount = structure.liquidityPools.filter(p => p.type === 'BSL').length;
  const sslCount = structure.liquidityPools.filter(p => p.type === 'SSL').length;
  const liqBullish = sslCount > bslCount ? 20 : sslCount === bslCount ? 10 : 5;
  const liqBearish = bslCount > sslCount ? 20 : sslCount === bslCount ? 10 : 5;
  let liqReason = '';
  if (bslCount > sslCount) liqReason = `More BSL (buy-side targets) above price (${bslCount} BSL vs ${sslCount} SSL) — price likely to hunt those highs`;
  else if (sslCount > bslCount) liqReason = `More SSL (sell-side targets) below price (${sslCount} SSL vs ${bslCount} BSL) — price likely to sweep those lows`;
  else liqReason = `Equal BSL and SSL (${bslCount} each) — no directional bias from liquidity`;
  items.push({
    factor: 'Liquidity',
    bullishContrib: liqBullish,
    bearishContrib: liqBearish,
    net: liqBullish - liqBearish,
    reason: liqReason,
  });

  // Funding
  const fundingRate = flow.funding.current;
  let fundBull = 0, fundBear = 0, fundReason = '';
  if (fundingRate >= 0.001) {
    fundBear = 10;
    fundReason = `Funding at ${(fundingRate * 100).toFixed(4)}% — extreme longs paying, high probability of squeeze`;
  } else if (fundingRate >= 0.0005) {
    fundBear = 7;
    fundReason = `Funding at ${(fundingRate * 100).toFixed(4)}% — longs overextended`;
  } else if (fundingRate >= 0.0001) {
    fundBear = 4;
    fundReason = `Funding at ${(fundingRate * 100).toFixed(4)}% — longs paying standard premium`;
  } else if (fundingRate <= -0.001) {
    fundBull = 10;
    fundReason = `Funding at ${(fundingRate * 100).toFixed(4)}% — extreme shorts paying, squeeze risk`;
  } else if (fundingRate <= -0.0005) {
    fundBull = 7;
    fundReason = `Funding at ${(fundingRate * 100).toFixed(4)}% — shorts overextended`;
  } else if (fundingRate <= -0.0001) {
    fundBull = 4;
    fundReason = `Funding at ${(fundingRate * 100).toFixed(4)}% — shorts paying, mild bullish edge`;
  } else {
    fundReason = `Funding near zero (${(fundingRate * 100).toFixed(4)}%) — no directional signal`;
  }
  items.push({
    factor: 'Funding Rate',
    bullishContrib: fundBull,
    bearishContrib: fundBear,
    net: fundBull - fundBear,
    reason: fundReason,
  });

  // Long/Short Ratio
  const lsRatio = flow.longShort.ratio;
  let lsBull = 0, lsBear = 0, lsReason = '';
  if (lsRatio > 1.5) {
    lsBear = 10;
    lsReason = `L/S ratio ${lsRatio.toFixed(2)} — heavily long, contrarian bearish signal`;
  } else if (lsRatio > 1.2) {
    lsBear = 5;
    lsReason = `L/S ratio ${lsRatio.toFixed(2)} — moderately long-heavy`;
  } else if (lsRatio < 0.7) {
    lsBull = 10;
    lsReason = `L/S ratio ${lsRatio.toFixed(2)} — heavily short, contrarian bullish signal`;
  } else if (lsRatio < 0.85) {
    lsBull = 5;
    lsReason = `L/S ratio ${lsRatio.toFixed(2)} — moderately short-heavy`;
  } else {
    lsReason = `L/S ratio ${lsRatio.toFixed(2)} — balanced positioning`;
  }
  items.push({
    factor: 'Long/Short Ratio',
    bullishContrib: lsBull,
    bearishContrib: lsBear,
    net: lsBull - lsBear,
    reason: lsReason,
  });

  // CVD
  const cvdDiv = flow.cvd.divergence;
  const cvdValues = flow.cvd.values;
  let cvdBull = 0, cvdBear = 0, cvdReason = '';
  if (cvdDiv === 'bullish') {
    cvdBull = 10;
    cvdReason = 'Bullish CVD divergence — buyers absorbing sell pressure';
  } else if (cvdDiv === 'bearish') {
    cvdBear = 10;
    cvdReason = 'Bearish CVD divergence — sellers driving price despite buy volume';
  } else if (cvdValues.length >= 2) {
    const cvdTrend = cvdValues[cvdValues.length - 1] - cvdValues[0];
    if (cvdTrend > 0 && structure.trend === 'bullish') { cvdBull = 5; cvdReason = 'CVD rising with bullish trend — confirmation'; }
    else if (cvdTrend < 0 && structure.trend === 'bearish') { cvdBear = 5; cvdReason = 'CVD falling with bearish trend — confirmation'; }
    else if (cvdTrend > 0 && structure.trend === 'bearish') { cvdBull = 3; cvdReason = 'CVD rising vs bearish trend — hidden bullish divergence'; }
    else if (cvdTrend < 0 && structure.trend === 'bullish') { cvdBear = 3; cvdReason = 'CVD falling vs bullish trend — hidden bearish divergence'; }
    else { cvdReason = 'CVD flat — no conviction signal'; }
  } else {
    cvdReason = 'Insufficient CVD data';
  }
  items.push({
    factor: 'CVD',
    bullishContrib: cvdBull,
    bearishContrib: cvdBear,
    net: cvdBull - cvdBear,
    reason: cvdReason,
  });

  // Open Interest
  const oiInterp = flow.openInterest.interpretation;
  let oiBull = 0, oiBear = 0, oiReason = '';
  if (oiInterp.includes('buyers entering')) {
    oiBull = 15;
    oiReason = `OI rising with price — new longs entering (OI change: ${flow.openInterest.change24h > 0 ? '+' : ''}${flow.openInterest.change24h.toFixed(2)}%)`;
  } else if (oiInterp.includes('new shorts')) {
    oiBear = 15;
    oiReason = `OI rising as price falls — new shorts entering`;
  } else if (oiInterp.includes('profit-taking')) {
    oiBear = 7;
    oiReason = 'OI falling with price — longs exiting, bearish';
  } else if (oiInterp.includes('short covering')) {
    oiBull = 7;
    oiReason = 'OI falling as price rises — short squeeze, bullish';
  } else {
    oiReason = `OI neutral — ${oiInterp}`;
  }
  items.push({
    factor: 'Open Interest',
    bullishContrib: oiBull,
    bearishContrib: oiBear,
    net: oiBull - oiBear,
    reason: oiReason,
  });

  // Order Blocks
  const bullOBs = structure.orderBlocks.filter(ob => ob.type === 'bull').length;
  const bearOBs = structure.orderBlocks.filter(ob => ob.type === 'bear').length;
  const obBullish = bullOBs > bearOBs ? 15 : bullOBs === bearOBs ? 7 : 3;
  const obBearish = bearOBs > bullOBs ? 15 : bullOBs === bearOBs ? 7 : 3;
  let obReason = '';
  if (bullOBs > bearOBs) obReason = `${bullOBs} unmitigated bullish OBs vs ${bearOBs} bearish — demand zones dominate`;
  else if (bearOBs > bullOBs) obReason = `${bearOBs} unmitigated bearish OBs vs ${bullOBs} bullish — supply zones dominate`;
  else obReason = `Equal OBs (${bullOBs} bull / ${bearOBs} bear)`;
  items.push({
    factor: 'Order Blocks',
    bullishContrib: obBullish,
    bearishContrib: obBearish,
    net: obBullish - obBearish,
    reason: obReason,
  });

  return items;
}

export function buildConfidenceBreakdown(
  structure: MarketStructure,
  flow: FlowData,
  score: InstitutionalScore,
  mtfRows: MTFRow[],
): ConfidenceBreakdownItem[] {
  const items: ConfidenceBreakdownItem[] = [];

  // Base confidence from score spread
  const spread = Math.abs(score.bullish - score.bearish);
  items.push({
    factor: 'Score Spread',
    value: Math.round(spread / 2),
    reason: `${score.bullish}% bullish vs ${score.bearish}% bearish — ${spread}pt spread gives base confidence`,
  });

  // MTF trend agreement
  const trends = mtfRows.map(r => r.trend);
  const dominantTrend = trends[0];
  const agreeing = trends.filter(t => t === dominantTrend).length;
  if (agreeing === 3) {
    items.push({
      factor: 'MTF Trend Agreement',
      value: 20,
      reason: `All 3 timeframes (${mtfRows.map(r => r.timeframe).join(', ')}) agree on ${dominantTrend} trend`,
    });
  } else if (agreeing === 2) {
    items.push({
      factor: 'MTF Trend Agreement',
      value: 8,
      reason: `2 of 3 timeframes agree on ${dominantTrend} trend — partial alignment`,
    });
  } else {
    items.push({
      factor: 'MTF Trend Agreement',
      value: -5,
      reason: 'Timeframes disagree on trend direction — reduces confidence',
    });
  }

  // OB + FVG confluence
  const bullOBs = structure.orderBlocks.filter(ob => ob.type === 'bull').length;
  const bullFVGs = structure.fvgs.filter(f => f.type === 'bull').length;
  const bearOBs = structure.orderBlocks.filter(ob => ob.type === 'bear').length;
  const bearFVGs = structure.fvgs.filter(f => f.type === 'bear').length;
  if ((bullOBs > 0 && bullFVGs > 0) || (bearOBs > 0 && bearFVGs > 0)) {
    items.push({
      factor: 'OB + FVG Confluence',
      value: 15,
      reason: `OBs and FVGs present in same direction (Bull: ${bullOBs} OB/${bullFVGs} FVG, Bear: ${bearOBs} OB/${bearFVGs} FVG)`,
    });
  } else {
    items.push({
      factor: 'OB + FVG Confluence',
      value: 0,
      reason: 'No OB/FVG overlap detected in same direction',
    });
  }

  // Funding confirmation
  const fundingRate = flow.funding.current;
  const fundingAlignedBearish = fundingRate > 0.0001 && structure.trend === 'bearish';
  const fundingAlignedBullish = fundingRate < -0.0001 && structure.trend === 'bullish';
  if (fundingAlignedBearish || fundingAlignedBullish) {
    items.push({
      factor: 'Funding Confirmation',
      value: 10,
      reason: `Funding rate ${fundingAlignedBearish ? 'positive' : 'negative'} aligns with ${structure.trend} trend`,
    });
  } else if ((fundingRate > 0.0001 && structure.trend === 'bullish') || (fundingRate < -0.0001 && structure.trend === 'bearish')) {
    items.push({
      factor: 'Funding Confirmation',
      value: -5,
      reason: `Funding conflicts with ${structure.trend} trend — reduces conviction`,
    });
  } else {
    items.push({
      factor: 'Funding Confirmation',
      value: 0,
      reason: 'Funding near zero — no directional confirmation',
    });
  }

  // CVD alignment
  const cvdDiv = flow.cvd.divergence;
  if (cvdDiv !== 'none') {
    const aligned = (cvdDiv === 'bullish' && structure.trend === 'bullish') ||
      (cvdDiv === 'bearish' && structure.trend === 'bearish');
    items.push({
      factor: 'CVD Alignment',
      value: aligned ? 10 : -3,
      reason: aligned
        ? `CVD ${cvdDiv} divergence confirms ${structure.trend} structure`
        : `CVD ${cvdDiv} divergence conflicts with ${structure.trend} structure`,
    });
  } else {
    items.push({
      factor: 'CVD Alignment',
      value: 0,
      reason: 'No CVD divergence detected',
    });
  }

  // Missing OI data
  if (flow.openInterest.current === 0) {
    items.push({
      factor: 'Open Interest Data',
      value: -10,
      reason: 'OI data unavailable or zero — cannot confirm institutional positioning',
    });
  } else {
    items.push({
      factor: 'Open Interest Data',
      value: 5,
      reason: `OI data available (${flow.openInterest.current.toLocaleString()}) — ${flow.openInterest.interpretation}`,
    });
  }

  // CHoCH confirmation
  const recentCHoCH = structure.choch.length > 0;
  if (recentCHoCH) {
    const lastChoch = structure.choch[structure.choch.length - 1];
    const aligned = lastChoch.type === structure.trend || structure.trend === 'ranging';
    items.push({
      factor: 'CHoCH Confirmation',
      value: aligned ? 8 : -5,
      reason: aligned
        ? `Recent CHoCH at ${lastChoch.price.toLocaleString()} confirms structure shift`
        : `CHoCH direction conflicts with current trend — possible reversal forming`,
    });
  } else {
    items.push({
      factor: 'CHoCH Confirmation',
      value: 0,
      reason: 'No recent CHoCH events',
    });
  }

  return items;
}
