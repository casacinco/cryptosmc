import type { MarketStructure, FlowData, InstitutionalScore, TradeReport, ClassifiedZone } from '../types';

export function computeConfluence(structure: MarketStructure, flow: FlowData, score: InstitutionalScore) {
  let longScore = 0;
  let shortScore = 0;
  const details: Record<string, any> = {};

  const bullOBs = structure.orderBlocks.filter(ob => ob.type === 'bull');
  const bearOBs = structure.orderBlocks.filter(ob => ob.type === 'bear');
  const bullFVGs = structure.fvgs.filter(f => f.type === 'bull');
  const bearFVGs = structure.fvgs.filter(f => f.type === 'bear');

  longScore += bullOBs.length * 20;
  shortScore += bearOBs.length * 20;
  longScore += bullFVGs.length * 15;
  shortScore += bearFVGs.length * 15;

  if (flow.funding.current > 0.001)  { shortScore += 10; details['fundingExtreme'] = 'bearish'; }
  if (flow.funding.current < -0.001) { longScore += 10;  details['fundingExtreme'] = 'bullish'; }

  if (flow.longShort.ratio > 1.5) { shortScore += 10; details['lsImbalance'] = 'heavy longs'; }
  if (flow.longShort.ratio < 0.7) { longScore += 10; details['lsImbalance'] = 'heavy shorts'; }

  if (flow.cvd.divergence === 'bullish') { longScore += 10; details['cvdDiv'] = 'bullish'; }
  if (flow.cvd.divergence === 'bearish') { shortScore += 10; details['cvdDiv'] = 'bearish'; }

  if (structure.trend === 'bullish') longScore += 20;
  if (structure.trend === 'bearish') shortScore += 20;

  details['bullishOBs'] = bullOBs.length;
  details['bearishOBs'] = bearOBs.length;
  details['bullishFVGs'] = bullFVGs.length;
  details['bearishFVGs'] = bearFVGs.length;

  return {
    longConfluenceScore: Math.min(100, longScore),
    shortConfluenceScore: Math.min(100, shortScore),
    details,
  };
}

// ─── FIX 6: Trade Zone Classification ────────────────────────────────────────

function classifyZone(
  zoneType: 'long' | 'short',
  trend: MarketStructure['trend'],
  confluenceScore: number,
  reasons: string[],
): ClassifiedZone & { type: 'long' | 'short'; from: number; to: number } {
  // Placeholder — actual from/to are set by caller
  const classification: 'trend-following' | 'counter-trend' =
    (zoneType === 'long' && trend === 'bullish') ||
    (zoneType === 'short' && trend === 'bearish')
      ? 'trend-following'
      : 'counter-trend';

  let probability: number;
  if (classification === 'trend-following') {
    probability = Math.min(75, 55 + Math.round(confluenceScore / 10));
  } else {
    probability = Math.min(55, 35 + Math.round(confluenceScore / 10));
  }

  const riskLevel: 'low' | 'medium' | 'high' =
    classification === 'trend-following'
      ? 'low'
      : confluenceScore >= 50
      ? 'medium'
      : 'high';

  return {
    from: 0,
    to: 0,
    reason: reasons.join(' + '),
    classification,
    probability,
    confluenceScore,
    riskLevel,
    type: zoneType,
  };
}

