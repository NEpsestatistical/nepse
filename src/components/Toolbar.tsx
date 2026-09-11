import React from 'react';
import { DrawingToolType } from '../types';
import {
  MousePointer,
  TrendingUp,
  Maximize2,
  Minus,
  AlignVerticalJustifyStart,
  Square,
  Circle as CircleIcon,
  ArrowUpRight,
  Type,
  Ruler,
  ArrowUp,
  ArrowDown,
  Layers,
} from 'lucide-react';

interface ToolbarProps {
  activeTool: DrawingToolType;
  onSelectTool: (tool: DrawingToolType) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onSelectTool }) => {
  const tools: { id: DrawingToolType; label: string; icon: React.ReactNode }[] = [
    { id: 'cursor', label: 'Cursor', icon: <MousePointer className="w-4 h-4" /> },
    { id: 'trendline', label: 'Trend Line', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'ray', label: 'Ray', icon: <Maximize2 className="w-4 h-4" /> },
    { id: 'horizLine', label: 'Horizontal Line', icon: <Minus className="w-4 h-4" /> },
    { id: 'vertLine', label: 'Vertical Line', icon: <AlignVerticalJustifyStart className="w-4 h-4" /> },
    { id: 'rectangle', label: 'Rectangle', icon: <Square className="w-4 h-4" /> },
    { id: 'circle', label: 'Circle', icon: <CircleIcon className="w-4 h-4" /> },
    { id: 'arrow', label: 'Arrow', icon: <ArrowUpRight className="w-4 h-4" /> },
    { id: 'text', label: 'Text Note', icon: <Type className="w-4 h-4" /> },
    { id: 'measure', label: 'Price Range', icon: <Ruler className="w-4 h-4" /> },
    { id: 'longPos', label: 'Long Position', icon: <ArrowUp className="w-4 h-4 text-emerald-400" /> },
    { id: 'shortPos', label: 'Short Position', icon: <ArrowDown className="w-4 h-4 text-red-400" /> },
    { id: 'fibonacci', label: 'Fibonacci Retracement', icon: <Layers className="w-4 h-4 text-amber-400" /> },
  ];

  return (
    <div className="w-14 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-3 space-y-1 z-20">
      {tools.map((t) => {
        const isActive = activeTool === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelectTool(t.id)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              isActive
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title={t.label}
          >
            {t.icon}
          </button>
        );
      })}
    </div>
  );
};
