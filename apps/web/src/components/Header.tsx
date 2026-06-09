interface Props {
  lastUpdate: Date | null;
}

export function Header({ lastUpdate }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-bg-border bg-bg-secondary">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-accent-blue rounded-lg flex items-center justify-center text-sm font-bold">
          C
        </div>
        <div>
          <h1 className="text-text-primary font-bold text-lg leading-none">CryptoSMC</h1>
          <p className="text-text-muted text-xs mt-0.5">Institutional Analysis</p>
        </div>
      </div>
      {lastUpdate && (
        <span className="text-text-muted text-xs">
          Updated: {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </header>
  );
}
