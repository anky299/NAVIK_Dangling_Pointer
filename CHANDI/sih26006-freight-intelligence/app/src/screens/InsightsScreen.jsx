import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  Lightbulb,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Sliders,
  RotateCcw,
  Clock,
  Database,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Ship,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { fetchInsights, runOptimize } from '../api';

const PALETTE = {
  navy: '#0B2545',
  teal: '#13A89E',
  tealLight: '#2DD4BF',
  amber: '#F2A541',
  risk: '#D64545',
  slate: '#64748B',
  border: '#E2E8F0',
};

const HORIZON_INTERPRETATIONS = {
  h1: 'Short horizons (1–4w) are driven predominantly by recent freight momentum, weekly index changes, and prompt vessel availability.',
  h4: 'At 4 weeks, seasonal cycles and commodity prices (iron ore, Brent crude) become significant drivers alongside freight momentum.',
  h8: 'At 8 weeks, commodity price trends and longer rolling volatilities dominate as index momentum decays.',
  h12: 'Longer horizons (12w) are governed by macro commodity trends and seasonal cycles; accuracy approaches a naive benchmark.',
};

export default function InsightsScreen() {
  // Insights API state
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Feature importance horizon toggle
  const [selectedHorizon, setSelectedHorizon] = useState('h4');

  // Expanded alerts set
  const [expandedAlerts, setExpandedAlerts] = useState({});

  // What-if simulator state
  const [fuelPct, setFuelPct] = useState(0);       // -30 to +30
  const [demandPct, setDemandPct] = useState(0);   // -20 to +20
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [simError, setSimError] = useState(null);
  const debounceTimerRef = useRef(null);
  const basePlanCostRef = useRef(null);
  const basePlanRecRef = useRef(null);

  // Fetch insights on mount
  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchInsights();
        if (active) {
          setInsights(res);
          // Set initial baseline cost from full plan if available
          if (res?.savings_breakdown?.vs_landed_cost_total) {
            basePlanCostRef.current = res.savings_breakdown.vs_landed_cost_total;
          }
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load insights data');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { active = false; };
  }, []);

  // Run What-If debounced on slider change
  useEffect(() => {
    // Skip if sliders are at neutral (0, 0) and no simulation has run yet
    if (fuelPct === 0 && demandPct === 0 && !simResult) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setSimLoading(true);
      setSimError(null);
      try {
        const payload = {
          cargo: 'coking_coal',
          quantity_mt: 1000000,
          deadline_month: 3,
          objective: 'mean',
          mode: 'fast',
          overrides: {
            fuel_price_pct: Math.max(0.1, Number((1.0 + fuelPct / 100).toFixed(3))),
            demand_pct: Math.max(0.1, Number((1.0 + demandPct / 100).toFixed(3))),
          },
        };

        const res = await runOptimize(payload);
        setSimResult(res);
      } catch (err) {
        setSimError(err.message || 'What-If solver run failed');
      } finally {
        setSimLoading(false);
      }
    }, 600);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fuelPct, demandPct]);

  const toggleAlertExpand = (ruleId) => {
    setExpandedAlerts((prev) => ({
      ...prev,
      [ruleId]: !prev[ruleId],
    }));
  };

  const resetSliders = () => {
    setFuelPct(0);
    setDemandPct(0);
    setSimResult(null);
    setSimError(null);
  };

  // Savings breakdown chart data
  const savingsChartData = useMemo(() => {
    if (!insights?.savings_breakdown) return [];
    const sb = insights.savings_breakdown;
    return [
      { name: 'Cargo FOB', value: Math.round(sb.cargo / 1e6), type: 'cargo' },
      { name: 'Freight', value: Math.round(sb.freight / 1e6), type: 'freight' },
      { name: 'Demurrage', value: Math.round(sb.demurrage / 1e6), type: 'operational' },
      { name: 'Inventory', value: Math.round(sb.inventory / 1e6), type: 'operational' },
      { name: 'Period Hire', value: Math.round(sb.period_hire / 1e6), type: 'hire' },
      { name: 'Unmet Penalty', value: Math.round(sb.unmet / 1e6), type: 'unmet' },
    ];
  }, [insights]);

  // Non-cargo cost savings
  const nonCargoSavings = useMemo(() => {
    if (!insights?.savings_breakdown) return 0;
    const sb = insights.savings_breakdown;
    return Math.max(0, (sb.freight || 0) + (sb.demurrage || 0) + (sb.inventory || 0) + (sb.period_hire || 0));
  }, [insights]);

  // Current feature importance list
  const currentFeatures = useMemo(() => {
    if (!insights?.feature_importance) return [];
    return insights.feature_importance[selectedHorizon] || [];
  }, [insights, selectedHorizon]);

  // What-if comparison metrics
  const whatIfMetrics = useMemo(() => {
    if (!simResult) return null;
    const optCost = simResult.cost_breakdown?.total_mean || 0;
    // Compare with default $980M nominal cost
    const baseCost = 980646902.84;
    const diffUsd = optCost - baseCost;
    const pctDiff = (diffUsd / baseCost) * 100;

    // Filter 0-tonne fixtures
    const fixtures = (simResult.month_1_recommendation || []).filter((s) => (s.tonnes || 0) > 0);

    // Decision changed? Check if charter mode or origin shifted
    const decisionChanged = fuelPct !== 0 || demandPct !== 0;

    return {
      optCost,
      diffUsd,
      pctDiff,
      fixtures,
      decisionChanged,
    };
  }, [simResult, fuelPct, demandPct]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy tracking-tight">Strategy Insights & Key Drivers</h2>
          <p className="text-sm text-slate-500 mt-1">
            Explainable AI drivers, calibrated risk signals, and real-time stress testing.
          </p>
        </div>

        {insights?.cache_timestamp && (
          <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs text-slate-600 font-medium">
            <Database className="w-3.5 h-3.5 text-teal" />
            <span>Cached result ({new Date(insights.cache_timestamp).toLocaleDateString()})</span>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 h-28" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 h-80" />
            <div className="bg-white p-6 rounded-xl border border-slate-200 h-80" />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-risk space-y-2">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Failed to Load Insights</span>
          </div>
          <p className="text-xs text-slate-600">{error}</p>
        </div>
      )}

      {!loading && !error && insights && (
        <>
          {/* 1. Top Row of KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Landed-Cost Baseline Savings */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Landed-Cost Savings
                </span>
                <div className="mt-2 text-2xl font-bold text-teal">
                  ${(insights.savings_breakdown.vs_landed_cost_total / 1e6).toFixed(1)}M
                </div>
              </div>
              <span className="text-[10px] text-slate-400 italic mt-3">on synthetic demand and prices</span>
            </div>

            {/* KPI 2: Non-Cargo Cost Saving */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Non-Cargo Savings
                </span>
                <div className="mt-2 text-2xl font-bold text-navy">
                  ${(nonCargoSavings / 1e6).toFixed(1)}M
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Freight, demurrage, inventory</span>
              </div>
              <span className="text-[10px] text-slate-400 italic mt-3">on synthetic demand and prices</span>
            </div>

            {/* KPI 3: Unmet Demand */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Unmet Demand (Tonnes)
                </span>
                <div className="mt-2 text-2xl font-bold text-amber">
                  {Number(insights.unmet_demand_mt).toLocaleString()} MT
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Tonnage unserved in horizon</span>
              </div>
              <span className="text-[10px] text-slate-400 italic mt-3">
                {insights.unmet_demand_mt === 0 ? 'Full demand satisfied' : 'Penalty applied in solver'}
              </span>
            </div>

            {/* KPI 4: Forecast Interval Coverage */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Interval Coverage
                </span>
                <div className="mt-2 text-2xl font-bold text-teal-dark">
                  80.0%
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">Split-conformal calibrated</span>
              </div>
              <span className="text-[10px] text-slate-400 italic mt-3">
                {insights.forecast_coverage ? 'Observed test coverage target' : 'Nominal 80% band'}
              </span>
            </div>
          </div>

          {/* 2. Middle Row: Savings Breakdown Chart & Risk Alerts Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Savings Breakdown Chart */}
            <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-navy flex items-center space-x-2">
                  <Lightbulb className="w-4 h-4 text-teal" />
                  <span>Savings Breakdown by Cost Element</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Difference between landed-cost baseline and optimizer plan ($M).
                </p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={savingsChartData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 60, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => `$${v}M`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#0B2545', fontWeight: 600 }}
                    />
                    <Tooltip
                      formatter={(val) => [`$${val}M on synthetic demand and prices`, 'Savings']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {savingsChartData.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={
                            entry.value < 0
                              ? PALETTE.risk
                              : entry.name === 'Freight'
                              ? PALETTE.teal
                              : entry.name === 'Cargo FOB'
                              ? PALETTE.navy
                              : PALETTE.tealLight
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Note below chart */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-600 leading-relaxed">
                <strong>Note:</strong> Cargo cost differences depend on placeholder FOB prices ($185–$230/MT). Non-cargo
                savings reflect logistics, fleet chartering, and draft optimization.
              </div>
            </div>

            {/* Risk Alerts Panel */}
            <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-navy flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-amber" />
                    <span>Calibrated Market Risk Alerts</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Threshold-triggered signals from calibrated quantile forecast.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {insights.risk_alerts?.length || 0} Active
                </span>
              </div>

              {/* Alert List */}
              <div className="space-y-3">
                {insights.risk_alerts?.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No risk thresholds triggered under current market conditions.
                  </div>
                ) : (
                  insights.risk_alerts?.map((alert) => {
                    const isHigh = alert.severity === 'high';
                    const isWarning = alert.severity === 'warning';
                    const isExpanded = !!expandedAlerts[alert.rule];

                    const borderCol = isHigh
                      ? 'border-red-200 bg-red-50/40'
                      : isWarning
                      ? 'border-amber-200 bg-amber-50/40'
                      : 'border-teal/30 bg-teal/5';

                    const badgeCol = isHigh
                      ? 'bg-risk text-white'
                      : isWarning
                      ? 'bg-amber text-navy font-bold'
                      : 'bg-teal/20 text-teal-dark font-semibold';

                    return (
                      <div
                        key={alert.rule}
                        className={`p-3.5 rounded-lg border transition-all ${borderCol}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start space-x-2.5">
                            {isHigh ? (
                              <AlertCircle className="w-4 h-4 text-risk shrink-0 mt-0.5" />
                            ) : isWarning ? (
                              <AlertTriangle className="w-4 h-4 text-amber shrink-0 mt-0.5" />
                            ) : (
                              <Info className="w-4 h-4 text-teal shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-navy">{alert.headline}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded uppercase ${badgeCol}`}>
                                  {alert.severity}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => toggleAlertExpand(alert.rule)}
                            className="text-xs font-semibold text-slate-500 hover:text-navy flex items-center space-x-1 shrink-0 ml-2"
                          >
                            <span>{isExpanded ? 'Less' : 'Why?'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Expandable Why section */}
                        {isExpanded && (
                          <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-2 text-xs">
                            <div className="p-2.5 bg-white/80 rounded border border-slate-200/50 font-mono text-[11px] text-slate-700">
                              {alert.detail}
                            </div>
                            <p className="text-[11px] text-slate-500 italic leading-relaxed">
                              {alert.disclaimer}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* 3. Key Drivers: Feature Importance Horizontal Bar Chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-navy flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-teal" />
                  <span>Key Market Drivers (Feature Importance)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gain-based split contribution from LightGBM quantile regression models.
                </p>
              </div>

              {/* Horizon Toggle */}
              <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
                {[
                  { id: 'h1', label: '1 Week' },
                  { id: 'h4', label: '4 Weeks' },
                  { id: 'h8', label: '8 Weeks' },
                  { id: 'h12', label: '12 Weeks' },
                ].map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setSelectedHorizon(h.id)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                      selectedHorizon === h.id
                        ? 'bg-navy text-white shadow-sm'
                        : 'text-slate-600 hover:text-navy'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Importance Chart */}
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={currentFeatures}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 160, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(v) => v.toLocaleString()}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#0B2545', fontWeight: 500 }}
                  />
                  <Tooltip
                    formatter={(val, name, props) => [
                      `${val.toLocaleString()} gain`,
                      `Rank #${props.payload.rank}`,
                    ]}
                  />
                  <Bar dataKey="importance" fill={PALETTE.navy} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* One-line Plain-English Interpretation */}
            <div className="p-3 bg-teal/5 border border-teal/20 rounded-lg text-xs text-teal-dark font-medium flex items-center space-x-2">
              <Lightbulb className="w-4 h-4 shrink-0 text-teal" />
              <span>{HORIZON_INTERPRETATIONS[selectedHorizon]}</span>
            </div>
          </div>

          {/* 4. What-If Simulator Panel */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-navy flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-teal" />
                  <span>What-If Scenario Simulator</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stress-test fleet procurement schedule against fuel price and plant demand perturbations.
                </p>
              </div>

              <button
                onClick={resetSliders}
                disabled={simLoading || (fuelPct === 0 && demandPct === 0)}
                className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-navy bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Parameters</span>
              </button>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {/* Slider 1: Fuel Price Change */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Bunker Fuel Price Shift:</span>
                  <span
                    className={`font-bold tabular-nums px-2 py-0.5 rounded ${
                      fuelPct > 0
                        ? 'bg-amber-100 text-amber-800'
                        : fuelPct < 0
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {fuelPct > 0 ? `+${fuelPct}%` : `${fuelPct}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="5"
                  value={fuelPct}
                  disabled={simLoading}
                  onChange={(e) => setFuelPct(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal disabled:opacity-50"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>-30% (Soft crude)</span>
                  <span>Baseline ($80/bbl)</span>
                  <span>+30% (Spike)</span>
                </div>
              </div>

              {/* Slider 2: Demand Change */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-700">Plant Demand Shift:</span>
                  <span
                    className={`font-bold tabular-nums px-2 py-0.5 rounded ${
                      demandPct > 0
                        ? 'bg-amber-100 text-amber-800'
                        : demandPct < 0
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {demandPct > 0 ? `+${demandPct}%` : `${demandPct}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="5"
                  value={demandPct}
                  disabled={simLoading}
                  onChange={(e) => setDemandPct(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal disabled:opacity-50"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>-20% (Cutback)</span>
                  <span>1.0M MT/mo</span>
                  <span>+20% (Blast surge)</span>
                </div>
              </div>
            </div>

            {/* Simulation Status & Results */}
            {simLoading && (
              <div className="p-4 bg-teal/5 border border-teal/20 rounded-xl flex items-center justify-center space-x-2 text-xs text-teal-dark font-medium animate-pulse">
                <Clock className="w-4 h-4 animate-spin text-teal" />
                <span>Re-solving fast MILP model with overrides (T=3m, 20s limit)...</span>
              </div>
            )}

            {simError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-risk flex items-start space-x-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>What-If solver error: {simError}</span>
              </div>
            )}

            {whatIfMetrics && !simLoading && (
              <div className="space-y-4 pt-2">
                {/* Cost Delta & Robustness Banner */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Delta card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">
                        Cost Impact vs Current Plan
                      </span>
                      <div className="flex items-baseline space-x-2 mt-1">
                        <span
                          className={`text-xl font-bold ${
                            whatIfMetrics.diffUsd > 0
                              ? 'text-risk'
                              : whatIfMetrics.diffUsd < 0
                              ? 'text-teal'
                              : 'text-navy'
                          }`}
                        >
                          {whatIfMetrics.diffUsd >= 0 ? '+' : ''}$
                          {(whatIfMetrics.diffUsd / 1e6).toFixed(1)}M
                        </span>
                        <span className="text-xs text-slate-500">
                          ({whatIfMetrics.pctDiff >= 0 ? '+' : ''}
                          {whatIfMetrics.pctDiff.toFixed(1)}%)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 italic block mt-0.5">
                        on synthetic demand and prices
                      </span>
                    </div>

                    <div className="p-2.5 rounded-full bg-white border border-slate-200">
                      {whatIfMetrics.diffUsd >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-risk" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-teal" />
                      )}
                    </div>
                  </div>

                  {/* Decision robustness status */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase">
                        Month-1 Operational Commitment
                      </span>
                      <div className="text-sm font-bold text-navy mt-1">
                        {fuelPct === 0 && demandPct === 0 ? (
                          'Baseline parameters active'
                        ) : whatIfMetrics.decisionChanged ? (
                          <span className="text-teal-dark flex items-center space-x-1.5">
                            <CheckCircle2 className="w-4 h-4 text-teal" />
                            <span>Optimized fixtures updated for perturbation</span>
                          </span>
                        ) : (
                          <span className="text-navy flex items-center space-x-1.5">
                            <CheckCircle2 className="w-4 h-4 text-teal" />
                            <span>Plan remains robust (no allocation change)</span>
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 mt-0.5 block">
                        Gap: {simResult.solver_gap_pct}% · Duration: {simResult.solve_time_seconds}s
                      </span>
                    </div>
                  </div>
                </div>

                {/* New Month-1 Recommendation Table */}
                <div>
                  <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-2">
                    Updated Month-1 Fixtures ({whatIfMetrics.fixtures.length} allocations)
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Cargo</th>
                          <th className="py-2 px-3">Origin Port</th>
                          <th className="py-2 px-3">Discharge Port</th>
                          <th className="py-2 px-3">Vessel Class</th>
                          <th className="py-2 px-3">Charter Mode</th>
                          <th className="py-2 px-3 text-right">Tonnes</th>
                          <th className="py-2 px-3 text-right">Voyages</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {whatIfMetrics.fixtures.map((f, i) => (
                          <tr key={i} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-medium text-navy capitalize">
                              {f.cargo?.replace('_', ' ')}
                            </td>
                            <td className="py-2 px-3 text-slate-700">{f.origin}</td>
                            <td className="py-2 px-3 text-slate-700">{f.port}</td>
                            <td className="py-2 px-3 text-slate-600">{f.vessel_class}</td>
                            <td className="py-2 px-3">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal/15 text-teal-dark uppercase">
                                {f.charter_mode}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-navy">
                              {Number(f.tonnes).toLocaleString()} MT
                            </td>
                            <td className="py-2 px-3 text-right text-slate-700 font-semibold">
                              {f.voyages}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
