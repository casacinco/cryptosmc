import { useState } from 'react';
import { Header } from './components/Header';
import { SymbolSelector } from './components/SymbolSelector';
import { TimeframeSelector } from './components/TimeframeSelector';
import { CandleChart } from './components/CandleChart';
import { MetricsPanel } from './components/MetricsPanel';
import { ScorePanel } from './components/ScorePanel';
import { TradeReportPanel } from './components/TradeReport';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AuditPage } from './components/AuditPage';
import { DeveloperMode } from './components/DeveloperMode';
import { useAnalysis } from './hooks/useAnalysis';
import { useMarketData } from './hooks/useMarketData';

type Tab = 'dashboard' | 'audit' | 'developer';

const TOGGLES = [
  { key: 'showSwings', label: 'Swings' },
  { key: 'showBOS', label: 'BOS' },
  { key: 'showOrderBlocks', label: 'OBs' },
  { key: 'showFVGs', label: 'FVGs' },
  { key: 'showLiquidity', label: 'Liquidity' },
] as const;

type ToggleKey = typeof TOGGLES[number]['key'];

export default function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('4h');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // FIX 3: Chart overlay toggles
  const [showSwings, setShowSwings] = useState(false);
  const [showBOS, setShowBOS] = useState(true);
  const [showOrderBlocks, setShowOrderBlocks] = useState(true);
  const [showFVGs, setShowFVGs] = useState(true);
  const [showLiquidity, setShowLiquidity] = useState(true);

  const toggleMap: Record<ToggleKey, { value: boolean; set: (v: boolean) => void }> = {
    showSwings: { value: showSwings, set: setShowSwings },
    showBOS: { value: showBOS, set: setShowBOS },
    showOrderBlocks: { value: showOrderBlocks, set: setShowOrderBlocks },
    showFVGs: { value: showFVGs, set: setShowFVGs },
    showLiquidity: { value: showLiquidity, set: setShowLiquidity },
  };

  const { data: analysis, loading: analysisLoading, error, refetch } = useAnalysis(symbol);
  const { candles, loading: candlesLoading } = useMarketData(symbol, timeframe);

  const structure = analysis?.structure?.['4H'] ?? analysis?.structure?.['1H'] ?? null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'audit', label: 'Audit' },
    { id: 'developer', label: 'Developer' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <Header lastUpdate={analysis ? new Date(analysis.timestamp) : null} />

      {/* Controls */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-bg-border bg-bg-secondary">
        <SymbolSelector value={symbol} onChange={setSymbol} />
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        <button
          onClick={refetch}
          disabled={analysisLoading}
          className="ml-auto px-4 py-1.5 rounded-lg bg-bg-card border border-bg-border text-text-secondary text-xs hover:text-text-primary hover:border-accent-blue transition-colors disabled:opacity-50"
        >
          {analysisLoading ? 'Analyzing...' : 'Refresh'}
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-6 bg-bg-secondary border-b border-bg-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold transition-colors relative ${
              activeTab === tab.id
                ? 'text-text-primary border-b-2 border-accent-blue'
                : 'text-text-muted hover:text-text-secondary border-b-2 border-transparent'
            }`}
          >
            {tab.label}
            {tab.id === 'audit' && analysis?.audit && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent-blue bg-opacity-20 text-accent-blue text-xs leading-none">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-accent-red bg-opacity-10 border border-accent-red border-opacity-30 rounded-lg text-accent-red text-sm">
          Error: {error}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <div className="flex-1 flex flex-col gap-4 p-6 overflow-auto">
          {/* Main grid */}
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
            {/* Chart Card */}
            <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden flex flex-col" style={{ height: '520px' }}>
              {/* FIX 3: Toggle bar */}
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-bg-border bg-bg-secondary flex-shrink-0">
                <span className="text-text-muted text-xs mr-1">Overlays:</span>
                {TOGGLES.map(toggle => {
                  const active = toggleMap[toggle.key].value;
                  return (
                    <button
                      key={toggle.key}
                      onClick={() => toggleMap[toggle.key].set(!active)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-accent-blue bg-opacity-20 text-accent-blue border border-accent-blue border-opacity-30'
                          : 'bg-bg-card text-text-muted border border-bg-border hover:text-text-secondary'
                      }`}
                    >
                      {toggle.label}
                    </button>
                  );
                })}
              </div>

              {/* Chart */}
              <div className="flex-1 min-h-0">
                {candlesLoading && candles.length === 0 ? (
                  <LoadingSpinner />
                ) : (
                  <CandleChart
                    candles={candles}
                    swingHighs={structure?.swingHighs ?? []}
                    swingLows={structure?.swingLows ?? []}
                    bos={structure?.bos ?? []}
                    choch={structure?.choch ?? []}
                    orderBlocks={structure?.orderBlocks ?? []}
                    fvgs={structure?.fvgs ?? []}
                    liquidityPools={structure?.liquidityPools ?? []}
                    showSwings={showSwings}
                    showBOS={showBOS}
                    showOrderBlocks={showOrderBlocks}
                    showFVGs={showFVGs}
                    showLiquidity={showLiquidity}
                  />
                )}
              </div>
            </div>

            {/* Right panel */}
            <div className="flex flex-col gap-4">
              {analysisLoading && !analysis ? (
                <div className="h-full flex items-center justify-center">
                  <LoadingSpinner />
                </div>
              ) : analysis ? (
                <>
                  <ScorePanel score={analysis.score} />
                  <MetricsPanel flow={analysis.flow} />
                </>
              ) : null}
            </div>
          </div>

          {/* Trade Report */}
          {analysis && !analysisLoading && (
            <TradeReportPanel report={analysis} />
          )}

          {/* Structure table */}
          {analysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['1D', '4H', '1H'] as const).map(tf => {
                const s = analysis.structure[tf];
                if (!s) return null;
                return (
                  <div key={tf} className="bg-bg-card border border-bg-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-text-secondary text-xs font-semibold">{tf} Structure</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        s.trend === 'bullish' ? 'bg-accent-green bg-opacity-20 text-accent-green' :
                        s.trend === 'bearish' ? 'bg-accent-red bg-opacity-20 text-accent-red' :
                        'bg-bg-border text-text-muted'
                      }`}>
                        {s.trend.toUpperCase()}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-muted">BOS events</span>
                        <span className="text-text-primary">{s.bos.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">CHoCH events</span>
                        <span className="text-text-primary">{s.choch.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Order Blocks</span>
                        <span className="text-text-primary">{s.orderBlocks.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">FVGs</span>
                        <span className="text-text-primary">{s.fvgs.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Liquidity Pools</span>
                        <span className="text-text-primary">{s.liquidityPools.length}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="flex-1 overflow-auto">
          {analysisLoading && !analysis ? (
            <div className="h-64 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : analysis ? (
            <AuditPage report={analysis} />
          ) : (
            <div className="p-6 text-text-muted text-sm">
              Run an analysis first to see audit data.
            </div>
          )}
        </div>
      )}

      {activeTab === 'developer' && (
        <div className="flex-1 overflow-auto">
          {analysisLoading && !analysis ? (
            <div className="h-64 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : analysis ? (
            <DeveloperMode report={analysis} />
          ) : (
            <div className="p-6 text-text-muted text-sm">
              Run an analysis first to see raw JSON.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
