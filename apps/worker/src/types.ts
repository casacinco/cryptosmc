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

export interface TradeReport {
  symbol: string;
  timestamp: number;
  scenario_primary: string;
  scenario_alternative: string;
  long_zones: { from: number; to: number; reason: string }[];
  short_zones: { from: number; to: number; reason: string }[];
  invalidation_level: number;
  confidence: number;
  bullish_score: number;
  bearish_score: number;
  structure: { '1D': MarketStructure; '4H': MarketStructure; '1H': MarketStructure };
  flow: FlowData;
  score: InstitutionalScore;
}

export interface Env {
  DB: D1Database;
  COINALYZE_API_KEY: string;
  // CoinGlass removed — liquidations via Binance /fapi/v1/allForceOrders (free, no key)
}
