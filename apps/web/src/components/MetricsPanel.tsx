import type { FlowData } from '../types';

interface Props {
  flow: FlowData;
}

function MetricCard({ title, value, sub, color }: { title: string; value: string; sub: string; color?: string }) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4">
      <p className="text-text-muted text-xs mb-1">{title}</p>
      <p className="text-text-primary text-xl font-bold" style={color ? { color } : {}}>{value}</p>
      <p className="text-text-secondary text-xs mt-1 leading-snug">{sub}</p>
    </div>
  );
}

export function MetricsPanel({ flow }: Props) {
  const fundingColor =
    flow.funding.current >= 0.001  ? '#ff4757' :
    flow.funding.current >= 0.0005 ? '#ffd700' :
    flow.funding.current >= 0.0001 ? '#ffaa33' :
    flow.funding.current <= -0.001  ? '#00d084' :
    flow.funding.current <= -0.0005 ? '#4a9eff' :
    flow.funding.current <= -0.0001 ? '#7ab8ff' : '#8888aa';

  const lsColor = flow.longShort.ratio > 1.5 ? '#ff4757' : flow.longShort.ratio < 0.7 ? '#00d084' : '#8888aa';

  const cvdColor = flow.cvd.divergence === 'bullish' ? '#00d084' : flow.cvd.divergence === 'bearish' ? '#ff4757' : '#8888aa';

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard
        title="Open Interest"
        value={flow.openInterest.current > 0
          ? flow.openInterest.current >= 1e9
            ? `$${(flow.openInterest.current / 1e9).toFixed(2)}B`
            : `$${(flow.openInterest.current / 1e6).toFixed(0)}M`
          : '—'}
        sub={flow.openInterest.change24h !== 0
          ? `${flow.openInterest.change24h > 0 ? '+' : ''}${flow.openInterest.change24h.toFixed(2)}% 24h · ${flow.openInterest.interpretation}`
          : flow.openInterest.interpretation}
        color={flow.openInterest.change24h > 1 ? '#00d084' : flow.openInterest.change24h < -1 ? '#ff4757' : undefined}
      />
      <MetricCard
        title="Funding Rate"
        value={`${(flow.funding.current * 100).toFixed(4)}%`}
        sub={flow.funding.status}
        color={fundingColor}
      />
      <MetricCard
        title="L/S Ratio"
        value={flow.longShort.ratio.toFixed(2)}
        sub={flow.longShort.interpretation}
        color={lsColor}
      />
      <MetricCard
        title="CVD Divergence"
        value={flow.cvd.divergence === 'none' ? 'None' : flow.cvd.divergence.charAt(0).toUpperCase() + flow.cvd.divergence.slice(1)}
        sub={flow.cvd.divergence === 'none' ? 'No divergence detected' : `CVD ${flow.cvd.divergence} signal`}
        color={cvdColor}
      />
    </div>
  );
}
