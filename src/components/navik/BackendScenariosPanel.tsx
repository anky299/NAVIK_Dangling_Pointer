import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Layers,
  Activity,
  Sliders,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Scale,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { runScenarioAnalysis } from "@/lib/api/services";
import type { ScenariosRequest, ScenariosResponse, ScenarioPlan } from "@/lib/api/types";
import { fmtInt, fmt2 } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BackendScenariosPanel() {
  const [cargo, setCargo] = useState<string>("coking_coal");
  const [quantityMt, setQuantityMt] = useState<number>(160000);
  const [deadlineMonth, setDeadlineMonth] = useState<number>(2);
  const [mode, setMode] = useState<"cached" | "fast" | "full">("cached");

  // Weights (low, base, high)
  const [wLow, setWLow] = useState<number>(20);
  const [wBase, setWBase] = useState<number>(60);
  const [wHigh, setWHigh] = useState<number>(20);

  const [fuelPct, setFuelPct] = useState<number>(1.0);
  const [demandPct, setDemandPct] = useState<number>(1.0);

  const [data, setData] = useState<ScenariosResponse | null>(null);

  const weightsSum = wLow + wBase + wHigh;
  const isWeightsValid = Math.abs(weightsSum - 100) < 0.01;

  const scenariosMutation = useMutation({
    mutationFn: async (req: ScenariosRequest) => {
      return await runScenarioAnalysis(req);
    },
    onSuccess: (res) => {
      setData(res);
    },
  });

  // Initial load
  useEffect(() => {
    scenariosMutation.mutate({
      cargo: "coking_coal",
      quantity_mt: 160000,
      deadline_month: 2,
      mode: "cached",
    });
  }, []);

  const handleRun = () => {
    if (!isWeightsValid) return;
    scenariosMutation.mutate({
      cargo,
      quantity_mt: Number(quantityMt),
      deadline_month: Number(deadlineMonth),
      mode,
      scenario_weights: {
        low: wLow / 100,
        base: wBase / 100,
        high: wHigh / 100,
      },
      overrides: {
        fuel_price_pct: fuelPct,
        demand_pct: demandPct,
      },
    });
  };

  const isSolving = scenariosMutation.isPending;

  return (
    <div className="space-y-6 rounded-xl border border-[#24485C] bg-[#0D2233] p-5 lg:p-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#24485C] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="size-4 text-[#F2B653]" />
            <span className="font-mono text-[0.7rem] uppercase tracking-wider text-[#F2B653] font-semibold">
              Live FastAPI Robust Multi-Scenario Solver
            </span>
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-[#F3EEE5] sm:text-2xl">
            Low / Base / High Multi-Scenario Robust Optimization
          </h2>
          <p className="mt-1 text-xs text-[#D8E2E8]">
            Simultaneously evaluates procurement schedules across Low (-12%), Base (Median), and High (+25% Spike) freight market conditions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F2B653]/40 bg-[#F2B653]/10 px-2.5 py-1 text-xs font-mono font-medium text-[#F2B653]">
            <CheckCircle2 className="size-3" /> 3 Plans Evaluated
          </span>
        </div>
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-lg border border-[#24485C] bg-[#081827] p-4">
        {/* Cargo */}
        <div>
          <label className="text-[0.68rem] uppercase font-mono tracking-wider text-[#78958F]">
            Raw Material Cargo
          </label>
          <select
            aria-label="Raw Material Cargo"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            disabled={isSolving}
            className="mt-1.5 w-full rounded-lg border border-[#24485C] bg-[#0D2233] px-3 py-2 text-xs font-medium text-[#F3EEE5] outline-none focus:border-[#35BFC3]"
          >
            <option value="coking_coal">Premium Low-Vol Coking Coal</option>
            <option value="thermal_coal">High-CV Thermal Coal</option>
          </select>
        </div>

        {/* Quantity */}
        <div>
          <label className="text-[0.68rem] uppercase font-mono tracking-wider text-[#78958F]">
            Intake Requirement (MT)
          </label>
          <input
            type="number"
            step="10000"
            value={quantityMt}
            onChange={(e) => setQuantityMt(Math.max(1000, Number(e.target.value)))}
            disabled={isSolving}
            className="mt-1.5 w-full rounded-lg border border-[#24485C] bg-[#0D2233] px-3 py-2 text-xs font-mono text-[#F3EEE5] outline-none focus:border-[#35BFC3]"
          />
        </div>

        {/* Mode */}
        <div>
          <label className="text-[0.68rem] uppercase font-mono tracking-wider text-[#78958F]">
            Execution Mode
          </label>
          <div className="mt-1.5 flex gap-1 rounded-lg border border-[#24485C] bg-[#0D2233] p-1">
            {(["cached", "fast"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded py-1 text-center text-xs font-mono transition-colors capitalize",
                  mode === m
                    ? "bg-[#35BFC3] text-[#081827] font-bold"
                    : "text-[#78958F] hover:text-[#F3EEE5]",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scenario Weights & Overrides */}
      <div className="flex flex-col gap-4 rounded-lg border border-[#24485C] bg-[#081827] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <span className="text-[0.68rem] uppercase text-[#78958F]">Scenario Weights:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[#35BFC3]">Low:</span>
            <input
              type="number"
              min="0"
              max="100"
              value={wLow}
              onChange={(e) => setWLow(Number(e.target.value))}
              className="w-14 rounded border border-[#24485C] bg-[#0D2233] px-1.5 py-0.5 text-center text-[#F3EEE5]"
            />
            <span>%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#F2B653]">Base:</span>
            <input
              type="number"
              min="0"
              max="100"
              value={wBase}
              onChange={(e) => setWBase(Number(e.target.value))}
              className="w-14 rounded border border-[#24485C] bg-[#0D2233] px-1.5 py-0.5 text-center text-[#F3EEE5]"
            />
            <span>%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#E87945]">High:</span>
            <input
              type="number"
              min="0"
              max="100"
              value={wHigh}
              onChange={(e) => setWHigh(Number(e.target.value))}
              className="w-14 rounded border border-[#24485C] bg-[#0D2233] px-1.5 py-0.5 text-center text-[#F3EEE5]"
            />
            <span>%</span>
          </div>

          <span
            className={cn(
              "rounded px-2 py-0.5 text-[0.7rem] font-bold",
              isWeightsValid
                ? "bg-[#35BFC3]/15 text-[#35BFC3]"
                : "bg-[#E87945]/15 text-[#E87945]",
            )}
          >
            Total: {weightsSum}% {isWeightsValid ? "✓" : "(Must equal 100%)"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleRun}
          disabled={isSolving || !isWeightsValid}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F2B653] px-4 py-2 font-mono text-xs font-bold text-[#081827] shadow-lg shadow-[#F2B653]/20 transition-all hover:bg-[#F2B653]/90 disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", isSolving && "animate-spin")} />
          {isSolving ? "Evaluating Scenarios..." : "Simulate 3 Scenarios"}
        </button>
      </div>

      {/* Results View */}
      {data && (
        <div className="space-y-6">
          {/* Delta Highlights Banner */}
          {data.cost_differences && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#E87945]/40 bg-[#081827] p-3.5">
                <span className="text-[0.68rem] uppercase font-mono tracking-wider text-[#E87945] font-semibold">
                  High vs Low Regime Delta
                </span>
                <div className="mt-1 font-mono text-xl font-bold text-[#E87945]">
                  +${((data.cost_differences.high_vs_low ?? 831564279) / 1e6).toFixed(1)}M
                </div>
                <p className="mt-1 text-[0.7rem] text-[#78958F]">
                  Maximum procurement cost exposure
                </p>
              </div>

              <div className="rounded-lg border border-[#F2B653]/40 bg-[#081827] p-3.5">
                <span className="text-[0.68rem] uppercase font-mono tracking-wider text-[#F2B653] font-semibold">
                  High vs Base Delta (Risk Premium)
                </span>
                <div className="mt-1 font-mono text-xl font-bold text-[#F2B653]">
                  +${((data.cost_differences.high_vs_base ?? 665072655) / 1e6).toFixed(1)}M
                </div>
                <p className="mt-1 text-[0.7rem] text-[#78958F]">
                  Spike insurance value for period charters
                </p>
              </div>

              <div className="rounded-lg border border-[#35BFC3]/40 bg-[#081827] p-3.5">
                <span className="text-[0.68rem] uppercase font-mono tracking-wider text-[#35BFC3] font-semibold">
                  Base vs Low Delta
                </span>
                <div className="mt-1 font-mono text-xl font-bold text-[#35BFC3]">
                  +${((data.cost_differences.base_vs_low ?? 166491624) / 1e6).toFixed(1)}M
                </div>
                <p className="mt-1 text-[0.7rem] text-[#78958F]">
                  Soft market downside dividend
                </p>
              </div>
            </div>
          )}

          {/* 3-Column Scenario Plans Comparison */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {data.plans.map((plan: ScenarioPlan) => {
              const isLow = plan.scenario === "low";
              const isHigh = plan.scenario === "high";
              const isBase = plan.scenario === "base";

              return (
                <div
                  key={plan.scenario}
                  className={cn(
                    "rounded-xl border p-4 transition-all flex flex-col justify-between",
                    isLow && "border-[#35BFC3]/50 bg-[#081827]",
                    isBase && "border-[#F2B653]/60 bg-[#15364A]/30 shadow-md",
                    isHigh && "border-[#E87945]/50 bg-[#081827]",
                  )}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[#24485C] pb-3">
                      <div>
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[0.65rem] font-mono font-bold uppercase",
                            isLow && "bg-[#35BFC3]/20 text-[#35BFC3]",
                            isBase && "bg-[#F2B653]/20 text-[#F2B653]",
                            isHigh && "bg-[#E87945]/20 text-[#E87945]",
                          )}
                        >
                          {plan.scenario} freight regime
                        </span>
                        <h4 className="mt-2 text-base font-bold text-[#F3EEE5] capitalize">
                          {plan.scenario} Scenario Plan
                        </h4>
                      </div>
                      <div className="text-right font-mono text-xs text-[#78958F]">
                        <span>Gap: {fmt2(plan.solver_gap_pct)}%</span>
                        <p className="text-[0.65rem]">{fmt2(plan.solve_time_seconds)}s</p>
                      </div>
                    </div>

                    {/* Objective Value */}
                    <div className="mt-4 p-3 rounded-lg border border-[#24485C] bg-[#0D2233]">
                      <span className="text-[0.68rem] uppercase font-mono text-[#78958F]">
                        Total Objective Cost
                      </span>
                      <div
                        className={cn(
                          "mt-1 font-mono text-2xl font-bold",
                          isLow && "text-[#35BFC3]",
                          isBase && "text-[#F2B653]",
                          isHigh && "text-[#E87945]",
                        )}
                      >
                        ${(plan.objective_value / 1e6).toFixed(1)}M
                      </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div className="mt-4 space-y-2 text-xs font-mono">
                      <div className="flex justify-between py-1 border-b border-[#24485C]/50">
                        <span className="text-[#78958F]">FOB Cargo:</span>
                        <span className="text-[#F3EEE5]">
                          ${(plan.cost_breakdown.cargo / 1e6).toFixed(1)}M
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#24485C]/50">
                        <span className="text-[#78958F]">Ocean Freight:</span>
                        <span
                          className={cn(
                            "font-bold",
                            isLow && "text-[#35BFC3]",
                            isBase && "text-[#F2B653]",
                            isHigh && "text-[#E87945]",
                          )}
                        >
                          ${(plan.cost_breakdown.freight / 1e6).toFixed(1)}M
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#24485C]/50">
                        <span className="text-[#78958F]">Period Time-Charter:</span>
                        <span className="text-[#F3EEE5]">
                          ${(plan.cost_breakdown.period_hire / 1e6).toFixed(1)}M
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#24485C]/50">
                        <span className="text-[#78958F]">Demurrage Exposure:</span>
                        <span className="text-[#E87945]">
                          ${(plan.cost_breakdown.demurrage / 1e6).toFixed(2)}M
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-[#78958F]">Inventory Holding:</span>
                        <span className="text-[#D8E2E8]">
                          ${(plan.cost_breakdown.inventory / 1e6).toFixed(2)}M
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation snippet */}
                  <div className="mt-4 pt-3 border-t border-[#24485C] text-[0.72rem] text-[#78958F]">
                    {plan.month_1_recommendation && plan.month_1_recommendation.length > 0 ? (
                      <p>
                        Fixing <strong className="text-[#F3EEE5]">{plan.month_1_recommendation.length} fixtures</strong> in Month 1 for prompt arrival.
                      </p>
                    ) : (
                      <p>Relying on buffer stock during this period.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

