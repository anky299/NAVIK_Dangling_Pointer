import React, { useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  SplitSquareVertical,
  Play,
  Clock,
  AlertCircle,
  RotateCcw,
  ShieldAlert,
  Database,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { runScenarios } from '../api';

// ─── Design System ───────────────────────────────────────────────────────────
const PALETTE = {
  navy:  '#0B2545',
  teal:  '#13A89E',
  amber: '#F2A541',
  risk:  '#D64545',
  slate: '#64748B',
};

const SCENARIO_META = {
  low:  { label: 'Low Market',  band: 'q10', color: PALETTE.teal,  brent: 65,  hirePct: -20 },
  base: { label: 'Base Market', band: 'q50', color: PALETTE.navy,  brent: 80,  hirePct:   0 },
  high: { label: 'High Market', band: 'q90', color: PALETTE.amber, brent: 100, hirePct: +30 },
};

const DEFAULT_WEIGHTS = { low: 25, base: 50, high: 25 };

const MODES = [
  { id: 'cached', label: 'Cached', desc: 'Instant precomputed' },
  { id: 'fast',   label: 'Fast',   desc: '~20s per scenario (×3)' },
  { id: 'full',   label: 'Full',   desc: '~2 min, background' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(val, decimals = 1) {
  if (val == null || isNaN(Number(val))) return '—';
  return `$${(Number(val) / 1e6).toFixed(decimals)}M`;
}

function fmtPct(val) {
  if (val == null || isNaN(Number(val))) return '—';
  return `${Number(val) >= 0 ? '+' : ''}${Number(val).toFixed(1)}%`;
}

function expectedCost(plans, weights) {
  return plans.reduce((sum, p) => sum + p.objective_value * ((weights[p.scenario] || 0) / 100), 0);
}

function buildWhatChanges(plans) {
  const nonZero = (rec) => (rec || []).filter(s => (s.tonnes || 0) > 0);
  const planMap = Object.fromEntries(plans.map(p => [p.scenario, p]));
  const lines = [];

  // Charter mode
  const charterModes = Object.fromEntries(
    ['low','base','high'].map(s => {
      const rec = nonZero(planMap[s]?.month_1_recommendation);
      const top = rec.length > 0 ? rec.sort((a,b) => b.tonnes - a.tonnes)[0]?.charter_mode?.toUpperCase() : 'NONE';
      return [s, top];
    })
  );
  const charterSet = new Set(Object.values(charterModes));
  lines.push(charterSet.size > 1
    ? { icon: '⚓', text: `Charter mode shifts: Low=${charterModes.low}, Base=${charterModes.base}, High=${charterModes.high}`, type: 'change' }
    : { icon: '✓', text: `Charter mode is robust across all scenarios: ${[...charterSet][0]}`, type: 'robust' }
  );

  // Origin
  const origins = Object.fromEntries(
    ['low','base','high'].map(s => {
      const rec = nonZero(planMap[s]?.month_1_recommendation);
      return [s, rec.length > 0 ? rec.sort((a,b) => b.tonnes - a.tonnes)[0]?.origin : 'None'];
    })
  );
  const originSet = new Set(Object.values(origins));
  lines.push(originSet.size > 1
    ? { icon: '🚢', text: `Load port switches: Low=${origins.low}, Base=${origins.base}, High=${origins.high}`, type: 'change' }
    : { icon: '✓', text: `Load port is robust: ${[...originSet][0]} in all scenarios`, type: 'robust' }
  );

  // Vessel class
  const vessels = Object.fromEntries(
    ['low','base','high'].map(s => {
      const rec = nonZero(planMap[s]?.month_1_recommendation);
      return [s, rec.length > 0 ? rec.sort((a,b) => b.tonnes - a.tonnes)[0]?.vessel_class : 'None'];
    })
  );
  const vesselSet = new Set(Object.values(vessels));
  lines.push(vesselSet.size > 1
    ? { icon: '🏭', text: `Vessel class varies: Low=${vessels.low}, Base=${vessels.base}, High=${vessels.high}`, type: 'change' }
    : { icon: '✓', text: `Vessel class is robust: ${[...vesselSet][0]} in all scenarios`, type: 'robust' }
  );

  // Unmet demand warnings
  ['low','base','high'].forEach(s => {
    const unmet = planMap[s]?.cost_breakdown?.unmet || 0;
    if (unmet > 1e6) {
      lines.push({
        icon: '⚠️',
        text: `Unmet demand in ${SCENARIO_META[s].label}: ${fmt(unmet, 2)} — switch to Full mode for a tighter solution.`,
        type: 'warning',
      });
    }
  });

  return lines;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ScenariosScreen() {
  const [cargo,         setCargo]         = useState('coking_coal');
  const [quantityMt,   setQuantityMt]    = useState(1000000);
  const [deadlineMonth, setDeadlineMonth] = useState(3);
  const [mode,          setMode]          = useState('fast');
  const [weights,       setWeights]       = useState({ ...DEFAULT_WEIGHTS });

  const [loading, setLoading] = useState(false);
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState(null);
  const [fieldErr,setFieldErr]= useState({});

  function validate() {
    const errs = {};
    const q = Number(quantityMt);
    if (isNaN(q) || q <= 0) errs.quantity = 'Quantity must be positive.';
    const d = Number(deadlineMonth);
    if (isNaN(d) || d < 1 || d > 6) errs.deadline = 'Deadline must be Month 1–6.';
    const wsum = weights.low + weights.base + weights.high;
    if (Math.abs(wsum - 100) > 0.5) errs.weights = 'Weights must sum to 100%.';
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  }

  const handleWeightChange = useCallback((changed, newVal) => {
    const clamped = Math.max(0, Math.min(100, newVal));
    const others = ['low','base','high'].filter(k => k !== changed);
    const remaining = 100 - clamped;
    const currentSum = weights[others[0]] + weights[others[1]];
    let o0, o1;
    if (currentSum === 0) {
      o0 = Math.round(remaining / 2);
      o1 = remaining - o0;
    } else {
      const ratio = weights[others[0]] / currentSum;
      o0 = Math.round(remaining * ratio);
      o1 = remaining - o0;
    }
    setWeights({ ...weights, [changed]: clamped, [others[0]]: o0, [others[1]]: o1 });
  }, [weights]);

  async function handleRun() {
    if (!validate()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await runScenarios({
        cargo,
        quantity_mt:      Number(quantityMt),
        deadline_month:   Number(deadlineMonth),
        scenario_weights: { low: weights.low/100, base: weights.base/100, high: weights.high/100 },
        mode,
      });
      setData(res);
    } catch (err) {
      setError(err.message || 'Scenario comparison failed.');
    } finally {
      setLoading(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const planMap  = data ? Object.fromEntries(data.plans.map(p => [p.scenario, p])) : {};
  const lowCost  = planMap.low?.objective_value  || 0;
  const baseCost = planMap.base?.objective_value || 0;
  const highCost = planMap.high?.objective_value || 0;
  const costRange = highCost - lowCost;
  const spreadPct = baseCost > 0 ? (costRange / baseCost) * 100 : 0;
  const expCost   = data ? expectedCost(data.plans, weights) : 0;

  const COST_KEYS = [
    { key: 'cargo',       label: 'Cargo FOB'  },
    { key: 'freight',     label: 'Freight'    },
    { key: 'period_hire', label: 'Period Hire'},
    { key: 'demurrage',   label: 'Demurrage'  },
    { key: 'inventory',   label: 'Inventory'  },
    { key: 'unmet',       label: 'Unmet'      },
  ];
  const groupedBarData = data
    ? COST_KEYS.map(c => ({
        name: c.label,
        Low:  Math.round((planMap.low?.cost_breakdown?.[c.key]  || 0) / 1e6),
        Base: Math.round((planMap.base?.cost_breakdown?.[c.key] || 0) / 1e6),
        High: Math.round((planMap.high?.cost_breakdown?.[c.key] || 0) / 1e6),
      })).filter(r => r.Low + r.Base + r.High > 0)
    : [];

  const whatChanges = data && data.plans.length === 3 ? buildWhatChanges(data.plans) : [];
  const allRobust   = whatChanges.length > 0 && whatChanges.every(l => l.type === 'robust');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy tracking-tight">Multi-Scenario Stress Analysis</h2>
          <p className="text-sm text-slate-500 mt-1">
            Evaluate landed-cost exposure and charter mix across Low (q10), Base (q50) and High (q90) market regimes.
          </p>
        </div>
        {data && (
          <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs text-slate-600 font-medium">
            <Database className="w-3.5 h-3.5 text-teal" />
            <span>
              Live solve · {data.plans[0]?.solve_time_seconds?.toFixed(1)}s per scenario
            </span>
          </div>
        )}
      </div>

      {/* ── Control Panel ─────────────────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left: Shipment inputs */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shipment Parameters</h3>

            {/* Cargo */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Cargo Material</label>
              <select value={cargo} onChange={e => setCargo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal">
                <option value="coking_coal">Coking Coal (Blast Furnace Feed)</option>
                <option value="thermal_coal">Thermal Coal (PCI / Power Blend)</option>
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Demand Quantity (MT)</label>
              <input type="number" value={quantityMt} step="50000"
                onChange={e => setQuantityMt(e.target.value)}
                className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal ${fieldErr.quantity ? 'border-risk bg-red-50/50' : 'border-slate-300'}`}
              />
              {fieldErr.quantity && <p className="text-xs text-risk mt-1 font-medium">{fieldErr.quantity}</p>}
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Horizon Deadline</label>
              <select value={deadlineMonth} onChange={e => setDeadlineMonth(Number(e.target.value))}
                className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal ${fieldErr.deadline ? 'border-risk bg-red-50/50' : 'border-slate-300'}`}>
                <option value={1}>Month 1 (Immediate)</option>
                <option value={2}>Month 2 (Quarterly Front)</option>
                <option value={3}>Month 3 (Mid-Horizon)</option>
                <option value={6}>Month 6 (Full Horizon)</option>
              </select>
              {fieldErr.deadline && <p className="text-xs text-risk mt-1 font-medium">{fieldErr.deadline}</p>}
            </div>

            {/* Mode */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Solver Mode</label>
              <div className="flex gap-2">
                {MODES.map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)}
                    className={`flex-1 px-2 py-2 rounded-lg border text-xs font-semibold transition-all text-center ${
                      mode === m.id ? 'bg-teal text-white border-teal' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}>
                    <div>{m.label}</div>
                    <div className={`text-[10px] font-normal mt-0.5 ${mode === m.id ? 'text-white/80' : 'text-slate-400'}`}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Scenario weight sliders */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Scenario Probability Weights</h3>
              <button onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}
                className="flex items-center space-x-1 text-xs text-teal font-semibold hover:underline">
                <RotateCcw className="w-3 h-3" /><span>Reset 25/50/25</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              {['low','base','high'].map(scen => {
                const meta = SCENARIO_META[scen];
                return (
                  <div key={scen}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                        {meta.label} ({meta.band})
                      </span>
                      <span className="text-xs font-bold text-slate-800 w-9 text-right tabular-nums">{weights[scen]}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={5} value={weights[scen]}
                      onChange={e => handleWeightChange(scen, Number(e.target.value))}
                      className="w-full h-1.5 rounded appearance-none cursor-pointer"
                      style={{ accentColor: meta.color }}
                    />
                  </div>
                );
              })}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-xs">
                <span className="text-slate-500">Total weight:</span>
                <span className={`font-bold tabular-nums ${Math.abs(weights.low + weights.base + weights.high - 100) > 0.5 ? 'text-risk' : 'text-teal'}`}>
                  {weights.low + weights.base + weights.high}% {Math.abs(weights.low + weights.base + weights.high - 100) <= 0.5 && '✓'}
                </span>
              </div>
              {fieldErr.weights && <p className="text-xs text-risk font-medium">{fieldErr.weights}</p>}
            </div>

            {/* Scenario assumption cards */}
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              {['low','base','high'].map(scen => {
                const meta = SCENARIO_META[scen];
                return (
                  <div key={scen} className="p-2.5 rounded-lg border"
                    style={{ borderColor: meta.color + '50', backgroundColor: meta.color + '0D' }}>
                    <div className="font-bold mb-1" style={{ color: meta.color }}>{meta.label}</div>
                    <div className="text-slate-500">Brent: <span className="font-semibold text-slate-700">${meta.brent}/bbl</span></div>
                    <div className="text-slate-500">Hire: <span className="font-semibold text-slate-700">{meta.hirePct >= 0 ? '+' : ''}{meta.hirePct}% vs base</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Run Button */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-100 gap-4">
          {loading && (
            <p className="text-xs text-teal font-medium flex items-center gap-1.5 animate-pulse">
              <Clock className="w-3.5 h-3.5" />
              Running 3 solver instances in {mode} mode…
            </p>
          )}
          <button onClick={handleRun} disabled={loading}
            className="flex items-center space-x-2 bg-teal hover:bg-teal-dark text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm disabled:opacity-50">
            {loading
              ? <><Clock className="w-4 h-4 animate-spin" /><span>Simulating…</span></>
              : <><Play className="w-4 h-4 fill-white" /><span>Simulate Scenario Spread</span></>}
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-risk flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Scenario Comparison Failed</p>
            <p className="text-xs text-slate-600 mt-1">{error}</p>
            <button onClick={handleRun}
              className="mt-2 text-xs font-bold text-white bg-risk hover:bg-risk-dark px-3 py-1.5 rounded-lg flex items-center space-x-1">
              <RotateCcw className="w-3 h-3" /><span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {['low','base','high'].map(s => (
            <div key={s} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-14 rounded-t-xl" style={{ backgroundColor: SCENARIO_META[s].color + '30' }} />
              <div className="p-5 space-y-3">
                <div className="h-7 bg-slate-100 rounded w-2/3" />
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-5/6" />
                <div className="h-3 bg-slate-100 rounded w-4/6" />
                <div className="h-3 bg-slate-100 rounded w-3/6" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!data && !loading && !error && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center flex flex-col items-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <SplitSquareVertical className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-navy">No Scenario Run Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
            Set your shipment parameters and probability weights above, then click
            "Simulate Scenario Spread" to compare Low, Base and High market outcomes side-by-side.
          </p>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {data && !loading && (
        <div className="space-y-6">

          {/* 1. Three scenario columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['low','base','high'].map(scen => {
              const p    = planMap[scen];
              const meta = SCENARIO_META[scen];
              if (!p) return null;
              const nonZeroRec = (p.month_1_recommendation || []).filter(s => (s.tonnes || 0) > 0);
              const unmet = p.cost_breakdown?.unmet || 0;

              return (
                <div key={scen} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="px-5 py-3 flex items-center justify-between text-white"
                    style={{ backgroundColor: meta.color }}>
                    <div>
                      <div className="font-bold text-sm">{meta.label}</div>
                      <div className="text-[11px] opacity-80">Forecast band: {meta.band}</div>
                    </div>
                    <div className="text-right text-[10px] opacity-80 font-mono">
                      <div>Gap: {p.solver_gap_pct?.toFixed(1)}%</div>
                      <div>{p.solve_time_seconds?.toFixed(1)}s</div>
                    </div>
                  </div>

                  <div className="p-5 flex-1 space-y-4">
                    {/* Scenario assumptions */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Brent</div>
                        <div className="text-sm font-bold text-slate-800">${meta.brent}/bbl</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Hire Δ</div>
                        <div className="text-sm font-bold text-slate-800">
                          {meta.hirePct >= 0 ? '+' : ''}{meta.hirePct}%
                        </div>
                      </div>
                    </div>

                    {/* Total cost */}
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Landed Cost</span>
                      <div className="text-2xl font-bold text-navy mt-0.5">{fmt(p.objective_value)}</div>
                      <span className="text-[10px] text-slate-400 italic">on synthetic demand and prices</span>
                    </div>

                    {/* Cost breakdown rows */}
                    <div className="space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                      {[
                        { label: 'Cargo FOB',   val: p.cost_breakdown?.cargo       },
                        { label: 'Freight',      val: p.cost_breakdown?.freight     },
                        { label: 'Period Hire',  val: p.cost_breakdown?.period_hire },
                        { label: 'Demurrage',    val: p.cost_breakdown?.demurrage   },
                        { label: 'Inventory',    val: p.cost_breakdown?.inventory   },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between">
                          <span className="text-slate-500">{row.label}:</span>
                          <span className="font-semibold text-slate-800">{fmt(row.val || 0)}</span>
                        </div>
                      ))}
                      {unmet > 0 && (
                        <div className="flex justify-between pt-1 border-t border-amber-200">
                          <span className="text-amber-700 font-semibold flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 inline" /> Unmet Penalty:
                          </span>
                          <span className="font-bold text-amber-700">{fmt(unmet)}</span>
                        </div>
                      )}
                    </div>

                    {/* Month-1 Recommendation */}
                    <div className="border-t border-slate-100 pt-3">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                        Month-1 Fixtures
                      </span>
                      {nonZeroRec.length > 0 ? (
                        <div className="space-y-1.5">
                          {nonZeroRec.map((s, idx) => (
                            <div key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-navy">{s.origin}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                                  style={{ backgroundColor: meta.color }}>
                                  {(s.charter_mode || '').toUpperCase()}
                                </span>
                              </div>
                              <div className="text-slate-500 mt-0.5">→ {s.port} · {s.vessel_class}</div>
                              <div className="font-semibold text-slate-700 mt-0.5">
                                {Number(s.tonnes).toLocaleString()} MT · {s.voyages} voy
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No fixtures in Month 1.</p>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 pt-1">
                      Solver: <span className="font-semibold">{p.solver_status}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Grouped bar chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-navy">Cost Component Comparison</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Grouped bars per cost element — values in $M.{' '}
                <span className="italic">on synthetic demand and prices</span>
              </p>
            </div>
            {groupedBarData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupedBarData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    barCategoryGap="25%" barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={v => `$${v}M`} />
                    <Tooltip formatter={(v, n) => [`$${v}M`, n]} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="Low"  name="Low (q10)"  fill={PALETTE.teal}  radius={[3,3,0,0]} />
                    <Bar dataKey="Base" name="Base (q50)" fill={PALETTE.navy}  radius={[3,3,0,0]} />
                    <Bar dataKey="High" name="High (q90)" fill={PALETTE.amber} radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-xs text-slate-400 py-8">No cost data available to chart.</p>
            )}
          </div>

          {/* 3. What Changes table */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-navy">What Changes Across Scenarios?</h3>
              <p className="text-xs text-slate-500 mt-0.5">Decision-level sensitivity — robust items are identical in all three regimes.</p>
            </div>

            {allRobust && (
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-teal/5 border border-teal/20 text-xs text-teal-dark font-semibold">
                <CheckCircle2 className="w-4 h-4 text-teal shrink-0" />
                <span>Month-1 plan is fully robust — the same origin, charter mode and vessel class is optimal across all three market scenarios.</span>
              </div>
            )}

            <div className="space-y-2">
              {whatChanges.map((line, idx) => (
                <div key={idx}
                  className={`flex items-start space-x-3 p-3 rounded-lg border text-xs font-medium ${
                    line.type === 'robust'  ? 'bg-teal/5 border-teal/20 text-teal-dark' :
                    line.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                  <span className="text-sm leading-none mt-0.5 shrink-0">{line.icon}</span>
                  <span className="leading-relaxed">{line.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Risk card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
              <ShieldAlert className="w-4 h-4 text-amber" />
              <h3 className="text-base font-bold text-navy">Risk Summary</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Cost range */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cost Range</span>
                <div className="flex items-baseline gap-1 mt-1.5 flex-wrap">
                  <span className="text-lg font-bold" style={{ color: PALETTE.teal }}>{fmt(lowCost)}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-lg font-bold" style={{ color: PALETTE.amber }}>{fmt(highCost)}</span>
                </div>
                <div className="text-[10px] text-slate-400 italic mt-0.5">on synthetic demand and prices</div>
              </div>

              {/* Spread */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Spread vs Base</span>
                <div className="text-2xl font-bold text-risk mt-1.5">{fmtPct(spreadPct)}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{fmt(costRange)} tail exposure</div>
              </div>

              {/* Expected cost */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Expected Cost ({weights.low}/{weights.base}/{weights.high})
                </span>
                <div className="text-2xl font-bold text-navy mt-1.5">{fmt(expCost)}</div>
                <div className="text-[10px] text-slate-400 italic mt-0.5">on synthetic demand and prices</div>
              </div>

              {/* Pairwise deltas */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Pairwise Deltas</span>
                {[
                  { label: 'High vs Low',  val: data.cost_differences?.high_vs_low  },
                  { label: 'High vs Base', val: data.cost_differences?.high_vs_base },
                  { label: 'Base vs Low',  val: data.cost_differences?.base_vs_low  },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-xs">
                    <span className="text-slate-500">{row.label}:</span>
                    <span className={`font-bold tabular-nums ${(row.val || 0) >= 0 ? 'text-risk' : 'text-teal'}`}>
                      {row.val != null ? `${row.val >= 0 ? '+' : ''}${(row.val / 1e6).toFixed(1)}M` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Methodology note */}
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start space-x-2 text-xs text-blue-700">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Scenarios correspond to the q10, q50 and q90 bands of the GBM freight-index forecast.
                At horizons beyond 4 weeks the forecast bands narrow and high/low scenarios converge toward the base,
                so this spread likely understates real market risk at longer horizons. Use bands, not point estimates.
              </span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
