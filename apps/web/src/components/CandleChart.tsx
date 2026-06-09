import { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle } from 'lightweight-charts';
import type { Candle, OrderBlock, FVG, LiquidityPool } from '../types';

interface Props {
  candles: Candle[];
  orderBlocks: OrderBlock[];
  fvgs: FVG[];
  liquidityPools: LiquidityPool[];
}

export function CandleChart({ candles, orderBlocks, fvgs, liquidityPools }: Props) {
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

    // Add liquidity pool lines
    for (const pool of liquidityPools) {
      const lineSeries = chart.addLineSeries({
        color: pool.type === 'BSL' ? '#00d08466' : '#ff475766',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      if (candles.length >= 2) {
        const startTime = Math.floor(candles[0].t / 1000);
        const endTime = Math.floor(candles[candles.length - 1].t / 1000);
        lineSeries.setData([
          { time: startTime as any, value: pool.price },
          { time: endTime as any, value: pool.price },
        ]);
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
  }, [candles, orderBlocks, fvgs, liquidityPools]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {/* Legend */}
      <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
        {orderBlocks.length > 0 && (
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-accent-green opacity-40 inline-block rounded-sm" />
              <span className="text-text-muted">Bull OB</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-accent-red opacity-40 inline-block rounded-sm" />
              <span className="text-text-muted">Bear OB</span>
            </span>
          </div>
        )}
        {liquidityPools.length > 0 && (
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 border-t border-dashed border-accent-green opacity-60 inline-block" />
              <span className="text-text-muted">BSL</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 border-t border-dashed border-accent-red opacity-60 inline-block" />
              <span className="text-text-muted">SSL</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
