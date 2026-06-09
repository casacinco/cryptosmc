const TIMEFRAMES = [
  { label: '15m', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' },
];

interface Props {
  value: string;
  onChange: (tf: string) => void;
}

export function TimeframeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {TIMEFRAMES.map(tf => (
        <button
          key={tf.value}
          onClick={() => onChange(tf.value)}
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            value === tf.value
              ? 'bg-accent-blue text-white'
              : 'bg-bg-card text-text-secondary hover:text-text-primary border border-bg-border'
          }`}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}
