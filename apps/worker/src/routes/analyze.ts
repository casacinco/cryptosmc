import type { Context } from 'hono';
import type { Env, Candle, TradeReport, AuditData, DataSourceStatus, TradeZoneAudit, MTFRow } from '../types';
import { fetchCandles, fetchOpenInterest, fetchOpenInterestHistory, fetchFundingRate, fetchLongShortRatio } from '../providers/binance';
import { fetchLiquidationHeatmap } from '../providers/coinglass';
import { fetchOI as coinalyzeOI, fetchFunding as coinalyzeFunding, fetchLongShortHistory as coinalyzeLS, toCoinalyzeSymbol } from '../providers/coinalyze';
import {
  analyzeStructure, enrichBOS, enrichCHoCH, enrichOrderBlocks, enrichFVGs, enrichLiquidityPools,
  getStructureDebugInfo, backtestOrderBlocks, backtestFVGs,
} from '../engines/smc';
import { analyzeFlow } from '../engines/flow';
import { computeScores, buildScoreBreakdown, buildConfidenceBreakdown, computeSignalAgreement } from '../engines/scoring';
import { generateZones, generateScenarios } from '../engines/confluence';
import { getCache, setCache } from '../db/cache';

// Shape of the Binance data the client can send via POST
interface ClientBinanceData {
  candles1D: Candle[];
  candles4H: Candle[];
  candles1H: Candle[];
  oi: { symbol: string; openInterest: string; time: number };
  oiHistory: { symbol: string; sumOpenInterest: string; timestamp: number }[];
  funding: { symbol: string; fundingRate: string; fundingTime: number }[];
  longShort: { symbol: string; longShortRatio: string; longAccount: string; shortAccount: string; timestamp: number }[];
  heatmap: { price: number; usdValue: number; side: 'long' | 'short' }[];
}

/** Try fetching from Worker (may fail with 403 on Cloudflare IPs) */
async function fetchBinanceFromWorker(symbol: string): Promise<ClientBinanceData> {
  const [candles1D, candles4H, candles1H, oi, oiHistory, funding, longShort, heatmap] = await Promise.all([
    fetchCandles(symbol, '1d', 400),
    fetchCandles(symbol, '4h', 400),
    fetchCandles(symbol, '1h', 400),
    fetchOpenInterest(symbol),
    fetchOpenInterestHistory(symbol),
    fetchFundingRate(symbol, 1),
    fetchLongShortRatio(symbol, '5m', 1),
    fetchLiquidationHeatmap(symbol),
  ]);
  return { candles1D, candles4H, candles1H, oi, oiHistory, funding, longShort, heatmap };
}

