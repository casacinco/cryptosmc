import type {
  TradeReport,
  EnrichedBOS,
  EnrichedCHoCH,
  EnrichedOrderBlock,
  EnrichedFVG,
  EnrichedLiquidityPool,
  ScoreBreakdownItem,
  ConfidenceBreakdownItem,
  DataSourceStatus,
  TradeZoneAudit,
  MTFRow,
} from '../types';

interface Props {
  report: TradeReport;
}

function ScoreBadge({ value }: { value: number }) {
  const color =
    value > 70
      ? 'bg-accent-green bg-opacity-20 text-accent-green'
      : value > 40
      ? 'bg-yellow-500 bg-opacity-20 text-yellow-400'
      : 'bg-accent-red bg-opacity-20 text-accent-red';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {value}
    </span>
  );
}

function TrendBadge({ trend }: { trend: 'bullish' | 'bearish' | 'ranging' }) {
  const color =
    trend === 'bullish'
      ? 'bg-accent-green bg-opacity-20 text-accent-green'
      : trend === 'bearish'
      ? 'bg-accent-red bg-opacity-20 text-accent-red'
      : 'bg-bg-border text-text-muted';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${color}`}>
      {trend}
    </span>
  );
}

function RelevanceBadge({ relevance }: { relevance: 'high' | 'medium' | 'low' }) {
  const color =
    relevance === 'high'
      ? 'bg-accent-green bg-opacity-20 text-accent-green'
      : relevance === 'medium'
      ? 'bg-yellow-500 bg-opacity-20 text-yellow-400'
      : 'bg-bg-border text-text-muted';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${color}`}>
      {relevance}
    </span>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">
      {title}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4">
      {children}
    </div>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-4 text-center text-text-muted text-xs italic">
        No data
      </td>
    </tr>
  );
}

function fmtTime(ms: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString();
}

