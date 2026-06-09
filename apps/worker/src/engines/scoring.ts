import type {
  MarketStructure, FlowData, InstitutionalScore, ScoreBreakdownItem,
  ConfidenceBreakdownItem, MTFRow, SignalAgreement,
} from '../types';

// ─── FIX 2: Signal Agreement Model ───────────────────────────────────────────

export function computeSignalAgreement(structure: MarketStructure, flow: FlowData): SignalAgreement {
  const bullishSignals: string[] = [];
  const bearishSignals: string[] = [];
  const neutralSignals: string[] = [];

  // 1. Structure trend
  if (structure.trend === 'bullish') bullishSignals.push('Market structure: bullish trend');
  else if (structure.trend === 'bearish') bearishSignals.push('Market structure: bearish trend');
  else neutralSignals.push('Market structure: ranging');

  // 2. BOS direction
  const last3BOS = structure.bos.slice(-3);
  const bullBOS = last3BOS.filter(b => b.type === 'bullish').length;
  const bearBOS = last3BOS.filter(b => b.type === 'bearish').length;
  if (bullBOS > bearBOS) bullishSignals.push(`BOS bias: ${bullBOS}/${last3BOS.length} bullish`);
  else if (bearBOS > bullBOS) bearishSignals.push(`BOS bias: ${bearBOS}/${last3BOS.length} bearish`);
  else if (last3BOS.length > 0) neutralSignals.push('BOS bias: balanced');

  // 3. Liquidity
  const bslCount = structure.liquidityPools.filter(p => p.type === 'BSL').length;
  const sslCount = structure.liquidityPools.filter(p => p.type === 'SSL').length;
  if (sslCount > bslCount) bullishSignals.push(`Liquidity: more SSL below (${sslCount} vs ${bslCount} BSL)`);
  else if (bslCount > sslCount) bearishSignals.push(`Liquidity: more BSL above (${bslCount} vs ${sslCount} SSL)`);
  else neutralSignals.push('Liquidity: balanced BSL/SSL');

  // 4. Funding
  const fr = flow.funding.current;
  if (fr >= 0.001) bearishSignals.push(`Funding: extreme longs (${(fr * 100).toFixed(4)}%)`);
  else if (fr >= 0.0001) bearishSignals.push(`Funding: positive (${(fr * 100).toFixed(4)}%)`);
  else if (fr <= -0.001) bullishSignals.push(`Funding: extreme shorts (${(fr * 100).toFixed(4)}%)`);
  else if (fr <= -0.0001) bullishSignals.push(`Funding: negative (${(fr * 100).toFixed(4)}%)`);
  else neutralSignals.push(`Funding: neutral (${(fr * 100).toFixed(4)}%)`);

  // 5. OI
  const oiInterp = flow.openInterest.interpretation;
  if (oiInterp.includes('buyers entering')) bullishSignals.push('OI: rising with price (new longs)');
  else if (oiInterp.includes('short covering')) bullishSignals.push('OI: falling with price (short covering)');
  else if (oiInterp.includes('new shorts')) bearishSignals.push('OI: rising as price falls (new shorts)');
  else if (oiInterp.includes('profit-taking')) bearishSignals.push('OI: falling as price rises (profit-taking)');
  else neutralSignals.push('OI: neutral');

  // 6. Long/Short
  const lsr = flow.longShort.ratio;
  if (lsr > 1.5) bearishSignals.push(`L/S ratio: ${lsr.toFixed(2)} — crowded longs`);
  else if (lsr > 1.2) bearishSignals.push(`L/S ratio: ${lsr.toFixed(2)} — mild long bias`);
  else if (lsr < 0.7) bullishSignals.push(`L/S ratio: ${lsr.toFixed(2)} — crowded shorts`);
  else if (lsr < 0.85) bullishSignals.push(`L/S ratio: ${lsr.toFixed(2)} — mild short bias`);
  else neutralSignals.push(`L/S ratio: ${lsr.toFixed(2)} — balanced`);

  // 7. CVD
  const cvd = flow.cvd.divergence;
  const cvdVals = flow.cvd.values;
  if (cvd === 'bullish') bullishSignals.push('CVD: bullish divergence');
  else if (cvd === 'bearish') bearishSignals.push('CVD: bearish divergence');
  else if (cvdVals.length >= 2) {
    const trend = cvdVals[cvdVals.length - 1] - cvdVals[0];
    if (trend > 0) bullishSignals.push('CVD: rising (buy pressure)');
    else if (trend < 0) bearishSignals.push('CVD: falling (sell pressure)');
    else neutralSignals.push('CVD: flat');
  } else neutralSignals.push('CVD: insufficient data');

  // 8. Order blocks bias
  const bullOBs = structure.orderBlocks.filter(ob => ob.type === 'bull').length;
  const bearOBs = structure.orderBlocks.filter(ob => ob.type === 'bear').length;
  if (bullOBs > bearOBs) bullishSignals.push(`OBs: ${bullOBs} bullish vs ${bearOBs} bearish`);
  else if (bearOBs > bullOBs) bearishSignals.push(`OBs: ${bearOBs} bearish vs ${bullOBs} bullish`);
  else neutralSignals.push(`OBs: balanced (${bullOBs} each)`);

  const total = bullishSignals.length + bearishSignals.length + neutralSignals.length;
  const dominantCount = Math.max(bullishSignals.length, bearishSignals.length);
  const agreementRatio = total > 0 ? dominantCount / total : 0;
  const dominantBias: 'bullish' | 'bearish' | 'neutral' =
    bullishSignals.length > bearishSignals.length ? 'bullish'
    : bearishSignals.length > bullishSignals.length ? 'bearish'
    : 'neutral';

  // Confidence = agreement ratio scaled, minimum 50
  const confidence = Math.round(50 + agreementRatio * 50);

  return { bullishSignals, bearishSignals, neutralSignals, agreementRatio, dominantBias, confidence };
}

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

  // Funding (10%)
  const fundingRate = flow.funding.current;
  if      (fundingRate >= 0.001)   { bearishRaw += 10; details['funding'] = -10; }
  else if (fundingRate >= 0.0005)  { bearishRaw += 7;  details['funding'] = -7;  }
  else if (fundingRate >= 0.0001)  { bearishRaw += 4;  details['funding'] = -4;  }
  else if (fundingRate <= -0.001)  { bullishRaw += 10; details['funding'] = 10;  }
  else if (fundingRate <= -0.0005) { bullishRaw += 7;  details['funding'] = 7;   }
  else if (fundingRate <= -0.0001) { bullishRaw += 4;  details['funding'] = 4;   }
  else                             {                   details['funding'] = 0;   }

  // L/S Ratio (10%)
  const lsRatio = flow.longShort.ratio;
  if (lsRatio > 1.5)      { bearishRaw += 10; details['longShort'] = -10; }
  else if (lsRatio > 1.2) { bearishRaw += 5;  details['longShort'] = -5;  }
  else if (lsRatio < 0.7) { bullishRaw += 10; details['longShort'] = 10;  }
  else if (lsRatio < 0.85){ bullishRaw += 5;  details['longShort'] = 5;   }
  else                     {                   details['longShort'] = 0;   }

  // CVD (10%)
  const cvdDiv = flow.cvd.divergence;
  const cvdValues = flow.cvd.values;
  if (cvdDiv === 'bullish')      { bullishRaw += 10; details['cvd'] = 10;  }
  else if (cvdDiv === 'bearish') { bearishRaw += 10; details['cvd'] = -10; }
  else if (cvdValues.length >= 2) {
    const cvdTrend = cvdValues[cvdValues.length - 1] - cvdValues[0];
    if (cvdTrend > 0 && structure.trend === 'bullish')      { bullishRaw += 5; details['cvd'] = 5;  }
    else if (cvdTrend < 0 && structure.trend === 'bearish') { bearishRaw += 5; details['cvd'] = -5; }
    else if (cvdTrend > 0 && structure.trend === 'bearish') { bullishRaw += 3; details['cvd'] = 3;  }
    else if (cvdTrend < 0 && structure.trend === 'bullish') { bearishRaw += 3; details['cvd'] = -3; }
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

  // FIX 2: use signal agreement for confidence
  const agreement = computeSignalAgreement(structure, flow);
  const confidence = agreement.confidence;

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

/** FIX 2: Maps SignalAgreement to ConfidenceBreakdownItem[] for backward compatibility */
export function buildConfidenceBreakdown(
  structure: MarketStructure,
  flow: FlowData,
  score: InstitutionalScore,
  mtfRows: MTFRow[],
): ConfidenceBreakdownItem[] {
  const agreement = computeSignalAgreement(structure, flow);
  const items: ConfidenceBreakdownItem[] = [];

  // Summary item
  items.push({
    factor: 'Signal Agreement',
    value: Math.round(agreement.agreementRatio * 100),
    reason: `${agreement.bullishSignals.length} bullish / ${agreement.neutralSignals.length} neutral / ${agreement.bearishSignals.length} bearish signals → ${agreement.dominantBias} bias`,
  });

  // Bullish signals
  for (const sig of agreement.bullishSignals) {
    items.push({ factor: 'Bullish Signal', value: 1, reason: sig });
  }

  // Bearish signals
  for (const sig of agreement.bearishSignals) {
    items.push({ factor: 'Bearish Signal', value: -1, reason: sig });
  }

  // Neutral signals
  for (const sig of agreement.neutralSignals) {
    items.push({ factor: 'Neutral Signal', value: 0, reason: sig });
  }

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

  return items;
}
