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

// FIX 4: OI interpretation matrix display
function OIInterpretation({ interpretation, change24h }: { interpretation: string; change24h: number }) {
  // Parse the matrix label from the interpretation string
  let scenario = '';
  let description = '';
  let scenarioColor = '#8888aa';

  if (interpretation.startsWith('Price↑ OI↑')) {
    scenario = 'Price↑ OI↑';
    description = 'Bullish continuation — new longs entering';
    scenarioColor = '#00d084';
  } else if (interpretation.startsWith('Price↑ OI↓')) {
    scenario = 'Price↑ OI↓';
    description = 'Short covering — longs closing into rally';
    scenarioColor = '#4a9eff';
  } else if (interpretation.startsWith('Price↓ OI↑')) {
    scenario = 'Price↓ OI↑';
    description = 'New shorts entering — bearish continuation';
    scenarioColor = '#ff4757';
  } else if (interpretation.startsWith('Price↓ OI↓')) {
    scenario = 'Price↓ OI↓';
    description = 'Long liquidation — forced selling';
    scenarioColor = '#ffd700';
  } else {
    scenario = '—';
    description = interpretation;
  }

  const oiColor = change24h > 1 ? '#00d084' : change24h < -1 ? '#ff4757' : undefined;

  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4">
      <p className="text-text-muted text-xs mb-1">Open Interest</p>
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-bold font-mono"
          style={{ backgroundColor: `${scenarioColor}22`, color: scenarioColor }}
        >
          {scenario}
        </span>
        {change24h !== 0 && (
          <span className="text-xs font-bold" style={oiColor ? { color: oiColor } : { color: '#8888aa' }}>
            {change24h > 0 ? '+' : ''}{change24h.toFixed(2)}%
          </span>
        )}
      </div>
      <p className="text-text-secondary text-xs leading-snug">{description}</p>
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
      <OIInterpretation
        interpretation={flow.openInterest.interpretation}
        change24h={flow.openInterest.change24h}
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
