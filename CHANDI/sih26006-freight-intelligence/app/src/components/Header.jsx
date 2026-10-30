import React from 'react';
import { Ship, AlertTriangle } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-navy text-white sticky top-0 z-30 shadow-md">
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-navy-light">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-teal flex items-center justify-center text-white shadow-sm">
            <Ship className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">
              SAIL Freight Intelligence
            </h1>
            <p className="text-xs text-slate-300 font-medium">
              Steel Authority of India Limited • Raw Material Logistics Advisory
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-amber/15 border border-amber/30 text-amber-light px-3.5 py-1.5 rounded-full text-xs font-medium">
          <AlertTriangle className="w-3.5 h-3.5 text-amber shrink-0" />
          <span className="text-amber-200">
            Prototype: demand, prices & capacities are synthetic placeholders. Baltic sub-indices after July 2019 are derived.
          </span>
        </div>
      </div>
    </header>
  );
}
