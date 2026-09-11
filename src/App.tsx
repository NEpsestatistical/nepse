import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Toolbar } from './components/Toolbar';
import { AdvancedChart } from './components/AdvancedChart';
import { IndicatorModal } from './components/IndicatorModal';
import { PortfolioView } from './components/PortfolioView';
import { NEPSE_STOCKS, generateHistoricalData } from './data/nepseData';
import { DrawingObject, DrawingToolType, IndicatorConfig, PortfolioHolding, Timeframe, Transaction } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chart' | 'portfolio'>('chart');
  const [currentSymbol, setCurrentSymbol] = useState<string>('NABIL');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [activeTool, setActiveTool] = useState<DrawingToolType>('cursor');
  const [magnetMode, setMagnetMode] = useState<boolean>(false);
  const [showIndicatorsModal, setShowIndicatorsModal] = useState<boolean>(false);

  // Persistent drawings
  const [drawings, setDrawings] = useState<DrawingObject[]>(() => {
    const saved = localStorage.getItem('nepse_drawings');
    return saved ? JSON.parse(saved) : [];
  });

  // Persistent indicators
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([
    { id: 'ind_1', type: 'SMA', enabled: true, params: { period: 20, color: '#38bdf8' } },
    { id: 'ind_2', type: 'SMA', enabled: true, params: { period: 50, color: '#f59e0b' } },
  ]);

  // Persistent portfolio holdings
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(() => {
    const saved = localStorage.getItem('nepse_holdings');
    return saved
      ? JSON.parse(saved)
      : [
          { id: 'h_1', symbol: 'NABIL', shares: 120, buyPrice: 810, buyDate: '2026-01-15' },
          { id: 'h_2', symbol: 'HDL', shares: 50, buyPrice: 1750, buyDate: '2026-02-10' },
          { id: 'h_3', symbol: 'SHIVM', shares: 200, buyPrice: 490, buyDate: '2026-03-01' },
        ];
  });

  // Persistent transactions
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('nepse_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('nepse_drawings', JSON.stringify(drawings));
  }, [drawings]);

  useEffect(() => {
    localStorage.setItem('nepse_holdings', JSON.stringify(holdings));
  }, [holdings]);

  useEffect(() => {
    localStorage.setItem('nepse_transactions', JSON.stringify(transactions));
  }, [transactions]);

  // Generate historical candle data for current symbol & timeframe
  const [chartData, setChartData] = useState(() => generateHistoricalData(currentSymbol, timeframe));

  useEffect(() => {
    setChartData(generateHistoricalData(currentSymbol, timeframe));
  }, [currentSymbol, timeframe]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 overflow-hidden font-sans">
      <Navbar
        stocks={NEPSE_STOCKS}
        currentSymbol={currentSymbol}
        onSelectSymbol={setCurrentSymbol}
        currentTimeframe={timeframe}
        onSelectTimeframe={setTimeframe}
        onOpenIndicators={() => setShowIndicatorsModal(true)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'chart' ? (
          <>
            <Toolbar activeTool={activeTool} onSelectTool={setActiveTool} />
            <AdvancedChart
              data={chartData}
              symbol={currentSymbol}
              timeframe={timeframe}
              activeTool={activeTool}
              magnetMode={magnetMode}
              onToggleMagnet={() => setMagnetMode(!magnetMode)}
              drawings={drawings}
              onUpdateDrawings={setDrawings}
              indicators={indicators}
            />
          </>
        ) : (
          <PortfolioView
            holdings={holdings}
            onUpdateHoldings={setHoldings}
            transactions={transactions}
            onUpdateTransactions={setTransactions}
            stocks={NEPSE_STOCKS}
            onSelectSymbol={(sym) => {
              setCurrentSymbol(sym);
              setActiveTab('chart');
            }}
          />
        )}
      </div>

      <IndicatorModal
        isOpen={showIndicatorsModal}
        onClose={() => setShowIndicatorsModal(false)}
        indicators={indicators}
        onUpdateIndicators={setIndicators}
      />
    </div>
  );
}
