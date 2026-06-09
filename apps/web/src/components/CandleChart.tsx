import { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import type { Candle, SwingPoint, OrderBlock, FVG, LiquidityPool } from '../types';

interface BosPoint { type: 'bullish' | 'bearish'; price: number; index: number }

interface Props {
  candles: Candle[];
  // Analysis overlays
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  bos: BosPoint[];
  choch: BosPoint[];
  orderBlocks: OrderBlock[];
  fvgs: FVG[];
  liquidityPools: LiquidityPool[];
  // Toggles
  showSwings: boolean;
  showBOS: boolean;
  showOrderBlocks: boolean;
  showFVGs: boolean;
  showLiquidity: boolean;
}

export function CandleChart({
  candles,
  swingHighs,
  swingLows,
  bos,
  choch,
  orderBlocks,
  fvgs,
  liquidityPools,
  showSwings,
  showBOS,
  showOrderBlocks,
  showFVGs,
  showLiquidity,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0f' },
        textColor: '#8888aa',
      },
      grid: {
        vertLines: { color: '#1a1a2e' },
        horzLines: { color: '#1a1a2e' },
      },
      crosshair: {
        vertLine: { color: '#555570', style: LineStyle.Dashed },
        horzLine: { color: '#555570', style: LineStyle.Dashed },
      },
      rightPriceScale: { borderColor: '#1e1e30' },
      timeScale: { borderColor: '#1e1e30', timeVisible: true },
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00d084',
      downColor: '#ff4757',
      borderUpColor: '#00d084',
      borderDownColor: '#ff4757',
      wickUpColor: '#00d084',
      wickDownColor: '#ff4757',
    });

    if (candles.length > 0) {
      candleSeries.setData(candles.map(c => ({
        time: Math.floor(c.t / 1000) as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })));
      chart.timeScale().fitContent();
    }

    // ── FIX 3: Swing High/Low Markers ─────────────────────────────────────────
    if (showSwings && candles.length > 0) {
      const markers: any[] = [];
      for (const sh of swingHighs) {
        if (candles[sh.index]) {
          markers.push({
            time: Math.floor(candles[sh.index].t / 1000) as any,
            position: 'aboveBar',
            color: '#4a9eff',
            shape: 'arrowDown',
            text: `SH ${sh.price.toFixed(0)}`,
          });
        }
      }
      for (const sl of swingLows) {
        if (candles[sl.index]) {
          markers.push({
            time: Math.floor(candles[sl.index].t / 1000) as any,
            position: 'belowBar',
            color: '#ffd700',
            shape: 'arrowUp',
            text: `SL ${sl.price.toFixed(0)}`,
          });
        }
      }
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      candleSeries.setMarkers(markers);
    }

    // ── FIX 3: BOS/CHoCH Price Lines ──────────────────────────────────────────
    const priceLines: any[] = [];
    if (showBOS) {
      for (const b of bos) {
        priceLines.push(candleSeries.createPriceLine({
          price: b.price,
          color: b.type === 'bullish' ? '#00d084' : '#ff4757',
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: b.type === 'bullish' ? 'BOS ↑' : 'BOS ↓',
        }));
      }
      for (const c of choch) {
        priceLines.push(candleSeries.createPriceLine({
          price: c.price,
          color: c.type === 'bullish' ? '#00d084' : '#ff4757',
          lineStyle: LineStyle.Solid,
          lineWidth: 2,
          axisLabelVisible: true,
          title: c.type === 'bullish' ? 'CHoCH ↑' : 'CHoCH ↓',
        }));
      }
    }

    // ── FIX 3: Order Block Price Lines ────────────────────────────────────────
    if (showOrderBlocks) {
      for (const ob of orderBlocks) {
        const color = ob.type === 'bull' ? '#00d08466' : '#ff475766';
        priceLines.push(candleSeries.createPriceLine({
          price: ob.high,
          color,
          lineStyle: LineStyle.Solid,
          lineWidth: 1,
          axisLabelVisible: false,
          title: ob.type === 'bull' ? `Bull OB` : `Bear OB`,
        }));
        priceLines.push(candleSeries.createPriceLine({
          price: ob.low,
          color,
          lineStyle: LineStyle.Solid,
          lineWidth: 1,
          axisLabelVisible: false,
          title: '',
        }));
      }
    }

    // ── FIX 3: FVG Price Lines ────────────────────────────────────────────────
    if (showFVGs) {
      for (const fvg of fvgs) {
        const color = fvg.type === 'bull' ? '#4a9eff44' : '#a855f744';
        priceLines.push(candleSeries.createPriceLine({
          price: fvg.end,
          color,
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: false,
          title: fvg.type === 'bull' ? 'FVG ↑' : 'FVG ↓',
        }));
        priceLines.push(candleSeries.createPriceLine({
          price: fvg.start,
          color,
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: false,
          title: '',
        }));
      }
    }

    // ── FIX 3: Liquidity Pool Lines ───────────────────────────────────────────
    if (showLiquidity) {
      for (const pool of liquidityPools) {
        priceLines.push(candleSeries.createPriceLine({
          price: pool.price,
          color: pool.type === 'BSL' ? '#00d08455' : '#ff475755',
          lineStyle: LineStyle.Dashed,
          lineWidth: 1,
          axisLabelVisible: true,
          title: pool.type === 'BSL' ? 'BSL' : 'SSL',
        }));
      }
    }

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles, swingHighs, swingLows, bos, choch, orderBlocks, fvgs, liquidityPools, showSwings, showBOS, showOrderBlocks, showFVGs, showLiquidity]);

  // Active overlays for legend
  const activeOverlays: string[] = [];
  if (showSwings) activeOverlays.push('Swings');
  if (showBOS) activeOverlays.push('BOS/CHoCH');
  if (showOrderBlocks) activeOverlays.push('OBs');
  if (showFVGs) activeOverlays.push('FVGs');
  if (showLiquidity) activeOverlays.push('Liquidity');

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* FIX 3: Overlay Legend */}
      <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
        {activeOverlays.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {showSwings && (
              <span className="flex items-center gap-1 bg-bg-secondary bg-opacity-80 px-1.5 py-0.5 rounded text-xs">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                <span className="text-text-muted">Swings</span>
              </span>
            )}
            {showBOS && (
              <span className="flex items-center gap-1 bg-bg-secondary bg-opacity-80 px-1.5 py-0.5 rounded text-xs">
                <span className="w-3 border-t border-dashed border-accent-green inline-block" />
                <span className="text-text-muted">BOS</span>
                <span className="w-3 border-t-2 border-accent-red inline-block" />
                <span className="text-text-muted">CHoCH</span>
              </span>
            )}
            {showOrderBlocks && (
              <span className="flex items-center gap-1 bg-bg-secondary bg-opacity-80 px-1.5 py-0.5 rounded text-xs">
                <span className="w-3 h-2 bg-accent-green opacity-40 inline-block rounded-sm" />
                <span className="text-text-muted">OBs</span>
              </span>
            )}
            {showFVGs && (
              <span className="flex items-center gap-1 bg-bg-secondary bg-opacity-80 px-1.5 py-0.5 rounded text-xs">
                <span className="w-3 h-2 bg-blue-400 opacity-30 inline-block rounded-sm" />
                <span className="text-text-muted">FVGs</span>
              </span>
            )}
            {showLiquidity && (
              <span className="flex items-center gap-1 bg-bg-secondary bg-opacity-80 px-1.5 py-0.5 rounded text-xs">
                <span className="w-3 border-t border-dashed border-accent-green opacity-60 inline-block" />
                <span className="text-text-muted">BSL</span>
                <span className="w-3 border-t border-dashed border-accent-red opacity-60 inline-block" />
                <span className="text-text-muted">SSL</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
