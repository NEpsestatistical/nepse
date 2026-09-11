import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { Candle, DrawingObject, DrawingToolType, IndicatorConfig, Timeframe } from '../types';
import {
  calculateSMA,
  calculateEMA,
  calculateWMA,
  calculateVWAP,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateATR,
} from '../utils/indicators';
import { Magnet, Trash2, Undo2, Redo2, RefreshCw } from 'lucide-react';

interface AdvancedChartProps {
  data: Candle[];
  symbol: string;
  timeframe: Timeframe;
  activeTool: DrawingToolType;
  magnetMode: boolean;
  onToggleMagnet: () => void;
  drawings: DrawingObject[];
  onUpdateDrawings: (drawings: DrawingObject[]) => void;
  indicators: IndicatorConfig[];
}

export const AdvancedChart: React.FC<AdvancedChartProps> = ({
  data,
  symbol,
  timeframe,
  activeTool,
  magnetMode,
  onToggleMagnet,
  drawings,
  onUpdateDrawings,
  indicators,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const indicatorSeriesMap = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  const [crosshairData, setCrosshairData] = useState<Candle | null>(null);
  const [drawingHistory, setDrawingHistory] = useState<DrawingObject[][]>([drawings]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<DrawingObject | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);

  // Sync drawing history when external drawings change
  useEffect(() => {
    if (JSON.stringify(drawings) !== JSON.stringify(drawingHistory[historyIndex])) {
      const newHistory = drawingHistory.slice(0, historyIndex + 1);
      newHistory.push(drawings);
      setDrawingHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [drawings]);

  const commitDrawings = (newDrawings: DrawingObject[]) => {
    const newHistory = drawingHistory.slice(0, historyIndex + 1);
    newHistory.push(newDrawings);
    setDrawingHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    onUpdateDrawings(newDrawings);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onUpdateDrawings(drawingHistory[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < drawingHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onUpdateDrawings(drawingHistory[newIndex]);
    }
  };

  const handleClearAll = () => {
    commitDrawings([]);
    setSelectedDrawingId(null);
  };

  const handleDeleteSelected = () => {
    if (selectedDrawingId) {
      const updated = drawings.filter((d) => d.id !== selectedDrawingId);
      commitDrawings(updated);
      setSelectedDrawingId(null);
    }
  };

  // Initialize Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: Math.max(200, container.clientHeight - 40),
      layout: {
        background: { color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#38bdf8', width: 1, style: 3, labelBackgroundColor: '#0284c7' },
        horzLine: { color: '#38bdf8', width: 1, style: 3, labelBackgroundColor: '#0284c7' },
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#334155',
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries as any;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#3b82f6',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries as any;

    // Crosshair move handler for OHLC display
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setCrosshairData(data[data.length - 1] || null);
        return;
      }
      const candleData = param.seriesData.get(candleSeries) as any;
      if (candleData) {
        setCrosshairData({
          time: Number(param.time),
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: candleData.volume || 0,
        });
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const c = chartContainerRef.current;
        chartRef.current.applyOptions({
          width: c.clientWidth || 800,
          height: Math.max(200, c.clientHeight - 40),
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update data in chart & redraw canvas
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !data.length) return;

    candleSeriesRef.current.setData(data as any);
    const volData = data.map((d) => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
    }));
    volumeSeriesRef.current.setData(volData as any);

    if (data.length > 0) {
      setCrosshairData(data[data.length - 1]);
    }

    // Handle indicators
    if (chartRef.current) {
      // Clear old indicators
      indicatorSeriesMap.current.forEach((series) => {
        chartRef.current?.removeSeries(series);
      });
      indicatorSeriesMap.current.clear();

      indicators.forEach((ind) => {
        if (!ind.enabled) return;
        const color = ind.params.color || '#f59e0b';
        let values: (number | null)[] = [];

        switch (ind.type) {
          case 'SMA':
            values = calculateSMA(data, ind.params.period || 20);
            break;
          case 'EMA':
            values = calculateEMA(data, ind.params.period || 20);
            break;
          case 'WMA':
            values = calculateWMA(data, ind.params.period || 20);
            break;
          case 'VWAP':
            values = calculateVWAP(data);
            break;
          case 'ATR':
            values = calculateATR(data, ind.params.period || 14);
            break;
          case 'RSI':
            values = calculateRSI(data, ind.params.period || 14);
            break;
          case 'Volume':
            return;
          case 'Bollinger': {
            const bb = calculateBollingerBands(data, ind.params.period || 20, ind.params.stdDev || 2);
            // Render upper, middle, lower
            ['upper', 'middle', 'lower'].forEach((band, idx) => {
              const vals = idx === 0 ? bb.upper : idx === 1 ? bb.middle : bb.lower;
              if (!vals) return;
              const series = chartRef.current!.addSeries(LineSeries, {
                color: idx === 1 ? color : '#94a3b8',
                lineWidth: 1,
                lineStyle: idx === 1 ? 0 : 2,
              });
              const lineData = data
                .map((d, i) => ({ time: d.time, value: vals[i] }))
                .filter((d): d is { time: number; value: number } => typeof d.value === 'number' && !isNaN(d.value) && d.value !== null);
              series.setData(lineData as any);
              indicatorSeriesMap.current.set(`${ind.id}_${band}`, series);
            });
            return;
          }
          case 'Stochastic': {
            const stoch = calculateStochastic(data, ind.params.period || 14, 3);
            ['k', 'd'].forEach((line, idx) => {
              const vals = idx === 0 ? stoch.kLine : stoch.dLine;
              if (!vals) return;
              const series = chartRef.current!.addSeries(LineSeries, {
                color: idx === 0 ? color : '#f59e0b',
                lineWidth: 1,
              });
              const lineData = data
                .map((d, i) => ({ time: d.time, value: vals[i] }))
                .filter((d): d is { time: number; value: number } => typeof d.value === 'number' && !isNaN(d.value) && d.value !== null);
              series.setData(lineData as any);
              indicatorSeriesMap.current.set(`${ind.id}_${line}`, series);
            });
            return;
          }
          case 'MACD': {
            const macd = calculateMACD(data, 12, 26, 9);
            ['macd', 'signal'].forEach((line, idx) => {
              const vals = idx === 0 ? macd.macdLine : macd.signalLine;
              if (!vals) return;
              const series = chartRef.current!.addSeries(LineSeries, {
                color: idx === 0 ? color : '#38bdf8',
                lineWidth: 1,
              });
              const lineData = data
                .map((d, i) => ({ time: d.time, value: vals[i] }))
                .filter((d): d is { time: number; value: number } => typeof d.value === 'number' && !isNaN(d.value) && d.value !== null);
              series.setData(lineData as any);
              indicatorSeriesMap.current.set(`${ind.id}_${line}`, series);
            });
            return;
          }
        }

        if (values && values.length > 0) {
          const series = chartRef.current!.addSeries(LineSeries, { color, lineWidth: 2 });
          const lineData = data
            .map((d, i) => ({ time: d.time, value: values[i] }))
            .filter((d): d is { time: number; value: number } => typeof d.value === 'number' && !isNaN(d.value) && d.value !== null);
          series.setData(lineData as any);
          indicatorSeriesMap.current.set(ind.id, series);
        }
      });
    }
  }, [data, indicators]);

  // Canvas Drawing & Fibonacci overlay render loop
  const renderDrawings = useCallback(() => {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    if (!canvas || !chart || !candleSeriesRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const timeScale = chart.timeScale();
    const series = candleSeriesRef.current;

    drawings.forEach((d) => {
      ctx.save();
      ctx.strokeStyle = d.color || '#38bdf8';
      ctx.fillStyle = d.color || 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = d.lineWidth || 2;

      const coords = d.points.map((p) => {
        const x = timeScale.timeToCoordinate(p.time as any);
        const y = series.priceToCoordinate(p.price);
        return { x: x ?? 0, y: y ?? 0, time: p.time, price: p.price };
      });

      if (coords.length < 1) return;

      if (d.type === 'trendline' || d.type === 'ray') {
        if (coords.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(coords[0].x, coords[0].y);
          ctx.lineTo(coords[1].x, coords[1].y);
          ctx.stroke();
        }
      } else if (d.type === 'horizLine') {
        ctx.beginPath();
        ctx.moveTo(0, coords[0].y);
        ctx.lineTo(canvas.width, coords[0].y);
        ctx.stroke();
      } else if (d.type === 'vertLine') {
        ctx.beginPath();
        ctx.moveTo(coords[0].x, 0);
        ctx.lineTo(coords[0].x, canvas.height);
        ctx.stroke();
      } else if (d.type === 'rectangle' && coords.length >= 2) {
        const width = coords[1].x - coords[0].x;
        const height = coords[1].y - coords[0].y;
        ctx.fillRect(coords[0].x, coords[0].y, width, height);
        ctx.strokeRect(coords[0].x, coords[0].y, width, height);
      } else if (d.type === 'circle' && coords.length >= 2) {
        const radius = Math.hypot(coords[1].x - coords[0].x, coords[1].y - coords[0].y);
        ctx.beginPath();
        ctx.arc(coords[0].x, coords[0].y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (d.type === 'arrow' && coords.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(coords[0].x, coords[0].y);
        ctx.lineTo(coords[1].x, coords[1].y);
        ctx.stroke();
        // Arrowhead
        const angle = Math.atan2(coords[1].y - coords[0].y, coords[1].x - coords[0].x);
        ctx.beginPath();
        ctx.moveTo(coords[1].x, coords[1].y);
        ctx.lineTo(coords[1].x - 12 * Math.cos(angle - Math.PI / 6), coords[1].y - 12 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(coords[1].x - 12 * Math.cos(angle + Math.PI / 6), coords[1].y - 12 * Math.sin(angle + Math.PI / 6));
        ctx.fillStyle = d.color || '#38bdf8';
        ctx.fill();
      } else if (d.type === 'text') {
        ctx.font = '14px sans-serif';
        ctx.fillStyle = d.color || '#38bdf8';
        ctx.fillText(d.text || 'Text', coords[0].x, coords[0].y);
      } else if (d.type === 'measure' && coords.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(coords[0].x, coords[0].y);
        ctx.lineTo(coords[1].x, coords[1].y);
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        const priceDiff = coords[1].price - coords[0].price;
        const pct = ((priceDiff / coords[0].price) * 100).toFixed(2);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(Math.min(coords[0].x, coords[1].x), Math.min(coords[0].y, coords[1].y) - 25, 110, 22);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '12px sans-serif';
        ctx.fillText(`${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} (${pct}%)`, Math.min(coords[0].x, coords[1].x) + 5, Math.min(coords[0].y, coords[1].y) - 10);
      } else if (d.type === 'fibonacci' && coords.length >= 2) {
        // REAL Fibonacci Retracement System
        const p0 = coords[0];
        const p1 = coords[1];
        const priceHigh = Math.max(p0.price, p1.price);
        const priceLow = Math.min(p0.price, p1.price);
        const diff = priceHigh - priceLow;

        const levels = [
          { ratio: 0, color: 'rgba(239, 68, 68, 0.8)', label: '0.0 (High)' },
          { ratio: 0.236, color: 'rgba(245, 158, 11, 0.8)', label: '0.236' },
          { ratio: 0.382, color: 'rgba(59, 130, 246, 0.8)', label: '0.382' },
          { ratio: 0.5, color: 'rgba(168, 85, 247, 0.8)', label: '0.5 (Mid)' },
          { ratio: 0.618, color: 'rgba(34, 197, 94, 0.8)', label: '0.618 (Golden)' },
          { ratio: 0.786, color: 'rgba(14, 165, 233, 0.8)', label: '0.786' },
          { ratio: 1.0, color: 'rgba(239, 68, 68, 0.8)', label: '1.0 (Low)' },
          { ratio: 1.618, color: 'rgba(236, 72, 153, 0.8)', label: '1.618 (Ext)' },
        ];

        levels.forEach((lvl) => {
          const levelPrice = p0.price > p1.price ? priceHigh - diff * lvl.ratio : priceLow + diff * lvl.ratio;
          const yCoord = series.priceToCoordinate(levelPrice);
          if (yCoord !== null) {
            ctx.strokeStyle = lvl.color;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(0, yCoord);
            ctx.lineTo(canvas.width, yCoord);
            ctx.stroke();

            // Label
            ctx.fillStyle = lvl.color;
            ctx.font = '11px sans-serif';
            ctx.fillText(`Fib ${lvl.label}: ${levelPrice.toFixed(2)}`, 15, yCoord - 4);
          }
        });
      }

      // Highlight selected drawing
      if (d.id === selectedDrawingId) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        coords.forEach((c) => {
          ctx.beginPath();
          ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#f59e0b';
          ctx.fill();
          ctx.stroke();
        });
      }

      ctx.restore();
    });
  }, [drawings, selectedDrawingId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chartRef.current) return;
    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = Math.max(200, (canvas.parentElement?.clientHeight || 600) - 40);
    renderDrawings();

    const chart = chartRef.current;
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      renderDrawings();
    });
  }, [renderDrawings]);

  // Mouse interaction for drawing
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTool === 'cursor') {
      // Check if clicked near any drawing handle or object
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !chartRef.current || !candleSeriesRef.current) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const timeScale = chartRef.current.timeScale();
      const series = candleSeriesRef.current;

      const clicked = drawings.find((d) => {
        return d.points.some((p) => {
          const px = timeScale.timeToCoordinate(p.time as any) ?? 0;
          const py = series.priceToCoordinate(p.price) ?? 0;
          return Math.hypot(px - x, py - y) < 15;
        });
      });

      if (clicked) {
        setSelectedDrawingId(clicked.id);
      } else {
        setSelectedDrawingId(null);
      }
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !chartRef.current || !candleSeriesRef.current) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const timeScale = chartRef.current.timeScale();
    const series = candleSeriesRef.current;

    const time = timeScale.coordinateToTime(x);
    const price = series.coordinateToPrice(y);

    if (time === null || price === null) return;

    const point = { time: Number(time), price };

    if (!isDrawing) {
      const newObj: DrawingObject = {
        id: `draw_${Date.now()}`,
        type: activeTool,
        points: [point, point],
        color: '#38bdf8',
        lineWidth: 2,
        text: activeTool === 'text' ? prompt('Enter text annotation:') || 'Note' : undefined,
      };
      setIsDrawing(true);
      setCurrentDrawing(newObj);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentDrawing || !chartRef.current || !candleSeriesRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const timeScale = chartRef.current.timeScale();
    const series = candleSeriesRef.current;

    const time = timeScale.coordinateToTime(x);
    const price = series.coordinateToPrice(y);

    if (time === null || price === null) return;

    const updatedPoints = [...currentDrawing.points];
    updatedPoints[1] = { time: Number(time), price };
    setCurrentDrawing({ ...currentDrawing, points: updatedPoints });

    // Temporarily render
    renderDrawings();
  };

  const handleCanvasMouseUp = () => {
    if (isDrawing && currentDrawing) {
      commitDrawings([...drawings, currentDrawing]);
      setIsDrawing(false);
      setCurrentDrawing(null);
    }
  };

  return (
    <div className="relative flex-1 w-full h-full bg-slate-900 flex flex-col select-none">
      {/* Top Chart Subheader / OHLC & Quick Toolbar */}
      <div className="h-10 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center space-x-4">
          <span className="font-semibold text-white uppercase tracking-wider">{symbol}</span>
          {crosshairData && (
            <div className="flex items-center space-x-2 font-mono">
              <span className="text-slate-400">O: <strong className="text-white">{crosshairData.open}</strong></span>
              <span className="text-slate-400">H: <strong className="text-white">{crosshairData.high}</strong></span>
              <span className="text-slate-400">L: <strong className="text-white">{crosshairData.low}</strong></span>
              <span className="text-slate-400">C: <strong className="text-white">{crosshairData.close}</strong></span>
              <span className="text-slate-400">Vol: <strong className="text-white">{crosshairData.volume.toLocaleString()}</strong></span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleMagnet}
            className={`p-1.5 rounded transition ${magnetMode ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            title="Magnet / Snap Mode"
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleUndo} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300" title="Undo">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleRedo} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300" title="Redo">
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          {selectedDrawingId && (
            <button onClick={handleDeleteSelected} className="p-1.5 bg-red-600 hover:bg-red-500 rounded text-white flex items-center space-x-1" title="Delete Selected">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={handleClearAll} className="p-1.5 bg-slate-800 hover:bg-red-900 rounded text-slate-300 hover:text-white" title="Clear All Drawings">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Chart Container */}
      <div className="relative flex-1 w-full h-full">
        <div ref={chartContainerRef} className="w-full h-full" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-auto cursor-crosshair z-10"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        />
      </div>
    </div>
  );
};
