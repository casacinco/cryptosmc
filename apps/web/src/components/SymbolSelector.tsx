const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

interface Props {
  value: string;
  onChange: (s: string) => void;
}

export function SymbolSelector({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-bg-card border border-bg-border text-text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-blue cursor-pointer"
    >
      {SYMBOLS.map(s => (
        <option key={s} value={s}>{s.replace('USDT', '/USDT')}</option>
      ))}
    </select>
  );
}