export async function handleAnalyze(c: Context<{ Bindings: Env }>) {
  const symbol = c.req.query('symbol') || 'BTCUSDT';
  const cacheKey = `analyze:${symbol}`;

  const cached = await getCache(c.env.DB, cacheKey);
  if (cached) return c.json(cached);

  try {
    // Determine data source: POST body (client-fetched) or Worker fetch (fallback)
    let binance: ClientBinanceData;
    if (c.req.method === 'POST') {
      const body = await c.req.json<{ binanceData: ClientBinanceData }>();
      binance = body.binanceData;
    } else {
      // GET fallback — may fail if Binance blocks Worker IPs
      binance = await fetchBinanceFromWorker(symbol);
    }

    const { candles1D, candles4H, candles1H, oi: oiRaw, oiHistory, funding: fundingRaw, longShort: lsRaw, heatmap } = binance;

    // Coinalyze stays server-side (needs API key)
    const clzSymbol = toCoinalyzeSymbol(symbol);
    const apiKey = c.env.COINALYZE_API_KEY;

    const [clzOIData, clzFundingData, clzLSData] = await Promise.all([
      coinalyzeOI([clzSymbol], apiKey),
      coinalyzeFunding([clzSymbol], apiKey),
      coinalyzeLS(clzSymbol, '1hour', apiKey),
    ]);

    const structure1D = analyzeStructure(symbol, '1D', candles1D);
    const structure4H = analyzeStructure(symbol, '4H', candles4H);
    const structure1H = analyzeStructure(symbol, '1H', candles1H);

    const clzOI = clzOIData[0] ?? null;
    const clzFunding = clzFundingData[0] ?? null;
    const clzLS = clzLSData.length > 0 ? clzLSData[clzLSData.length - 1] : null;
    const coinalyzeConnected = clzOI !== null || clzFunding !== null;

    const flow = analyzeFlow(candles4H, {
      binanceOI: oiRaw,
      binanceOIHistory: oiHistory,
      binanceFunding: fundingRaw[0] || null,
      binanceLS: lsRaw[0] || null,
      coinalyzeOI: clzOI,
      coinalyzeFunding: clzFunding,
      coinalyzeLS: clzLS,
    });
    const score = computeScores(structure4H, flow, heatmap);
    const { primary, alternative } = generateScenarios(structure4H, flow, score);
    const { long_zones, short_zones, invalidation_level } = generateZones(structure4H, flow);

    // ─── Audit Data ───────────────────────────────────────────────────────────

    // Build MTF rows
    const mtfRows: MTFRow[] = [
      {
        timeframe: '1D',
        trend: structure1D.trend,
        bosCount: structure1D.bos.length,
        chochCount: structure1D.choch.length,
        obCount: structure1D.orderBlocks.length,
        fvgCount: structure1D.fvgs.length,
        liquidityCount: structure1D.liquidityPools.length,
      },
      {
        timeframe: '4H',
        trend: structure4H.trend,
        bosCount: structure4H.bos.length,
        chochCount: structure4H.choch.length,
        obCount: structure4H.orderBlocks.length,
        fvgCount: structure4H.fvgs.length,
        liquidityCount: structure4H.liquidityPools.length,
      },
      {
        timeframe: '1H',
        trend: structure1H.trend,
        bosCount: structure1H.bos.length,
        chochCount: structure1H.choch.length,
        obCount: structure1H.orderBlocks.length,
        fvgCount: structure1H.fvgs.length,
        liquidityCount: structure1H.liquidityPools.length,
      },
    ];

    // FIX 1: Structure debug info per timeframe
    const debug1D = getStructureDebugInfo(candles1D, '1D');
    const debug4H = getStructureDebugInfo(candles4H, '4H');
    const debug1H = getStructureDebugInfo(candles1H, '1H');

    const mtfWarning = (
      debug1D.bosCount === debug4H.bosCount && debug4H.bosCount === debug1H.bosCount &&
      debug1D.chochCount === debug4H.chochCount
    ) ? 'Possible timeframe calculation issue: all timeframes returned identical BOS/CHoCH counts.' : null;

    // Backward compat: also set consistencyWarning
    const allSame =
      mtfRows.every(
        r =>
          r.bosCount === mtfRows[0].bosCount &&
          r.obCount === mtfRows[0].obCount &&
          r.fvgCount === mtfRows[0].fvgCount,
      );
    const consistencyWarning = allSame
      ? 'All timeframes returned identical structure counts — possible cache or calculation issue.'
      : null;

    // Data source status
    const dataSources: DataSourceStatus[] = [
      {
        name: 'Binance Futures',
        connected: candles4H.length > 0,
        lastUpdate: Date.now(),
        endpoint: 'fapi.binance.com',
        note: c.req.method === 'POST'
          ? 'Client-side fetch (browser → Binance direct)'
          : 'Worker-side fetch',
      },
      {
        name: 'Coinalyze',
        connected: coinalyzeConnected,
        lastUpdate: clzOI?.update ? clzOI.update * 1000 : (clzFunding?.update ? clzFunding.update * 1000 : 0),
        endpoint: 'api.coinalyze.net',
        note: coinalyzeConnected
          ? `Binance data via Coinalyze (free tier — .3 suffix). Upgrade for multi-exchange aggregation.`
          : `Symbol ${clzSymbol} not found — free tier may not support this pair`,
      },
      {
        name: 'CoinGlass',
        connected: false,
        lastUpdate: 0,
        endpoint: 'open-api-v4.coinglass.com',
        note: 'Free tier unavailable — liquidation heatmap from Binance /allForceOrders',
      },
    ];

    // Enrich structures
    const enrichedBOS4H = enrichBOS(candles4H, structure4H.bos, '4H');
    const enrichedCHoCH4H = enrichCHoCH(candles4H, structure4H.choch, '4H', structure4H.trend);
    const enrichedOBs = enrichOrderBlocks(candles4H, structure4H.orderBlocks);
    const enrichedFVGs = enrichFVGs(candles4H, structure4H.fvgs);
    const enrichedLiq = enrichLiquidityPools(candles4H, structure4H.liquidityPools);

    // Trade zone audit with confluence reasons
    const tradeZoneAudit: TradeZoneAudit[] = [
      ...long_zones.map(z => {
        const matchingOB = structure4H.orderBlocks.find(
          ob => ob.type === 'bull' && ob.low <= z.to && ob.high >= z.from,
        );
        const matchingFVG = structure4H.fvgs.find(
          f => f.type === 'bull' && f.start <= z.to && f.end >= z.from,
        );
        const matchingSSL = structure4H.liquidityPools.find(
          p => p.type === 'SSL' && Math.abs(p.price - z.from) / z.from < 0.02,
        );
        const confluences: string[] = [];
        if (matchingOB) confluences.push(`Bullish OB (${matchingOB.low.toFixed(0)}–${matchingOB.high.toFixed(0)})`);
        if (matchingFVG) confluences.push(`Unfilled FVG (${matchingFVG.start.toFixed(0)}–${matchingFVG.end.toFixed(0)})`);
        if (matchingSSL) confluences.push(`SSL nearby (${matchingSSL.price.toFixed(0)})`);
        if (flow.funding.current > 0.0005) confluences.push('High funding favors long reversal');
        return {
          type: 'long' as const,
          from: z.from,
          to: z.to,
          score: Math.min(100, confluences.length * 25 + 25),
          confluences,
          reasons: [z.reason],
        };
      }),
      ...short_zones.map(z => {
        const matchingOB = structure4H.orderBlocks.find(
          ob => ob.type === 'bear' && ob.low <= z.to && ob.high >= z.from,
        );
        const matchingFVG = structure4H.fvgs.find(
          f => f.type === 'bear' && f.start <= z.to && f.end >= z.from,
        );
        const matchingBSL = structure4H.liquidityPools.find(
          p => p.type === 'BSL' && Math.abs(p.price - z.to) / z.to < 0.02,
        );
        const confluences: string[] = [];
        if (matchingOB) confluences.push(`Bearish OB (${matchingOB.low.toFixed(0)}–${matchingOB.high.toFixed(0)})`);
        if (matchingFVG) confluences.push(`Unfilled FVG (${matchingFVG.start.toFixed(0)}–${matchingFVG.end.toFixed(0)})`);
        if (matchingBSL) confluences.push(`BSL nearby (${matchingBSL.price.toFixed(0)})`);
        if (flow.funding.current > 0.0001) confluences.push('Positive funding adds sell pressure');
        return {
          type: 'short' as const,
          from: z.from,
          to: z.to,
          score: Math.min(100, confluences.length * 25 + 25),
          confluences,
          reasons: [z.reason],
        };
      }),
    ];

    const scoreBreakdown = buildScoreBreakdown(structure4H, flow);
    const confidenceBreakdown = buildConfidenceBreakdown(structure4H, flow, score, mtfRows);

    // FIX 2: Signal agreement
    const signalAgreement = computeSignalAgreement(structure4H, flow);

    // FIX 7: Backtest
    const backtestOB = backtestOrderBlocks(candles4H);
    const backtestFVG = backtestFVGs(candles4H);

    const auditData: AuditData = {
      bosEvents: enrichedBOS4H,
      chochEvents: enrichedCHoCH4H,
      orderBlocks: enrichedOBs,
      fvgs: enrichedFVGs,
      liquidityPools: enrichedLiq,
      scoreBreakdown,
      confidenceBreakdown,
      dataSources,
      tradeZoneAudit,
      mtfComparison: mtfRows,
      consistencyWarning,
      mtfWarning,
      structureDebug: [debug1D, debug4H, debug1H],
      signalAgreement,
      backtest: [backtestOB, backtestFVG],
    };

    const report: TradeReport = {
      symbol,
      timestamp: Date.now(),
      scenario_primary: primary,
      scenario_alternative: alternative,
      long_zones,
      short_zones,
      invalidation_level,
      confidence: score.confidence,
      bullish_score: score.bullish,
      bearish_score: score.bearish,
      structure: { '1D': structure1D, '4H': structure4H, '1H': structure1H },
      flow,
      score,
      audit: auditData,
    };

    await setCache(c.env.DB, cacheKey, report, 300);
    return c.json(report);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
}
