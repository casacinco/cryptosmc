import type { TradeReport, ClassifiedZone } from '../types';

interface Props {
  report: TradeReport;
}

function ClassificationBadge({ classification }: { classification: ClassifiedZone['classification'] }) {
  return classification === 'trend-following' ? (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500 bg-opacity-20 text-blue-400">
      Trend Following
    </span>
  ) : (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500 bg-opacity-20 text-orange-400">
      Counter Trend
    </span>
  );
}

function RiskBadge({ risk }: { risk: ClassifiedZone['riskLevel'] }) {
  const cls =
    risk === 'low' ? 'bg-accent-green bg-opacity-20 text-accent-green' :
    risk === 'medium' ? 'bg-yellow-500 bg-opacity-20 text-yellow-400' :
    'bg-accent-red bg-opacity-20 text-accent-red';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${cls}`}>
      {risk} risk
    </span>
  );
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 4 : 2 });
}

function ZoneCard({ zone, color }: { zone: ClassifiedZone; color: 'green' | 'red' }) {
  const borderColor = color === 'green' ? 'border-accent-green border-opacity-20' : 'border-accent-red border-opacity-20';
  const priceColor = color === 'green' ? 'text-accent-green' : 'text-accent-red';
  const hasPlan = zone.entry != null && zone.stopLoss != null && zone.takeProfit != null;
  return (
    <div className={`bg-bg-secondary rounded p-2.5 border ${borderColor}`}>
      <p className={`${priceColor} text-xs font-bold mb-1`}>
        {zone.from.toLocaleString()} – {zone.to.toLocaleString()}
      </p>
      <p className="text-text-muted text-xs mb-1.5">{zone.reason}</p>

      {hasPlan && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-text-muted">Entry</span>
            <span className="text-text-primary font-semibold">{fmt(zone.entry!)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">SL</span>
            <span className="text-accent-red font-semibold">{fmt(zone.stopLoss!)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">TP</span>
            <span className="text-accent-green font-semibold">{fmt(zone.takeProfit!)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">R:R</span>
            <span className={`font-semibold ${(zone.riskReward ?? 0) >= 2 ? 'text-accent-green' : (zone.riskReward ?? 0) >= 1 ? 'text-yellow-400' : 'text-accent-red'}`}>
              {zone.riskReward != null ? `1:${zone.riskReward}` : '—'}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 items-center">
        <ClassificationBadge classification={zone.classification} />
        <RiskBadge risk={zone.riskLevel} />
        <span className="text-text-muted text-xs">P: {zone.probability}%</span>
      </div>
    </div>
  );
}

export function TradeReportPanel({ report }: Props) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4 space-y-4">
      <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
        Trade Report — {report.symbol}
      </h3>

      {/* Scenarios */}
      <div className="space-y-2">
        <div className="bg-bg-secondary rounded-lg p-3 border-l-2 border-accent-blue">
          <p className="text-text-muted text-xs mb-1">Primary Scenario</p>
          <p className="text-text-primary text-sm">{report.scenario_primary}</p>
        </div>
        <div className="bg-bg-secondary rounded-lg p-3 border-l-2 border-bg-border">
          <p className="text-text-muted text-xs mb-1">Alternative Scenario</p>
          <p className="text-text-secondary text-sm">{report.scenario_alternative}</p>
        </div>
      </div>

      {/* Zones */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-accent-green text-xs font-semibold mb-2">LONG ZONES</p>
          {report.long_zones.length > 0 ? (
            <div className="space-y-1.5">
              {report.long_zones.map((z, i) => (
                <ZoneCard key={i} zone={z} color="green" />
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-xs">No long zones</p>
          )}
        </div>
        <div>
          <p className="text-accent-red text-xs font-semibold mb-2">SHORT ZONES</p>
          {report.short_zones.length > 0 ? (
            <div className="space-y-1.5">
              {report.short_zones.map((z, i) => (
                <ZoneCard key={i} zone={z} color="red" />
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-xs">No short zones</p>
          )}
        </div>
      </div>

      {/* Invalidation */}
      {report.invalidation_level > 0 && (
        <div className="flex items-center justify-between bg-bg-secondary rounded-lg px-3 py-2">
          <span className="text-text-muted text-xs">Invalidation Level</span>
          <span className="text-accent-yellow font-bold text-sm">
            {report.invalidation_level.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
