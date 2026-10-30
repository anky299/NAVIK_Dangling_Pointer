import React from 'react';
import { TrendingUp, Compass, SplitSquareVertical, Lightbulb } from 'lucide-react';

const navItems = [
  { id: 'forecast', label: 'Forecast', icon: TrendingUp },
  { id: 'optimizer', label: 'Optimizer', icon: Compass },
  { id: 'scenarios', label: 'Scenarios', icon: SplitSquareVertical },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
];

export default function Sidebar({ activeTab, setActiveTab }) {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-[calc(100vh-61px)]">
      <div className="p-4 border-b border-slate-100">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </span>
      </div>
      <nav className="p-3 space-y-1.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-teal text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-navy'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 bg-slate-50/60 m-3 rounded-lg text-xs text-slate-500 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700">Model Engine</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-teal/10 text-teal-dark font-medium rounded">LightGBM + HiGHS</span>
        </div>
        <p className="text-[11px] text-slate-500">Weekly BDI quantile diffusion & MILP fleet procurement.</p>
      </div>
    </aside>
  );
}
