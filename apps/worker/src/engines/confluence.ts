import type { MarketStructure, FlowData, InstitutionalScore, TradeReport } from '../types';

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

export function generateZones(structure: MarketStructure, flow: FlowData): {
  long_zones: TradeReport['long_zones'];
  short_zones: TradeReport['short_zones'];
  invalidation_level: number;
} {
  const long_zones: TradeReport['long_zones'] = [];
  const short_zones: TradeReport['short_zones'] = [];

  for (const ob of structure.orderBlocks) {
    if (ob.type === 'bull') {
      const reasons: string[] = ['Bullish OB'];
      const matchingFVG = structure.fvgs.find(f => f.type === 'bull' && f.start >= ob.low && f.end <= ob.high);
      if (matchingFVG) reasons.push('FVG overlap');
      long_zones.push({ from: ob.low, to: ob.high, reason: reasons.join(' + ') });
    } else {
      const reasons: string[] = ['Bearish OB'];
      const matchingFVG = structure.fvgs.find(f => f.type === 'bear' && f.start >= ob.low && f.end <= ob.high);
      if (matchingFVG) reasons.push('FVG overlap');
      short_zones.push({ from: ob.low, to: ob.high, reason: reasons.join(' + ') });
    }
  }

  const swingHighPrices = structure.swingHighs.map(s => s.price);
  const invalidation_level = swingHighPrices.length > 0 ? Math.max(...swingHighPrices) : 0;

  return { long_zones: long_zones.slice(0, 3), short_zones: short_zones.slice(0, 3), invalidation_level };
}

export function generateScenarios(structure: MarketStructure, flow: FlowData, score: InstitutionalScore): {
  primary: string;
  alternative: string;
} {
  const trend = structure.trend;
  const lsRatio = flow.longShort.ratio;
  const funding = flow.funding.current;

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
