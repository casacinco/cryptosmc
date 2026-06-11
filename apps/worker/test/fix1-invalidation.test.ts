// Run: node --experimental-strip-types apps/worker/test/fix1-invalidation.test.ts
import { generateZones } from '../src/engines/confluence.ts';
import { analyzeStructure } from '../src/engines/smc.ts';
import type { Candle, FlowData } from '../src/types.ts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, info = '') {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, info); }
}

// Synthetic downtrend with pullbacks (generates bearish OBs + swing highs)
function downtrendCandles(n = 100, start = 100000): Candle[] {
  const candles: Candle[] = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    const wave = Math.sin(i * 0.3927) * 1500; // pullback waves (period ~16 candles, slope beats drift)
    const drift = -i * 200;                    // downtrend
    const open = price;
    const close = start + drift + wave;
    const jitter = (i % 5) * 13 + (i % 3) * 7; // break ties so swings are detectable
    const high = Math.max(open, close) + 200 + jitter;
    const low = Math.min(open, close) - 200 - jitter;
    candles.push({ t: 1700000000000 + i * 3600000, open, high, low, close, volume: 1000 + (i % 7) * 300 });
    price = close;
  }
  return candles;
}

// Synthetic uptrend
function uptrendCandles(n = 100, start = 100000): Candle[] {
  return downtrendCandles(n, start).map((c, i) => {
    const flip = (v: number) => 2 * start - v;
    return { ...c, open: flip(c.open), close: flip(c.close), high: flip(c.low), low: flip(c.high) };
  });
}

const emptyFlow: FlowData = {
  openInterest: { current: 0, change24h: 0, interpretation: '' },
  funding: { current: 0, status: '', meaning: '' },
  longShort: { ratio: 1, interpretation: '' },
  cvd: { values: [], divergence: 'none' },
};

// ── Test 1: bearish trend → global invalidation = last swing HIGH (above price action) ──
{
  const candles = downtrendCandles();
  const s = analyzeStructure('TEST', '4H', candles);
  const { long_zones, short_zones, invalidation_level } = generateZones(s, emptyFlow);
  const lastClose = candles[candles.length - 1].close;

  console.log('\n[bearish] trend:', s.trend, '| invalidation:', invalidation_level.toFixed(0), '| close:', lastClose.toFixed(0));
  if (s.trend === 'bearish') {
    const lastSwingHigh = s.swingHighs[s.swingHighs.length - 1].price;
    check('bearish: invalidation == last swing high', invalidation_level === lastSwingHigh,
      `got ${invalidation_level} expected ${lastSwingHigh}`);
  }

  // Per-zone invariants
  for (const z of short_zones) {
    check(`short zone inv ABOVE zone (${z.invalidation?.toFixed(0)} > ${z.to.toFixed(0)})`, (z.invalidation ?? 0) > z.to);
  }
  for (const z of long_zones) {
    check(`long zone inv BELOW zone (${z.invalidation?.toFixed(0)} < ${z.from.toFixed(0)})`, (z.invalidation ?? Infinity) < z.from);
  }
}

// ── Test 2: bullish trend → global invalidation = last swing LOW ──
{
  const candles = uptrendCandles();
  const s = analyzeStructure('TEST', '4H', candles);
  const { long_zones, short_zones, invalidation_level } = generateZones(s, emptyFlow);
  console.log('\n[bullish] trend:', s.trend, '| invalidation:', invalidation_level.toFixed(0));
  if (s.trend === 'bullish') {
    const lastSwingLow = s.swingLows[s.swingLows.length - 1].price;
    check('bullish: invalidation == last swing low', invalidation_level === lastSwingLow,
      `got ${invalidation_level} expected ${lastSwingLow}`);
  }
  for (const z of long_zones) {
    check(`long zone inv BELOW zone (${z.invalidation?.toFixed(0)} < ${z.from.toFixed(0)})`, (z.invalidation ?? Infinity) < z.from);
  }
  for (const z of short_zones) {
    check(`short zone inv ABOVE zone (${z.invalidation?.toFixed(0)} > ${z.to.toFixed(0)})`, (z.invalidation ?? 0) > z.to);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
