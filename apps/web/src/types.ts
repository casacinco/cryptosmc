export interface Candle {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SwingPoint {
  price: number;
  index: number;
  type: 'high' | 'low';
}

export interface OrderBlock {
  high: number;
  low: number;
  type: 'bull' | 'bear';
  strength: number;
  index: number;
}

export interface FVG {
  start: number;
  end: number;
  type: 'bull' | 'bear';
  index: number;
}

export interface LiquidityPool {
  price: number;
  type: 'BSL' | 'SSL';
  strength: number;
}

export interface MarketStructure {
  symbol: string;
  timeframe: string;
  trend: 'bullish' | 'bearish' | 'ranging';
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  bos: { type: 'bullish' | 'bearish'; price: number; index: number }[];
  choch: { type: 'bullish' | 'bearish'; price: number; index: number }[];
  orderBlocks: OrderBlock[];
  fvgs: FVG[];
  liquidityPools: LiquidityPool[];
}

export interface FlowData {
  openInterest: { current: number; change24h: number; interpretation: string };
  funding: { current: number; status: string; meaning: string };
  longShort: { ratio: number; interpretation: string };
  cvd: { values: number[]; divergence: 'bullish' | 'bearish' | 'none' };
}

export interface InstitutionalScore {
  bullish: number;
  bearish: number;
  confidence: number;
  details: Record<string, number>;
}

// ─── Audit Types ─────────────────────────────────────────────────────────────

export interface EnrichedBOS {
  id: string;
  timeframe: string;
  type: 'bullish' | 'bearish';
  breakPrice: number;
  brokenSwingPrice: number;
  candleTime: number;
  strengthScore: number;
  strengthBreakdown: {
    displacement: number;
    volume: number;
    distance: number;
    speed: number;
    total: number;
  };
}

export interface EnrichedCHoCH {
  id: string;
  timeframe: string;
  type: 'bullish' | 'bearish';
  breakPrice: number;
  previousTrend: 'bullish' | 'bearish' | 'ranging';
  candleTime: number;
  confidence: number;
}

export interface EnrichedOrderBlock {
  id: string;
  type: 'bull' | 'bear';
  high: number;
  low: number;
  candleTime: number;
  displacementPct: number;
  mitigated: boolean;
  touchCount: number;
  strength: number;
  score: number;
}

export interface EnrichedFVG {
  id: string;
  type: 'bull' | 'bear';
  start: number;
  end: number;
  sizePct: number;
  fillPct: number;
  filled: boolean;
  candleTime: number;
  score: number;
}

export interface EnrichedLiquidityPool {
  type: 'BSL' | 'SSL';
  price: number;
  distanceFromPrice: number;
  distancePct: number;
  strength: number;
  relevance: 'high' | 'medium' | 'low';
}

export interface ConfidenceBreakdownItem {
  factor: string;
  value: number;
  reason: string;
}

export interface ScoreBreakdownItem {
  factor: string;
  bullishContrib: number;
  bearishContrib: number;
  net: number;
  reason: string;
}

export interface DataSourceStatus {
  name: string;
  connected: boolean;
  lastUpdate: number;
  endpoint: string;
  note?: string;
}

export interface TradeZoneAudit {
  type: 'long' | 'short';
  from: number;
  to: number;
  score: number;
  confluences: string[];
  reasons: string[];
}

export interface MTFRow {
  timeframe: string;
  trend: 'bullish' | 'bearish' | 'ranging';
  bosCount: number;
  chochCount: number;
  obCount: number;
  fvgCount: number;
  liquidityCount: number;
}

// ─── New Interfaces ───────────────────────────────────────────────────────────

export interface StructureDebugInfo {
  timeframe: string;
  candlesAnalyzed: number;
  swingHighsDetected: number;
  swingLowsDetected: number;
  bosCount: number;
  chochCount: number;
  obCount: number;
  fvgCount: number;
  structureQuality: number;
  trendStrength: number;
  marketEfficiency: number;
}

export interface SignalAgreement {
  bullishSignals: string[];
  bearishSignals: string[];
  neutralSignals: string[];
  agreementRatio: number;
  dominantBias: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
}

export interface ClassifiedZone {
  from: number;
  to: number;
  reason: string;
  classification: 'trend-following' | 'counter-trend';
  probability: number;
  confluenceScore: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface BacktestResult {
  signalType: 'OB' | 'FVG' | 'BOS' | 'CHoCH';
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  avgRR: number;
  sampleNote: string;
}

export interface AuditData {
  bosEvents: EnrichedBOS[];
  chochEvents: EnrichedCHoCH[];
  orderBlocks: EnrichedOrderBlock[];
  fvgs: EnrichedFVG[];
  liquidityPools: EnrichedLiquidityPool[];
  scoreBreakdown: ScoreBreakdownItem[];
  confidenceBreakdown: ConfidenceBreakdownItem[];
  dataSources: DataSourceStatus[];
  tradeZoneAudit: TradeZoneAudit[];
  mtfComparison: MTFRow[];
  /** @deprecated use mtfWarning */
  consistencyWarning: string | null;
  mtfWarning: string | null;
  structureDebug: StructureDebugInfo[];
  signalAgreement: SignalAgreement;
  backtest: BacktestResult[];
}

// ─── Main Report ──────────────────────────────────────────────────────────────

export interface TradeReport {
  symbol: string;
  timestamp: number;
  scenario_primary: string;
  scenario_alternative: string;
  long_zones: ClassifiedZone[];
  short_zones: ClassifiedZone[];
  invalidation_level: number;
  confidence: number;
  bullish_score: number;
  bearish_score: number;
  structure: { '1D': MarketStructure; '4H': MarketStructure; '1H': MarketStructure };
  flow: FlowData;
  score: InstitutionalScore;
  audit: AuditData;
}
