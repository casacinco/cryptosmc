import type { InstitutionalScore } from '../types';

interface Props {
  score: InstitutionalScore;
}

function GaugeBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span style={{ color }} className="font-bold">{value}</span>
      </div>
      <div className="h-2 bg-bg-primary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function ScorePanel({ score }: Props) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4">
      <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-4">
        Institutional Score
      </h3>
      <div className="flex flex-col gap-3">
        <GaugeBar value={score.bullish} color="#00d084" label="Bullish" />
        <GaugeBar value={score.bearish} color="#ff4757" label="Bearish" />
        <GaugeBar value={score.confidence} color="#4a9eff" label="Confidence" />
      </div>
      <div className="mt-4 pt-4 border-t border-bg-border">
        <p className="text-text-muted text-xs mb-2">Breakdown</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(score.details).map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="text-text-muted capitalize">{k}</span>
              <span className={v > 0 ? 'text-accent-green' : v < 0 ? 'text-accent-red' : 'text-text-muted'}>
                {v > 0 ? '+' : ''}{v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
