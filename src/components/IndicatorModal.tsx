import React, { useState } from 'react';
import { IndicatorConfig, IndicatorType } from '../types';
import { X, Plus, Trash2, Sliders } from 'lucide-react';

interface IndicatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  indicators: IndicatorConfig[];
  onUpdateIndicators: (indicators: IndicatorConfig[]) => void;
}

export const IndicatorModal: React.FC<IndicatorModalProps> = ({
  isOpen,
  onClose,
  indicators,
  onUpdateIndicators,
}) => {
  const [selectedType, setSelectedType] = useState<IndicatorType>('SMA');
  const [period, setPeriod] = useState<number>(20);
  const [color, setColor] = useState<string>('#38bdf8');

  if (!isOpen) return null;

  const availableTypes: IndicatorType[] = [
    'SMA',
    'EMA',
    'WMA',
    'VWAP',
    'RSI',
    'MACD',
    'Bollinger',
    'Stochastic',
    'ATR',
    'Volume',
  ];

  const handleAdd = () => {
    const newInd: IndicatorConfig = {
      id: `ind_${Date.now()}`,
      type: selectedType,
      enabled: true,
      params: {
        period,
        color,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        stdDev: 2,
      },
    };
    onUpdateIndicators([...indicators, newInd]);
  };

  const handleToggle = (id: string) => {
    const updated = indicators.map((ind) => (ind.id === id ? { ...ind, enabled: !ind.enabled } : ind));
    onUpdateIndicators(updated);
  };

  const handleDelete = (id: string) => {
    const updated = indicators.filter((ind) => ind.id !== id);
    onUpdateIndicators(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white font-semibold">
            <Sliders className="w-5 h-5 text-sky-400" />
            <span>Technical Indicators & Studies</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Add Indicator Form */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-medium text-slate-300">Add New Indicator</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Indicator</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as IndicatorType)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Period</label>
                <input
                  type="number"
                  value={period}
                  onChange={(e) => setPeriod(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Color</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-10 bg-slate-900 border border-slate-700 rounded-lg px-1 py-1 cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={handleAdd}
              className="w-full mt-2 bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 rounded-lg transition flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Indicator</span>
            </button>
          </div>

          {/* Active Indicators List */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300">Active Indicators ({indicators.length})</h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {indicators.map((ind) => (
                <div key={ind.id} className="bg-slate-950 px-4 py-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={ind.enabled}
                      onChange={() => handleToggle(ind.id)}
                      className="w-4 h-4 rounded border-slate-700 text-sky-600 focus:ring-0 bg-slate-900 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold text-white">{ind.type}</span>
                      <span className="text-xs text-slate-400 ml-2">Period: {ind.params.period || 14}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full border border-slate-700" style={{ backgroundColor: ind.params.color || '#38bdf8' }} />
                    <button onClick={() => handleDelete(ind.id)} className="text-slate-400 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
