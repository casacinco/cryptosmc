import type { BacktestResult } from '../types';

interface Props {
  results: BacktestResult[];
}

function WinRateBadge({ value, reliable }: { value: number; reliable?: boolean }) {
  // Unreliable samples are shown greyed out — a win rate over <10 trades is noise
  const cls = reliable === false
    ? 'bg-bg-border bg-opacity-40 text-text-muted'
    : value > 60 ? 'bg-accent-green bg-opacity-20 text-accent-green' :
      value > 40 ? 'bg-yellow-500 bg-opacity-20 text-yellow-400' :
      'bg-accent-red bg-opacity-20 text-accent-red';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {value}%{reliable === false ? ' ⚠' : ''}
    </span>
  );
}

function RRBadge({ value }: { value: number }) {
  const cls =
    value > 1 ? 'bg-accent-green bg-opacity-20 text-accent-green' :
    value > 0 ? 'bg-yellow-500 bg-opacity-20 text-yellow-400' :
    'bg-accent-red bg-opacity-20 text-accent-red';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {value > 0 ? '+' : ''}{value.toFixed(2)}R
    </span>
  );
}

export function BacktestPanel({ results }: Props) {
  if (!results || results.length === 0) return null;

  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4">
      <div className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">
        Signal Backtest (4H)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted uppercase tracking-wider">
              <th className="text-left pb-2 pr-4">Signal</th>
              <th className="text-left pb-2 pr-4">Signals Found</th>
              <th className="text-left pb-2 pr-4">Triggered</th>
              <th className="text-left pb-2 pr-4">Wins</th>
              <th className="text-left pb-2 pr-4">Losses</th>
              <th className="text-left pb-2 pr-4">Win Rate</th>
              <th className="text-left pb-2 pr-4">Avg RR</th>
              <th className="text-left pb-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="border-b border-bg-border last:border-0">
                <td className="py-2 pr-4 text-text-primary font-semibold">{r.signalType}</td>
                <td className="py-2 pr-4 text-text-primary">{r.totalSignals}</td>
                <td className="py-2 pr-4 text-text-primary">{r.wins + r.losses}</td>
                <td className="py-2 pr-4 text-accent-green">{r.wins}</td>
                <td className="py-2 pr-4 text-accent-red">{r.losses}</td>
                <td className="py-2 pr-4">
                  <WinRateBadge value={r.winRate} reliable={r.reliable} />
                </td>
                <td className="py-2 pr-4">
                  <RRBadge value={r.avgRR} />
                </td>
                <td className="py-2 text-text-muted">{r.sampleNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-text-muted text-xs italic border-t border-bg-border pt-2">
        Walk-forward backtest over 400 candles: entry on first zone touch, 2R target, 0.25-zone stop, sequential resolution. Greyed results have fewer than 10 resolved trades and are statistically meaningless. For reference only — not a guarantee of future performance.
      </p>
    </div>
  );
}
