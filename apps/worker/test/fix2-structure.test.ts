// Run: node --experimental-strip-types apps/worker/test/fix2-structure.test.ts
import { detectStructureEvents } from '../src/engines/smc.ts';
import type { Candle } from '../src/types.ts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, info = '') {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name, info); }
}

function bar(open: number, close: number, hi?: number, lo?: number): Candle {
  return {
    t: 0,
    open, close,
    high: hi ?? Math.max(open, close) + 0.3,
    low: lo ?? Math.min(open, close) - 0.3,
    volume: 1000,
  };
}

// ── Test 1: clean bullish staircase — HH after pullback, close breaks prior swing high ──
// Build: rally to 110, pullback to 104, rally CLOSES above 110 → 1 bullish BOS (from ranging)
{
  const c = [
    bar(100, 102), bar(102, 105), bar(105, 110, 111), // up leg, swing high 111 at idx 2
    bar(110, 107), bar(107, 104, undefined, 103),     // pullback, swing low 103 at idx 4
    bar(104, 106), bar(106, 109),                     // recovery (confirms swings)
    bar(109, 113),                                    // CLOSE 113 > 111 → bullish break
    bar(113, 115), bar(115, 114),
  ];
  const ev = detectStructureEvents(c);
  console.log('\n[staircase] bos:', JSON.stringify(ev.bos), 'choch:', JSON.stringify(ev.choch), 'trend:', ev.trend);
  check('staircase: exactly 1 bullish BOS', ev.bos.length === 1 && ev.bos[0].type === 'bullish', JSON.stringify(ev.bos));
  check('staircase: BOS price = broken swing (111)', ev.bos[0]?.price === 111, String(ev.bos[0]?.price));
  check('staircase: BOS at break candle (idx 7)', ev.bos[0]?.index === 7, String(ev.bos[0]?.index));
  check('staircase: no CHoCH', ev.choch.length === 0);
  check('staircase: trend bullish', ev.trend === 'bullish');
}

// ── Test 2: OLD BUG — higher high WITHOUT close beyond must NOT be BOS ──
// Swing high 111, pullback, then a higher WICK (high 112) but close stays below 111
{
  const c = [
    bar(100, 102), bar(102, 105), bar(105, 110, 111),  // swing high 111 @ idx 2
    bar(110, 107), bar(107, 104, undefined, 103),       // pullback
    bar(104, 106), bar(106, 108),
    bar(108, 110, 112),                                 // wick to 112 but CLOSE 110 < 111
    bar(110, 108), bar(108, 107),
  ];
  const ev = detectStructureEvents(c);
  console.log('\n[wick-no-close] bos:', JSON.stringify(ev.bos), 'trend:', ev.trend);
  check('wick without close beyond: NO bullish BOS', ev.bos.filter(b => b.type === 'bullish').length === 0, JSON.stringify(ev.bos));
}

// ── Test 3: downtrend then reversal — bearish BOS chain, then bullish CHoCH ──
{
  const c = [
    bar(120, 118, 120.5, 117.5),   // 0
    bar(118, 116, 118.3, 115.7),   // 1
    bar(116, 114, 116.3, 113.5),   // 2  swing LOW 113.5 (confirmed @4)
    bar(114, 116, 116.5, 113.8),   // 3
    bar(116, 117.5, 118.0, 115.7), // 4  swing HIGH 118.0 — the LH (confirmed @6)
    bar(117.5, 115, 117.8, 114.7), // 5
    bar(115, 112.8, 115.3, 112.5), // 6  CLOSE 112.8 < 113.5 → bearish break #1
    bar(112.8, 111, 113.1, 110.5), // 7  swing LOW 110.5 (confirmed @9)
    bar(111, 112.5, 113.0, 110.8), // 8
    bar(112.5, 113.6, 114.0, 112.2),// 9 swing HIGH 114.0 — LH (confirmed @11)
    bar(113.6, 112, 113.8, 111.7), // 10
    bar(112, 110, 112.3, 109.7),   // 11 CLOSE 110 < 110.5 → bearish BOS #2
    bar(110, 109.5, 110.4, 109.0), // 12 bottom
    bar(109.5, 111, 111.4, 109.2), // 13
    bar(111, 114.5, 115.0, 110.7), // 14 CLOSE 114.5 > 114.0 (LH) → bullish CHoCH!
    bar(114.5, 115, 115.4, 114.2), // 15
    bar(115, 115.5, 115.9, 114.7), // 16
  ];
  const ev = detectStructureEvents(c);
  console.log('\n[reversal] bos:', JSON.stringify(ev.bos), 'choch:', JSON.stringify(ev.choch), 'trend:', ev.trend);
  check('reversal: has bearish BOS', ev.bos.some(b => b.type === 'bearish'), JSON.stringify(ev.bos));
  check('reversal: exactly 1 bullish CHoCH', ev.choch.length === 1 && ev.choch[0].type === 'bullish', JSON.stringify(ev.choch));
  check('reversal: trend flipped to bullish', ev.trend === 'bullish');
  check('reversal: CHoCH after last bearish BOS',
    ev.choch.length > 0 && ev.bos.length > 0 && ev.choch[0].index > Math.max(...ev.bos.map(b => b.index)));
}

// ── Test 4: tight range — no false BOS/CHoCH spam ──
{
  const c: Candle[] = [];
  for (let i = 0; i < 40; i++) {
    const mid = 100 + Math.sin(i * 0.8) * 0.5; // oscillates 99.5–100.5
    c.push(bar(mid, mid + 0.2, mid + 0.4, mid - 0.4));
  }
  const ev = detectStructureEvents(c);
  console.log('\n[range] bos:', ev.bos.length, 'choch:', ev.choch.length, 'trend:', ev.trend);
  check('range: total events < 6 (old algo would spam)', ev.bos.length + ev.choch.length < 6,
    `${ev.bos.length + ev.choch.length} events`);
}

// ── Test 5: strong rally must not re-break stale swing highs repeatedly ──
{
  const c = [
    bar(100, 101, 102), bar(101, 100.5), bar(100.5, 100, undefined, 99.5),
    bar(100, 100.8), bar(100.8, 101),
    // explosive rally — 10 candles straight up
    bar(101, 104), bar(104, 107), bar(107, 110), bar(110, 113), bar(113, 116),
    bar(116, 119), bar(119, 122), bar(122, 125), bar(125, 128), bar(128, 131),
  ];
  const ev = detectStructureEvents(c);
  console.log('\n[rally] bos:', JSON.stringify(ev.bos), 'choch:', ev.choch.length);
  check('rally: at most 1 bullish break (no stale re-breaks)',
    ev.bos.filter(b => b.type === 'bullish').length <= 1, JSON.stringify(ev.bos));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