function fmtPrice(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`;
}

// ── 1. Data Sources ───────────────────────────────────────────────────────────

function DataSourcesSection({ sources }: { sources: DataSourceStatus[] }) {
  return (
    <Card>
      <SectionHeader title="Data Sources" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted uppercase tracking-wider">
              <th className="text-left pb-2 pr-4">Name</th>
              <th className="text-left pb-2 pr-4">Status</th>
              <th className="text-left pb-2 pr-4">Endpoint</th>
              <th className="text-left pb-2 pr-4">Last Update</th>
              <th className="text-left pb-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {sources.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : (
              sources.map((s, i) => (
                <tr key={i} className="border-b border-bg-border last:border-0">
                  <td className="py-2 pr-4 text-text-primary font-medium">{s.name}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        s.connected
                          ? 'bg-accent-green bg-opacity-20 text-accent-green'
                          : 'bg-accent-red bg-opacity-20 text-accent-red'
                      }`}
                    >
                      {s.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-text-muted font-mono">{s.endpoint}</td>
                  <td className="py-2 pr-4 text-text-muted">{s.lastUpdate ? fmtTime(s.lastUpdate) : '—'}</td>
                  <td className="py-2 text-text-muted">{s.note ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── 2. Consistency Warning ────────────────────────────────────────────────────

function ConsistencyWarning({ warning }: { warning: string | null }) {
  if (!warning) return null;
  return (
    <div className="flex items-start gap-3 p-4 bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30 rounded-xl text-yellow-400 text-xs">
      <span className="mt-0.5 text-base leading-none">⚠</span>
      <span>{warning}</span>
    </div>
  );
}

// ── 3. MTF Comparison ─────────────────────────────────────────────────────────

function MTFSection({ rows }: { rows: MTFRow[] }) {
  return (
    <Card>
      <SectionHeader title="Multi-Timeframe Comparison" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted uppercase tracking-wider">
              <th className="text-left pb-2 pr-4">Timeframe</th>
              <th className="text-left pb-2 pr-4">Trend</th>
              <th className="text-left pb-2 pr-4">BOS</th>
              <th className="text-left pb-2 pr-4">CHoCH</th>
              <th className="text-left pb-2 pr-4">OBs</th>
              <th className="text-left pb-2 pr-4">FVGs</th>
              <th className="text-left pb-2">Liquidity</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={7} />
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-b border-bg-border last:border-0">
                  <td className="py-2 pr-4 text-text-primary font-semibold">{r.timeframe}</td>
                  <td className="py-2 pr-4">
                    <TrendBadge trend={r.trend} />
                  </td>
                  <td className="py-2 pr-4 text-text-primary">{r.bosCount}</td>
                  <td className="py-2 pr-4 text-text-primary">{r.chochCount}</td>
                  <td className="py-2 pr-4 text-text-primary">{r.obCount}</td>
                  <td className="py-2 pr-4 text-text-primary">{r.fvgCount}</td>
                  <td className="py-2 text-text-primary">{r.liquidityCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── 4. Score Breakdown ────────────────────────────────────────────────────────

function ScoreBreakdownSection({ items }: { items: ScoreBreakdownItem[] }) {
  return (
    <Card>
      <SectionHeader title="Score Breakdown" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted uppercase tracking-wider">
              <th className="text-left pb-2 pr-4">Factor</th>
              <th className="text-left pb-2 pr-4">Bullish</th>
              <th className="text-left pb-2 pr-4">Bearish</th>
              <th className="text-left pb-2 pr-4">Net</th>
              <th className="text-left pb-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : (
              items.map((item, i) => (
                <tr key={i} className="border-b border-bg-border last:border-0">
                  <td className="py-2 pr-4 text-text-primary font-medium">{item.factor}</td>
                  <td className="py-2 pr-4 text-accent-green">+{item.bullishContrib}</td>
                  <td className="py-2 pr-4 text-accent-red">+{item.bearishContrib}</td>
                  <td className={`py-2 pr-4 font-semibold ${item.net > 0 ? 'text-accent-green' : item.net < 0 ? 'text-accent-red' : 'text-text-muted'}`}>
                    {item.net > 0 ? '+' : ''}{item.net}
                  </td>
                  <td className="py-2 text-text-muted">{item.reason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── 5. Confidence Breakdown ───────────────────────────────────────────────────

function ConfidenceBreakdownSection({ items }: { items: ConfidenceBreakdownItem[] }) {
  return (
    <Card>
      <SectionHeader title="Confidence Breakdown" />
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-text-muted text-xs italic">No data</p>
        ) : (
          items.map((item, i) => (
            <div key={i} className="flex items-start gap-3 border-b border-bg-border last:border-0 pb-2 last:pb-0">
              <span
                className={`inline-block min-w-[44px] text-center px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${
                  item.value > 0
                    ? 'bg-accent-green bg-opacity-20 text-accent-green'
                    : item.value < 0
                    ? 'bg-accent-red bg-opacity-20 text-accent-red'
                    : 'bg-bg-border text-text-muted'
                }`}
              >
                {item.value > 0 ? '+' : ''}{item.value}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-text-primary text-xs font-medium">{item.factor}</div>
                <div className="text-text-muted text-xs mt-0.5">{item.reason}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

// ── 6. BOS Events ─────────────────────────────────────────────────────────────

function BOSSection({ events }: { events: EnrichedBOS[] }) {
  return (
    <Card>
      <SectionHeader title="Break of Structure (BOS) Events — 4H" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted uppercase tracking-wider">
              <th className="text-left pb-2 pr-4">ID</th>
              <th className="text-left pb-2 pr-4">Time</th>
              <th className="text-left pb-2 pr-4">Type</th>
              <th className="text-left pb-2 pr-4">Break Price</th>
              <th className="text-left pb-2 pr-4">Broken Swing</th>
              <th className="text-left pb-2">Strength</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <EmptyRow colSpan={6} />
            ) : (
              events.map((e, i) => (
                <tr key={i} className="border-b border-bg-border last:border-0">
                  <td className="py-2 pr-4 text-text-muted font-mono">{e.id}</td>
                  <td className="py-2 pr-4 text-text-muted">{fmtTime(e.candleTime)}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`font-semibold uppercase ${
                        e.type === 'bullish' ? 'text-accent-green' : 'text-accent-red'
                      }`}
                    >
                      {e.type}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-text-primary">{fmtPrice(e.breakPrice)}</td>
                  <td className="py-2 pr-4 text-text-muted">{fmtPrice(e.brokenSwingPrice)}</td>
                  <td className="py-2">
                    <ScoreBadge value={e.strengthScore} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── 7. CHoCH Events ───────────────────────────────────────────────────────────

function CHoCHSection({ events }: { events: EnrichedCHoCH[] }) {
  return (
    <Card>
      <SectionHeader title="Change of Character (CHoCH) Events — 4H" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted uppercase tracking-wider">
              <th className="text-left pb-2 pr-4">ID</th>
              <th className="text-left pb-2 pr-4">Time</th>
              <th className="text-left pb-2 pr-4">Type</th>
              <th className="text-left pb-2 pr-4">Break Price</th>
              <th className="text-left pb-2 pr-4">Prev Trend</th>
              <th className="text-left pb-2">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <EmptyRow colSpan={6} />
            ) : (
              events.map((e, i) => (
                <tr key={i} className="border-b border-bg-border last:border-0">
                  <td className="py-2 pr-4 text-text-muted font-mono">{e.id}</td>
                  <td className="py-2 pr-4 text-text-muted">{fmtTime(e.candleTime)}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={`font-semibold uppercase ${
                        e.type === 'bullish' ? 'text-accent-green' : 'text-accent-red'
                      }`}
                    >
                      {e.type}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-text-primary">{fmtPrice(e.breakPrice)}</td>
                  <td className="py-2 pr-4">
                    <TrendBadge trend={e.previousTrend} />
                  </td>
                  <td className="py-2">
                    <ScoreBadge value={e.confidence} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── 8. Order Blocks ───────────────────────────────────────────────────────────

function OrderBlocksSection({ blocks }: { blocks: EnrichedOrderBlock[] }) {
  return (
    <Card>
      <SectionHeader title="Order Blocks — 4H (Unmitigated)" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted uppercase tracking-wider">
              <th className="text-left pb-2 pr-3">ID</th>
              <th className="text-left pb-2 pr-3">Type</th>
              <th className="text-left pb-2 pr-3">Range</th>
              <th className="text-left pb-2 pr-3">Created</th>
              <th className="text-left pb-2 pr-3">Displacement</th>
              <th className="text-left pb-2 pr-3">Touches</th>
              <th className="text-left pb-2 pr-3">Mitigated</th>
              <th className="text-left pb-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {blocks.length === 0 ? (
              <EmptyRow colSpan={8} />
            ) : (
              blocks.map((ob, i) => (
                <tr key={i} className="border-b border-bg-border last:border-0">
                  <td className="py-2 pr-3 text-text-muted font-mono">{ob.id}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`font-semibold uppercase ${
                        ob.type === 'bull' ? 'text-accent-green' : 'text-accent-red'
                      }`}
                    >
                      {ob.type === 'bull' ? 'Bullish' : 'Bearish'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-text-primary font-mono">
                    {fmtPrice(ob.low)}–{fmtPrice(ob.high)}
                  </td>
                  <td className="py-2 pr-3 text-text-muted">{fmtTime(ob.candleTime)}</td>
                  <td className="py-2 pr-3 text-text-primary">{fmtPct(ob.displacementPct)}</td>
                  <td className="py-2 pr-3 text-text-primary">{ob.touchCount}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={ob.mitigated ? 'text-accent-red' : 'text-accent-green'}
                    >
                      {ob.mitigated ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="py-2">
                    <ScoreBadge value={ob.score} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── 9. Fair Value Gaps ────────────────────────────────────────────────────────

function FVGSection({ fvgs }: { fvgs: EnrichedFVG[] }) {
  return (
    <Card>
      <SectionHeader title="Fair Value Gaps (FVGs) — 4H" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted uppercase tracking-wider">
              <th className="text-left pb-2 pr-3">ID</th>
              <th className="text-left pb-2 pr-3">Type</th>
              <th className="text-left pb-2 pr-3">Range</th>
              <th className="text-left pb-2 pr-3">Created</th>
              <th className="text-left pb-2 pr-3">Size%</th>
              <th className="text-left pb-2 pr-3">Fill%</th>
              <th className="text-left pb-2 pr-3">Status</th>
              <th className="text-left pb-2">Score</th>
            </tr>
          </thead>
          <tbody>
            {fvgs.length === 0 ? (
              <EmptyRow colSpan={8} />
            ) : (
              fvgs.map((f, i) => (
                <tr key={i} className="border-b border-bg-border last:border-0">
                  <td className="py-2 pr-3 text-text-muted font-mono">{f.id}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={`font-semibold uppercase ${
                        f.type === 'bull' ? 'text-accent-green' : 'text-accent-red'
                      }`}
                    >
                      {f.type === 'bull' ? 'Bullish' : 'Bearish'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-text-primary font-mono">
                    {fmtPrice(f.start)}–{fmtPrice(f.end)}
                  </td>
                  <td className="py-2 pr-3 text-text-muted">{fmtTime(f.candleTime)}</td>
                  <td className="py-2 pr-3 text-text-primary">{fmtPct(f.sizePct)}</td>
                  <td className="py-2 pr-3 text-text-primary">{fmtPct(f.fillPct)}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={f.filled ? 'text-text-muted' : 'text-accent-green'}
                    >
                      {f.filled ? 'Filled' : 'Open'}
                    </span>
                  </td>
                  <td className="py-2">
                    <ScoreBadge value={f.score} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── 10. Liquidity Pools ───────────────────────────────────────────────────────

function LiquiditySection({ pools }: { pools: EnrichedLiquidityPool[] }) {
  return (
    <Card>
      <SectionHeader title="Liquidity Pools — 4H" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted uppercase tracking-wider">
              <th className="text-left pb-2 pr-4">Type</th>
              <th className="text-left pb-2 pr-4">Price</th>
              <th className="text-left pb-2 pr-4">Distance%</th>
              <th className="text-left pb-2 pr-4">Strength</th>
              <th className="text-left pb-2">Relevance</th>
            </tr>
          </thead>
          <tbody>
            {pools.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : (
              pools.map((p, i) => (
                <tr key={i} className="border-b border-bg-border last:border-0">
                  <td className="py-2 pr-4">
                    <span
                      className={`font-semibold ${
                        p.type === 'BSL' ? 'text-accent-green' : 'text-accent-red'
                      }`}
                    >
                      {p.type}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-text-primary font-mono">{fmtPrice(p.price)}</td>
                  <td className="py-2 pr-4 text-text-primary">{fmtPct(p.distancePct)}</td>
                  <td className="py-2 pr-4 text-text-primary">{p.strength}</td>
                  <td className="py-2">
                    <RelevanceBadge relevance={p.relevance} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── 11. Trade Zone Audit ──────────────────────────────────────────────────────

function TradeZoneCard({ zone }: { zone: TradeZoneAudit }) {
  const isLong = zone.type === 'long';
  return (
    <div
      className={`border rounded-xl p-4 ${
        isLong
          ? 'border-accent-green border-opacity-30 bg-accent-green bg-opacity-5'
          : 'border-accent-red border-opacity-30 bg-accent-red bg-opacity-5'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`font-bold uppercase text-xs ${
              isLong ? 'text-accent-green' : 'text-accent-red'
            }`}
          >
            {zone.type}
          </span>
          <span className="text-text-muted text-xs font-mono">
            {fmtPrice(zone.from)} – {fmtPrice(zone.to)}
          </span>
        </div>
        <ScoreBadge value={zone.score} />
      </div>

      {zone.reasons.length > 0 && (
        <div className="mb-2">
          <span className="text-text-muted text-xs">Basis: </span>
          <span className="text-text-secondary text-xs">{zone.reasons.join(', ')}</span>
        </div>
      )}

      {zone.confluences.length > 0 && (
        <div>
          <div className="text-text-muted text-xs mb-1 uppercase tracking-wider">Confluences</div>
          <ul className="space-y-0.5">
            {zone.confluences.map((c, i) => (
              <li key={i} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span className={isLong ? 'text-accent-green' : 'text-accent-red'}>•</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {zone.confluences.length === 0 && (
        <div className="text-text-muted text-xs italic">No confluences detected</div>
      )}
    </div>
  );
}

function TradeZoneSection({ zones }: { zones: TradeZoneAudit[] }) {
  return (
    <Card>
      <SectionHeader title="Trade Zone Audit" />
      {zones.length === 0 ? (
        <p className="text-text-muted text-xs italic">No trade zones</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {zones.map((z, i) => (
            <TradeZoneCard key={i} zone={z} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function AuditPage({ report }: Props) {
  const audit = report.audit;

  if (!audit) {
    return (
      <div className="p-6 text-text-muted text-sm">
        No audit data available. The worker may need to be updated.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <DataSourcesSection sources={audit.dataSources} />
      <ConsistencyWarning warning={audit.consistencyWarning} />
      <MTFSection rows={audit.mtfComparison} />
      <ScoreBreakdownSection items={audit.scoreBreakdown} />
      <ConfidenceBreakdownSection items={audit.confidenceBreakdown} />
      <BOSSection events={audit.bosEvents} />
      <CHoCHSection events={audit.chochEvents} />
      <OrderBlocksSection blocks={audit.orderBlocks} />
      <FVGSection fvgs={audit.fvgs} />
      <LiquiditySection pools={audit.liquidityPools} />
      <TradeZoneSection zones={audit.tradeZoneAudit} />
    </div>
  );
}
