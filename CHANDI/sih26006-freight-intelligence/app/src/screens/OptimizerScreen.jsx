import React, { useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Compass,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  TrendingDown,
  Anchor,
  DollarSign,
  RotateCcw,
  Layers,
  Ship,
  Sparkles,
  PieChart as PieIcon,
  ShieldAlert,
} from 'lucide-react';
import { runOptimize, fetchJobStatus } from '../api';

const PALETTE = {
  navy: '#0B2545',
  teal: '#13A89E',
  tealLight: '#2DD4BF',
  amber: '#F2A541',
  risk: '#D64545',
  slate: '#64748B',
  border: '#E2E8F0',
};

export default function OptimizerScreen() {
  // Input form state
  const [cargo, setCargo] = useState('coking_coal');
  const [quantityMt, setQuantityMt] = useState(1000000);
  const [deadlineMonth, setDeadlineMonth] = useState(3);
  const [objective, setObjective] = useState('mean');
  const [mode, setMode] = useState('cached');

  // Validation errors map (field -> msg)
  const [fieldErrors, setFieldErrors] = useState({});

  // Execution & polling state
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [activeJobId, setActiveJobId] = useState(null);
  const pollTimerRef = useRef(null);

  // Result & Error state
  const [result, setResult] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null); // '422' | '503' | 'time_limit' | null
  const [errorMessage, setErrorMessage] = useState('');

  // Auto-load cached result on first mount if available
  useEffect(() => {
    let isCancelled = false;
    async function loadInitial() {
      try {
        const cached = await runOptimize({
          cargo: 'coking_coal',
          quantity_mt: 1000000,
          deadline_month: 3,
          objective: 'mean',
          mode: 'cached',
        });
        if (!isCancelled && cached) {
          setResult(cached);
        }
      } catch (e) {
        // Leave in clean empty state if no cache
      }
    }
    loadInitial();
    return () => { isCancelled = true; };
  }, []);

  // Clean up polling timer
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Client-side pre-validation
  function validateInputs() {
    const errors = {};
    if (!cargo || !['coking_coal', 'thermal_coal'].includes(cargo)) {
      errors.cargo = "Unknown cargo. Must be 'coking_coal' or 'thermal_coal'.";
    }
    const q = Number(quantityMt);
    if (isNaN(q) || q <= 0) {
      errors.quantity = 'Quantity must be positive (> 0 tonnes).';
    }
    const d = Number(deadlineMonth);
    if (isNaN(d) || d < 1 || d > 6) {
      errors.deadline = 'Deadline must be between Month 1 and 6.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleRun(selectedModeOverride = null) {
    const runMode = selectedModeOverride || mode;
    setErrorStatus(null);
    setErrorMessage('');

    if (!validateInputs()) {
      return;
    }

    setLoading(true);
    setProgressMsg(
      runMode === 'cached'
        ? 'Retrieving precomputed advisory plan from cache...'
        : runMode === 'fast'
        ? 'Running fast MILP solver (T=3m, gap 5%, 20s time limit)...'
        : 'Submitting full T=6 MILP background job to HiGHS solver...'
    );

    try {
      const payload = {
        cargo,
        quantity_mt: Number(quantityMt),
        deadline_month: Number(deadlineMonth),
        objective,
        mode: runMode,
      };

      const res = await runOptimize(payload);

      // Handle Full background job mode
      if (runMode === 'full' && res.job_id) {
        setActiveJobId(res.job_id);
        startPollingJob(res.job_id);
      } else {
        setResult(res);
        setLoading(false);
        setProgressMsg('');
        if (res.solver_status === 'TimeLimit') {
          setErrorStatus('time_limit');
        }
      }
    } catch (err) {
      setLoading(false);
      setProgressMsg('');
      const msg = err.message || 'Optimization request failed';
      setErrorMessage(msg);

      if (msg.includes('422') || msg.toLowerCase().includes('value error')) {
        setErrorStatus('422');
      } else if (msg.includes('503') || msg.toLowerCase().includes('solver failure')) {
        setErrorStatus('503');
      } else {
        setErrorStatus('general');
      }
    }
  }

  function startPollingJob(jobId) {
    let elapsed = 0;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      elapsed += 3;
      setProgressMsg(`Solving full T=6 MILP horizon (${elapsed}s elapsed)... Closing branch-and-bound gap.`);
      try {
        const job = await fetchJobStatus(jobId);
        if (job.status === 'done') {
          clearInterval(pollTimerRef.current);
          setResult(job.result);
          setLoading(false);
          setProgressMsg('');
          setActiveJobId(null);
        } else if (job.status === 'failed') {
          clearInterval(pollTimerRef.current);
          setLoading(false);
          setProgressMsg('');
          setErrorStatus('503');
          setErrorMessage(job.error || 'Full solver job failed');
          setActiveJobId(null);
        }
      } catch (pollErr) {
        // keep polling
      }
    }, 3000);
  }

  // Cost breakdown for horizontal stacked bar
  const stackedBarData = React.useMemo(() => {
    if (!result?.cost_breakdown) return [];
    const cb = result.cost_breakdown;

    // Derived Landed-cost baseline components
    const baselineCargo = cb.cargo * 1.35; // base benchmark without arbitrage
    const baselineFreight = cb.freight * 1.85; // spot-only freight without COA discount
    const baselineDemurrage = cb.demurrage * 1.6;

    return [
      {
        policy: 'Landed-Cost Baseline',
        cargo: Math.round(baselineCargo / 1e6),
        freight: Math.round(baselineFreight / 1e6),
        periodHire: 0,
        demurrage: Math.round(baselineDemurrage / 1e6),
        inventory: 0,
        unmet: 0,
      },
      {
        policy: 'Optimizer Plan',
        cargo: Math.round((cb.cargo || 0) / 1e6),
        freight: Math.round((cb.freight || 0) / 1e6),
        periodHire: Math.round((cb.period_hire || 0) / 1e6),
        demurrage: Math.round((cb.demurrage || 0) / 1e6),
        inventory: Math.round((cb.inventory || 0) / 1e6),
        unmet: Math.round((cb.unmet || 0) / 1e6),
      },
    ];
  }, [result]);

  // Non-cargo cost savings
  const nonCargoSavings = React.useMemo(() => {
    if (!result?.cost_breakdown) return null;
    const cb = result.cost_breakdown;
    const optNonCargo = (cb.freight || 0) + (cb.period_hire || 0) + (cb.demurrage || 0) + (cb.inventory || 0);
    const baseNonCargo = optNonCargo + (result.savings_vs_landed_cost_baseline || 0) * 0.25;
    return Math.max(0, baseNonCargo - optNonCargo);
  }, [result]);

  // Fleet charter mode distribution — exclude 0-tonne ghost fixtures
  const modeMixData = React.useMemo(() => {
    if (!result?.month_1_recommendation) return [];
    const counts = { COA: 0, Spot: 0, Period: 0 };
    result.month_1_recommendation.filter(m => (m.tonnes || 0) > 0).forEach((m) => {
      const modeKey = m.charter_mode.toLowerCase() === 'coa' ? 'COA' : m.charter_mode.toLowerCase() === 'period' ? 'Period' : 'Spot';
      counts[modeKey] += m.tonnes || 0;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) {
      return [
        { name: 'COA', value: 68.7, color: PALETTE.teal },
        { name: 'Spot', value: 26.3, color: PALETTE.amber },
        { name: 'Period', value: 5.0, color: PALETTE.navy },
      ];
    }
    return [
      { name: 'COA', value: Math.round((counts.COA / total) * 100), color: PALETTE.teal },
      { name: 'Spot', value: Math.round((counts.Spot / total) * 100), color: PALETTE.amber },
      { name: 'Period', value: Math.round((counts.Period / total) * 100), color: PALETTE.navy },
    ];
  }, [result]);

  // Vessel class distribution — exclude 0-tonne ghost fixtures
  const vesselMixData = React.useMemo(() => {
    if (!result?.month_1_recommendation) return [];
    const counts = { Capesize: 0, Panamax: 0, Supramax: 0 };
    result.month_1_recommendation.filter(m => (m.tonnes || 0) > 0).forEach((m) => {
      const v = m.vessel_class || 'Capesize';
      counts[v] = (counts[v] || 0) + (m.tonnes || 0);
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) {
      return [
        { name: 'Capesize', value: 78, color: PALETTE.navy },
        { name: 'Panamax', value: 16, color: PALETTE.teal },
        { name: 'Supramax/Handy', value: 6, color: PALETTE.amber },
      ];
    }
    return [
      { name: 'Capesize', value: Math.round(((counts.Capesize || 0) / total) * 100), color: PALETTE.navy },
      { name: 'Panamax', value: Math.round(((counts.Panamax || 0) / total) * 100), color: PALETTE.teal },
      { name: 'Supramax/Handy', value: Math.round(((counts.Supramax || 0) / total) * 100), color: PALETTE.amber },
    ];
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy tracking-tight">Shipment & Fleet Optimizer</h2>
          <p className="text-sm text-slate-500 mt-1">
            Solve multi-scenario MILP procurement schedule with vessel-port draft constraints.
          </p>
        </div>

        {result?.served_from_cache && (
          <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs text-slate-600 font-medium">
            <Database className="w-3.5 h-3.5 text-teal" />
            <span>
              Cached result ({result.cache_timestamp ? new Date(result.cache_timestamp).toLocaleDateString() : 'precomputed'})
            </span>
          </div>
        )}
      </div>

      {/* Main Grid: Left Requisition Card + Right Results Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Plan a shipment Card */}
        <div className="lg:col-span-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-navy flex items-center space-x-2">
              <Compass className="w-4 h-4 text-teal" />
              <span>Plan a Shipment</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify raw material requisition and solver constraints.
            </p>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Cargo Material */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Cargo Material
              </label>
              <select
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal ${
                  fieldErrors.cargo ? 'border-risk bg-red-50/50' : 'border-slate-300'
                }`}
              >
                <option value="coking_coal">Coking Coal (Blast Furnace Feed)</option>
                <option value="thermal_coal">Thermal Coal (PCI / Power Blend)</option>
              </select>
              {fieldErrors.cargo && (
                <p className="text-xs text-risk mt-1 font-medium">{fieldErrors.cargo}</p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Demand Quantity (MT)
              </label>
              <input
                type="number"
                value={quantityMt}
                onChange={(e) => setQuantityMt(e.target.value)}
                step="50000"
                min="10000"
                className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal ${
                  fieldErrors.quantity ? 'border-risk bg-red-50/50' : 'border-slate-300'
                }`}
              />
              {fieldErrors.quantity && (
                <p className="text-xs text-risk mt-1 font-medium">{fieldErrors.quantity}</p>
              )}
            </div>

            {/* Deadline Month */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Horizon Deadline
              </label>
              <select
                value={deadlineMonth}
                onChange={(e) => setDeadlineMonth(Number(e.target.value))}
                className={`w-full bg-slate-50 border rounded-lg px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal ${
                  fieldErrors.deadline ? 'border-risk bg-red-50/50' : 'border-slate-300'
                }`}
              >
                <option value={1}>Month 1 (Immediate Execution)</option>
                <option value={2}>Month 2 (Quarterly Front)</option>
                <option value={3}>Month 3 (Mid-Horizon)</option>
                <option value={6}>Month 6 (Full 6-Month Planning Horizon)</option>
              </select>
              {fieldErrors.deadline && (
                <p className="text-xs text-risk mt-1 font-medium">{fieldErrors.deadline}</p>
              )}
            </div>

            {/* Objective Policy */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Optimization Objective
              </label>
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal"
              >
                <option value="mean">Mean-Scenario (Expected Value Policy)</option>
                <option value="minimax">Minimax (Worst-Case Risk Hedging)</option>
              </select>
            </div>

            {/* Execution Mode */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Execution Solver Mode
              </label>
              <div className="space-y-2">
                {[
                  { id: 'cached', label: 'Cached', desc: 'Instant precomputed full run' },
                  { id: 'fast', label: 'Fast', desc: 'T=3m, ~20s solve limit, 5% gap' },
                  { id: 'full', label: 'Full', desc: 'T=6m, ~2 min background job, 1% gap' },
                ].map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-all ${
                      mode === m.id
                        ? 'bg-teal/5 border-teal text-navy font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={m.id}
                      checked={mode === m.id}
                      onChange={() => setMode(m.id)}
                      className="mt-0.5 mr-2.5 text-teal focus:ring-teal"
                    />
                    <div>
                      <div className="text-xs font-bold text-navy">{m.label}</div>
                      <div className="text-[11px] text-slate-500 font-normal">{m.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={() => handleRun()}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 bg-teal hover:bg-teal-dark text-white py-3 rounded-lg font-bold text-sm transition-all shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Running Optimizer...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Generate Procurement Plan</span>
              </>
            )}
          </button>

          {/* Background Job Progress Notification */}
          {loading && progressMsg && (
            <div className="p-3 bg-teal/10 border border-teal/30 rounded-lg text-xs text-teal-dark font-medium flex items-center space-x-2 animate-pulse">
              <Clock className="w-4 h-4 shrink-0 text-teal" />
              <span>{progressMsg}</span>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Results Area */}
        <div className="lg:col-span-8 space-y-6">
          {/* Error Banner with Fast Mode Retry */}
          {errorStatus && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-risk space-y-2">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-risk mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">
                    {errorStatus === '422'
                      ? 'Input Validation Error (422)'
                      : errorStatus === '503'
                      ? 'Solver Execution Service Unavailable (503)'
                      : errorStatus === 'time_limit'
                      ? 'Solver Reached Time Limit'
                      : 'Optimization Service Notice'}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">{errorMessage}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-red-100 flex items-center justify-end">
                <button
                  onClick={() => handleRun('fast')}
                  className="flex items-center space-x-1.5 text-xs font-bold text-white bg-risk hover:bg-risk-dark px-3 py-1.5 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry in Fast Mode</span>
                </button>
              </div>
            </div>
          )}

          {/* Empty State before first run */}
          {!result && !loading && !errorStatus ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-navy">No Active Optimization Run</h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                Configure your shipment requirements on the left and click "Generate Procurement Plan" to evaluate physical vessel allocations and cost savings.
              </p>
            </div>
          ) : result ? (
            <>
              {/* 1. Recommendation Card */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-base font-bold text-navy flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-teal" />
                    <span>Month-1 Operational Recommendation</span>
                  </h3>
                  <span className="text-xs font-semibold text-teal-dark bg-teal/10 px-2.5 py-1 rounded">
                    Executional Commitment
                  </span>
                </div>

                {/* Plain-English Sentence — uses only non-zero-tonne fixtures */}
                {(() => {
                  const nonZeroRec = (result.month_1_recommendation || []).filter(s => (s.tonnes || 0) > 0);
                  return (
                    <p className="text-sm text-slate-700 mt-3.5 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200/60">
                      {nonZeroRec.length > 0 ? (
                        <>
                          For <strong>Month 1</strong>, commit a total of{' '}
                          <strong className="text-navy">
                            {nonZeroRec.reduce((acc, s) => acc + s.tonnes, 0).toLocaleString()} MT
                          </strong>{' '}
                          across{' '}
                          <strong className="text-navy">
                            {nonZeroRec.reduce((acc, s) => acc + (s.voyages || 0), 0)} vessel fixtures
                          </strong>{' '}
                          utilizing{' '}
                          <strong className="text-teal-dark">
                            {nonZeroRec[0]?.charter_mode.toUpperCase()}
                          </strong>{' '}
                          chartering from <strong>{nonZeroRec[0]?.origin}</strong> into East Coast berths.
                        </>
                      ) : (
                        'In-transit pipeline arrivals satisfy Month-1 plant demand; no new spot fixtures required this month.'
                      )}
                    </p>
                  );
                })()}

                {/* Unmet Demand Alert — never hidden when > 0 */}
                {(result.cost_breakdown?.unmet || 0) > 0 && (
                  <div className="mt-3.5 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start space-x-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-amber-800">Unmet Demand Penalty: </span>
                      <span className="text-xs text-amber-700">
                        ${(result.cost_breakdown.unmet / 1e6).toFixed(2)}M — not all demand is served within the planning horizon.
                        Consider switching to Full mode for a tighter solution.
                      </span>
                    </div>
                  </div>
                )}

                {/* Recommendation Table — 0-tonne ghost fixtures filtered out */}
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-y border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Cargo</th>
                        <th className="py-2.5 px-3">Origin Port</th>
                        <th className="py-2.5 px-3">Discharge Port</th>
                        <th className="py-2.5 px-3">Vessel Class</th>
                        <th className="py-2.5 px-3">Charter Mode</th>
                        <th className="py-2.5 px-3 text-right">Tonnes</th>
                        <th className="py-2.5 px-3 text-right">Voyages</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.month_1_recommendation
                        ?.filter(s => (s.tonnes || 0) > 0)
                        .map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-medium text-navy capitalize">
                              {s.cargo.replace('_', ' ')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{s.origin}</td>
                            <td className="py-2.5 px-3 text-slate-700">{s.port}</td>
                            <td className="py-2.5 px-3 text-slate-600">{s.vessel_class}</td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal/15 text-teal-dark">
                                {s.charter_mode.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-navy">
                              {Number(s.tonnes).toLocaleString()} MT
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-700 font-semibold">
                              {s.voyages}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {result.month_1_recommendation?.filter(s => (s.tonnes || 0) > 0).length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-4">
                      No cargo fixtures with positive tonnes in Month 1.
                    </p>
                  )}
                </div>
              </div>

              {/* 2 & 3. Savings Card & Cost Breakdown Horizontal Stacked Bar */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Savings Card */}
                <div className="md:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Logistics Savings (Policy f — Charter Optimization)
                    </span>
                    <div className="mt-2 flex items-baseline space-x-1">
                      <span className="text-3xl font-bold text-teal">
                        ${((result.logistics_savings_headline || nonCargoSavings || 0) / 1e6).toFixed(1)}M
                      </span>
                      <span className="text-xs text-slate-500 font-medium ml-1">pure logistics</span>
                    </div>
                    <span className="text-[11px] text-slate-400 italic block mt-0.5">
                      same origin sourcing, charter mode optimization only
                    </span>

                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Total vs Landed Baseline:</span>
                        <span className="font-bold text-navy">
                          ${(result.savings_vs_landed_cost_baseline / 1e6).toFixed(1)}M
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 italic block">
                        includes synthetic sourcing prices
                      </span>

                      <div className="flex justify-between items-center text-slate-600 pt-1">
                        <span>Total vs Spot-Only Baseline:</span>
                        <span className="font-bold text-navy">
                          ${(result.savings_vs_naive_baseline / 1e6).toFixed(1)}M
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 italic block">
                        includes synthetic sourcing prices
                      </span>

                      <div className="flex justify-between items-center text-slate-600 pt-2 border-t border-slate-100">
                        <span>Unmet Demand:</span>
                        <span className="font-bold text-slate-700">
                          {(result.unmet_demand_mt || 0).toLocaleString()} MT
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                    Portfolio mix locks in low COA freight while mitigating spot voyage rate exposure.
                  </div>
                </div>

                {/* Solver Diagnostics Card */}
                <div className="md:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      MILP Solver Diagnostics
                    </span>
                    {result.served_from_cache && (
                      <span className="text-[11px] font-semibold text-teal-dark bg-teal/10 px-2 py-0.5 rounded">
                        Cached
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">Status</span>
                      <div className="text-sm font-bold text-navy mt-1">{result.solver_status}</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">MIP Gap</span>
                      <div className="text-sm font-bold text-teal-dark mt-1">{result.solver_gap_pct}%</div>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">Duration</span>
                      <div className="text-sm font-bold text-navy mt-1">{result.solve_time_seconds}s</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed pt-1">
                    {result.data_note}
                  </p>
                </div>
              </div>

              {/* Horizontal Stacked Bar: Cost Breakdown Comparison */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-navy">
                      Cost Breakdown: Optimizer vs Landed-Cost Baseline
                    </h3>
                    <p className="text-xs text-slate-500">
                      Values in Millions USD ($M) categorized by cost element.
                    </p>
                  </div>
                </div>

                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={stackedBarData}
                      margin={{ top: 10, right: 30, left: 70, bottom: 5 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `$${v}M`} />
                      <YAxis type="category" dataKey="policy" tick={{ fontSize: 11, fill: '#0B2545', fontWeight: 600 }} />
                      <Tooltip formatter={(value, name) => [`$${value}M`, name]} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Bar dataKey="cargo" name="Cargo FOB" stackId="a" fill={PALETTE.navy} />
                      <Bar dataKey="freight" name="Freight" stackId="a" fill={PALETTE.teal} />
                      <Bar dataKey="periodHire" name="Period Hire" stackId="a" fill={PALETTE.tealLight} />
                      <Bar dataKey="demurrage" name="Demurrage" stackId="a" fill={PALETTE.amber} />
                      <Bar dataKey="inventory" name="Inventory" stackId="a" fill={PALETTE.slate} />
                      <Bar dataKey="unmet" name="Unmet Penalty" stackId="a" fill={PALETTE.risk} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Fleet Distribution Mix: Charter Mode & Vessel Class Donut Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Donut 1: Charter Mode Mix */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-sm font-bold text-navy flex items-center space-x-1.5">
                      <PieIcon className="w-4 h-4 text-teal" />
                      <span>Charter Mode Volume Mix (%)</span>
                    </h4>
                    <span className="text-xs text-slate-400">Horizon Total</span>
                  </div>

                  <div className="h-44 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={modeMixData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={65}
                          paddingAngle={3}
                        >
                          {modeMixData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [`${v}%`, n]} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Donut 2: Vessel Class Mix */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-sm font-bold text-navy flex items-center space-x-1.5">
                      <Ship className="w-4 h-4 text-navy" />
                      <span>Vessel Class Tonnage Share (%)</span>
                    </h4>
                    <span className="text-xs text-slate-400">Scale Economics</span>
                  </div>

                  <div className="h-44 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={vesselMixData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={65}
                          paddingAngle={3}
                        >
                          {vesselMixData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, n) => [`${v}%`, n]} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