export function generateZones(structure: MarketStructure, flow: FlowData): {
  long_zones: TradeReport['long_zones'];
  short_zones: TradeReport['short_zones'];
  invalidation_level: number;
} {
  const long_zones: ClassifiedZone[] = [];
  const short_zones: ClassifiedZone[] = [];

  for (const ob of structure.orderBlocks) {
    const zoneHeight = ob.high - ob.low;
    if (ob.type === 'bull') {
      const reasons: string[] = ['Bullish OB'];
      const matchingFVG = structure.fvgs.find(f => f.type === 'bull' && f.start >= ob.low && f.end <= ob.high);
      if (matchingFVG) reasons.push('FVG overlap');
      const confluenceScore = Math.min(100, reasons.length * 40 + 20);
      const baseZone = classifyZone('long', structure.trend, confluenceScore, reasons);

      // Trade plan (long):
      // Entry at 50% of the OB (consequent encroachment)
      const entry = (ob.low + ob.high) / 2;
      // SL below the zone: nearest swing low under it, but never tighter than the
      // 25% zone-height buffer NOR 0.5% of entry (risk floor for tiny zones)
      const bufferSL = Math.min(ob.low - zoneHeight * 0.25, entry * 0.995);
      const swingLowBelow = structure.swingLows.filter(s => s.price < ob.low).map(s => s.price);
      const invalidation = swingLowBelow.length > 0
        ? Math.min(Math.max(...swingLowBelow), bufferSL)
        : bufferSL;
      const stopLoss = invalidation;
      // TP: nearest target above entry among BSL pools and swing highs → fallback 2R.
      // Capped at 5R — first scale-out target; structural target may sit further.
      const risk = entry - stopLoss;
      const targetsAbove = [
        ...structure.liquidityPools.filter(p => p.type === 'BSL' && p.price > entry).map(p => p.price),
        ...structure.swingHighs.filter(s => s.price > entry).map(s => s.price),
      ];
      const structuralTP = targetsAbove.length > 0 ? Math.min(...targetsAbove) : entry + risk * 2;
      const takeProfit = Math.min(structuralTP, entry + risk * 5);
      const riskReward = risk > 0 ? Math.round(((takeProfit - entry) / risk) * 100) / 100 : 0;

      long_zones.push({
        from: ob.low,
        to: ob.high,
        invalidation,
        entry,
        stopLoss,
        takeProfit,
        riskReward,
        reason: baseZone.reason,
        classification: baseZone.classification,
        probability: baseZone.probability,
        confluenceScore: baseZone.confluenceScore,
        riskLevel: baseZone.riskLevel,
      });
    } else {
      const reasons: string[] = ['Bearish OB'];
      const matchingFVG = structure.fvgs.find(f => f.type === 'bear' && f.start >= ob.low && f.end <= ob.high);
      if (matchingFVG) reasons.push('FVG overlap');
      const confluenceScore = Math.min(100, reasons.length * 40 + 20);
      const baseZone = classifyZone('short', structure.trend, confluenceScore, reasons);

      // Trade plan (short):
      const entry = (ob.low + ob.high) / 2;
      // SL above the zone: nearest swing high over it, but never tighter than the
      // 25% zone-height buffer NOR 0.5% of entry (risk floor for tiny zones)
      const bufferSL = Math.max(ob.high + zoneHeight * 0.25, entry * 1.005);
      const swingHighAbove = structure.swingHighs.filter(s => s.price > ob.high).map(s => s.price);
      const invalidation = swingHighAbove.length > 0
        ? Math.max(Math.min(...swingHighAbove), bufferSL)
        : bufferSL;
      const stopLoss = invalidation;
      // TP: nearest target below entry among SSL pools and swing lows → fallback 2R.
      // Capped at 5R — first scale-out target; structural target may sit further.
      const risk = stopLoss - entry;
      const targetsBelow = [
        ...structure.liquidityPools.filter(p => p.type === 'SSL' && p.price < entry).map(p => p.price),
        ...structure.swingLows.filter(s => s.price < entry).map(s => s.price),
      ];
      const structuralTP = targetsBelow.length > 0 ? Math.max(...targetsBelow) : entry - risk * 2;
      const takeProfit = Math.max(structuralTP, entry - risk * 5);
      const riskReward = risk > 0 ? Math.round(((entry - takeProfit) / risk) * 100) / 100 : 0;

      short_zones.push({
        from: ob.low,
        to: ob.high,
        invalidation,
        entry,
        stopLoss,
        takeProfit,
        riskReward,
        reason: baseZone.reason,
        classification: baseZone.classification,
        probability: baseZone.probability,
        confluenceScore: baseZone.confluenceScore,
        riskLevel: baseZone.riskLevel,
      });
    }
  }

  // Scenario-level invalidation is direction-aware:
  // bullish trend dies below the last confirmed swing low (HL);
  // bearish trend dies above the last confirmed swing high (LH).
  let invalidation_level = 0;
  if (structure.trend === 'bullish' && structure.swingLows.length > 0) {
    invalidation_level = structure.swingLows[structure.swingLows.length - 1].price;
  } else if (structure.trend === 'bearish' && structure.swingHighs.length > 0) {
    invalidation_level = structure.swingHighs[structure.swingHighs.length - 1].price;
  }

  return {
    long_zones: long_zones.slice(0, 3),
    short_zones: short_zones.slice(0, 3),
    invalidation_level,
  };
}

export function generateScenarios(structure: MarketStructure, flow: FlowData, score: InstitutionalScore): {
  primary: string;
  alternative: string;
} {
  const trend = structure.trend;

  let primary: string;
  let alternative: string;

  if (trend === 'bearish') {
    const target = structure.swingLows.length > 0 ? structure.swingLows[structure.swingLows.length - 1].price.toFixed(0) : 'recent lows';
    primary = `Bearish continuation targeting ${target} — structure confirms downtrend with ${score.bearish}% bearish score.`;
    const altLevel = structure.swingHighs.length > 0 ? structure.swingHighs[structure.swingHighs.length - 1].price.toFixed(0) : 'key resistance';
    alternative = `Bullish reversal if CHoCH forms above ${altLevel} — watch for volume confirmation.`;
  } else if (trend === 'bullish') {
    const target = structure.swingHighs.length > 0 ? structure.swingHighs[structure.swingHighs.length - 1].price.toFixed(0) : 'recent highs';
    primary = `Bullish continuation targeting ${target} — structure confirms uptrend with ${score.bullish}% bullish score.`;
    const altLevel = structure.swingLows.length > 0 ? structure.swingLows[structure.swingLows.length - 1].price.toFixed(0) : 'key support';
    alternative = `Bearish reversal if price breaks below ${altLevel} with strong momentum.`;
  } else {
    primary = `Range-bound market — wait for breakout of range extremes before committing to direction.`;
    alternative = `Watch for fake-out beyond range highs/lows (liquidity sweep) before reversal.`;
  }

  return { primary, alternative };
}
