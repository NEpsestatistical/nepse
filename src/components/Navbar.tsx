import React, { useState } from 'react';
import { StockSymbol, Timeframe } from '../types';
import { TrendingUp, Search, Sliders, Briefcase, BarChart2, ChevronDown } from 'lucide-react';

interface NavbarProps {
  stocks: StockSymbol[];
  currentSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  currentTimeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
  onOpenIndicators: () => void;
  activeTab: 'chart' | 'portfolio';
  onSelectTab: (tab: 'chart' | 'portfolio') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  stocks,
  currentSymbol,
  onSelectSymbol,
  currentTimeframe,
  onSelectTimeframe,
  onOpenIndicators,
  activeTab,
  onSelectTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const timeframes: Timeframe[] = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];
  const currentStock = stocks.find((s) => s.symbol === currentSymbol) || stocks[0];

  const filteredStocks = stocks.filter(
    (s) => s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="h-16 bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between z-30 select-none">
      {/* Brand & Symbol Selector */}
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-900/40">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="font-bold text-white tracking-tight text-lg hidden sm:inline">NEPSE Pro</span>
        </div>

        {/* Symbol Search / Selector Dropdown */}
        <div className="relative">
          <div
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-3 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 px-3 py-1.5 rounded-xl cursor-pointer transition"
          >
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm">{currentStock.symbol}</span>
                <span className="text-xs text-slate-400">Rs. {currentStock.ltp.toFixed(2)}</span>
              </div>
              <div className={`text-[10px] font-medium ${currentStock.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {currentStock.change >= 0 ? '+' : ''}{currentStock.change} ({currentStock.changePercent}%)
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex items-center space-x-2">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search NEPSE stock..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-white focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                {filteredStocks.map((s) => (
                  <div
                    key={s.symbol}
                    onClick={() => {
                      onSelectSymbol(s.symbol);
                      setShowDropdown(false);
                    }}
                    className="px-4 py-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between transition"
                  >
                    <div>
                      <div className="font-semibold text-white text-sm">{s.symbol}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[150px]">{s.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-white">Rs. {s.ltp}</div>
                      <div className={`text-xs ${s.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {s.change >= 0 ? '+' : ''}{s.changePercent}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Timeframes */}
        {activeTab === 'chart' && (
          <div className="hidden lg:flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe(tf)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  currentTimeframe === tf ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Controls / View Tabs */}
      <div className="flex items-center space-x-3">
        {activeTab === 'chart' && (
          <button
            onClick={onOpenIndicators}
            className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-medium transition"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span>Indicators</span>
          </button>
        )}

        <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onSelectTab('chart')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'chart' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Chart</span>
          </button>
          <button
            onClick={() => onSelectTab('portfolio')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'portfolio' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Portfolio</span>
          </button>
        </div>
      </div>
    </header>
  );
};
