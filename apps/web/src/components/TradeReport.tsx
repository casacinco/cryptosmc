import type { TradeReport } from '../types';

interface Props {
  report: TradeReport;
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
                <div key={i} className="bg-bg-secondary rounded p-2 border border-accent-green border-opacity-20">
                  <p className="text-accent-green text-xs font-bold">
                    {z.from.toLocaleString()} – {z.to.toLocaleString()}
                  </p>
                  <p className="text-text-muted text-xs mt-0.5">{z.reason}</p>
                </div>
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
                <div key={i} className="bg-bg-secondary rounded p-2 border border-accent-red border-opacity-20">
                  <p className="text-accent-red text-xs font-bold">
                    {z.from.toLocaleString()} – {z.to.toLocaleString()}
                  </p>
                  <p className="text-text-muted text-xs mt-0.5">{z.reason}</p>
                </div>
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
