import React, { useState } from 'react';
import { PortfolioHolding, StockSymbol, Transaction } from '../types';
import { Briefcase, TrendingUp, TrendingDown, Plus, Trash2, DollarSign } from 'lucide-react';

interface PortfolioViewProps {
  holdings: PortfolioHolding[];
  onUpdateHoldings: (holdings: PortfolioHolding[]) => void;
  transactions: Transaction[];
  onUpdateTransactions: (transactions: Transaction[]) => void;
  stocks: StockSymbol[];
  onSelectSymbol: (symbol: string) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  holdings,
  onUpdateHoldings,
  transactions,
  onUpdateTransactions,
  stocks,
  onSelectSymbol,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(stocks[0]?.symbol || 'NABIL');
  const [shares, setShares] = useState<number>(100);
  const [buyPrice, setBuyPrice] = useState<number>(800);
  const [buyDate, setBuyDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const handleAddHolding = (e: React.FormEvent) => {
    e.preventDefault();
    const newHolding: PortfolioHolding = {
      id: `hold_${Date.now()}`,
      symbol: selectedSymbol,
      shares,
      buyPrice,
      buyDate,
    };
    const newTx: Transaction = {
      id: `tx_${Date.now()}`,
      symbol: selectedSymbol,
      type: 'BUY',
      shares,
      price: buyPrice,
      date: buyDate,
      totalAmount: shares * buyPrice,
      commission: (shares * buyPrice) * 0.004,
    };

    onUpdateHoldings([...holdings, newHolding]);
    onUpdateTransactions([newTx, ...transactions]);
    setShowAddModal(false);
  };

  const handleDeleteHolding = (id: string) => {
    onUpdateHoldings(holdings.filter((h) => h.id !== id));
  };

  // Calculate portfolio metrics
  let totalInvested = 0;
  let totalCurrentValue = 0;

  const enrichedHoldings = holdings.map((h) => {
    const stock = stocks.find((s) => s.symbol === h.symbol);
    const ltp = stock ? stock.ltp : h.buyPrice;
    const invested = h.shares * h.buyPrice;
    const currentVal = h.shares * ltp;
    const pnl = currentVal - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

    totalInvested += invested;
    totalCurrentValue += currentVal;

    return {
      ...h,
      ltp,
      invested,
      currentVal,
      pnl,
      pnlPct,
    };
  });

  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="flex-1 bg-slate-900 p-6 overflow-y-auto space-y-6">
      {/* Top Banner & Stats */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Briefcase className="w-6 h-6 text-sky-400" />
            <span>NEPSE Portfolio & Watchlist</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage your Nepal Stock Exchange investments, track gains, and analyze market trends.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-sky-600 hover:bg-sky-500 text-white font-medium px-4 py-2.5 rounded-xl transition flex items-center space-x-2 shadow-lg shadow-sky-900/30"
        >
          <Plus className="w-4 h-4" />
          <span>Add Transaction / Holding</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 uppercase tracking-wider">Total Portfolio Value</span>
          <div className="text-2xl font-bold text-white mt-1">Rs. {totalCurrentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 uppercase tracking-wider">Total Invested Amount</span>
          <div className="text-2xl font-bold text-white mt-1">Rs. {totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <span className="text-xs text-slate-400 uppercase tracking-wider">Total Return / P&L</span>
          <div className={`text-2xl font-bold mt-1 flex items-center space-x-1 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnL >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            <span>
              {totalPnL >= 0 ? '+' : ''}Rs. {totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({totalPnLPct.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white">Current Holdings ({enrichedHoldings.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-xs text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Symbol</th>
                <th className="px-6 py-3">Shares</th>
                <th className="px-6 py-3">Buy Price</th>
                <th className="px-6 py-3">LTP</th>
                <th className="px-6 py-3">Current Value</th>
                <th className="px-6 py-3">P&L</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {enrichedHoldings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    No holdings added yet. Click "Add Transaction / Holding" to start tracking.
                  </td>
                </tr>
              ) : (
                enrichedHoldings.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-900/50 transition">
                    <td className="px-6 py-4 font-semibold text-white">
                      <button onClick={() => onSelectSymbol(h.symbol)} className="text-sky-400 hover:underline">
                        {h.symbol}
                      </button>
                    </td>
                    <td className="px-6 py-4">{h.shares}</td>
                    <td className="px-6 py-4">Rs. {h.buyPrice.toFixed(2)}</td>
                    <td className="px-6 py-4">Rs. {h.ltp.toFixed(2)}</td>
                    <td className="px-6 py-4 font-medium text-white">Rs. {h.currentVal.toFixed(2)}</td>
                    <td className={`px-6 py-4 font-medium ${h.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {h.pnl >= 0 ? '+' : ''}Rs. {h.pnl.toFixed(2)} ({h.pnlPct.toFixed(2)}%)
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDeleteHolding(h.id)} className="text-slate-400 hover:text-red-400 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Holding Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-white">Add Portfolio Transaction</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleAddHolding} className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Stock Symbol</label>
                <select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  {stocks.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Number of Shares</label>
                <input
                  type="number"
                  value={shares}
                  onChange={(e) => setShares(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Buy Price (Rs.)</label>
                <input
                  type="number"
                  step="0.01"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={buyDate}
                  onChange={(e) => setBuyDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 rounded-xl transition"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
