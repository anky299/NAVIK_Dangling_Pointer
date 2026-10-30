import { useState, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  LineChart as LineChartIcon,
  BarChart3,
  Filter,
  Layers,
  Route,
  Shield,
  Clock,
  Info,
} from "lucide-react";
import type {
  CoverageClause,
  InsuranceAnalyticsBundle,
  InsuranceCommodity,
} from "@/lib/api/insurance-types";
import { ORIGINS, PORTS } from "@/lib/api/reference";
import { SUPPORTED_COMMODITIES, COVERAGE_CLAUSES } from "@/lib/sim/insurance";
import { BentoCard } from "@/components/navik/Bento";
import { AXIS, GRID, TooltipCard } from "@/components/navik/charts";
import { fmtShortDate } from "@/lib/format";

interface InsuranceAnalyticsSectionProps {
  analytics?: InsuranceAnalyticsBundle;
  isLoading?: boolean;
}

export function InsuranceAnalyticsSection({
  analytics,
  isLoading,
}: InsuranceAnalyticsSectionProps) {
  // Chart Filters
  const [filterCommodity, setFilterCommodity] = useState<InsuranceCommodity | "ALL">("ALL");
  const [filterClause, setFilterClause] = useState<CoverageClause | "ALL">("ALL");
  const [activeTab, setActiveTab] = useState<"trends" | "commodities" | "routes" | "clauses">(
    "trends",
  );

  // Filtered Trend Points
  const trendData = useMemo(() => {
    if (!analytics?.trendSeries) return [];
    return analytics.trendSeries.filter((p) => {
      if (filterCommodity !== "ALL" && p.commodity !== filterCommodity) return false;
      if (filterClause !== "ALL" && p.clause !== filterClause) return false;
      return true;
    });
  }, [analytics?.trendSeries, filterCommodity, filterClause]);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#24485C] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#F3EEE5] flex items-center gap-2">
            <LineChartIcon className="size-5 text-[#F2B653]" />
            <span>Historical Rate Analytics</span>
          </h2>
          <p className="text-xs text-[#78958F] mt-0.5">
            Empirical marine cargo insurance rate behavior, commodity spreads, and route differentials.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center rounded-lg bg-[#0D2233] p-1 border border-[#24485C]">
          <button
            type="button"
            onClick={() => setActiveTab("trends")}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              activeTab === "trends"
                ? "bg-[#15364A] text-[#35BFC3] shadow-sm"
                : "text-[#D8E2E8]/70 hover:text-[#F3EEE5]"
            }`}
          >
            Rate Trend
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("commodities")}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              activeTab === "commodities"
                ? "bg-[#15364A] text-[#35BFC3] shadow-sm"
                : "text-[#D8E2E8]/70 hover:text-[#F3EEE5]"
            }`}
          >
            Commodities
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("routes")}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              activeTab === "routes"
                ? "bg-[#15364A] text-[#35BFC3] shadow-sm"
                : "text-[#D8E2E8]/70 hover:text-[#F3EEE5]"
            }`}
          >
            Corridors
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("clauses")}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              activeTab === "clauses"
                ? "bg-[#15364A] text-[#35BFC3] shadow-sm"
                : "text-[#D8E2E8]/70 hover:text-[#F3EEE5]"
            }`}
          >
            Coverage Clauses
          </button>
        </div>
      </div>

      {/* TAB 1: Rate Trend Time-Series Chart */}
      {activeTab === "trends" && (
        <BentoCard glowColor="teal" className="p-5 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24485C] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#F3EEE5] flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#35BFC3]" />
                <span>Historical Marine Cargo Insurance Rate (%) Over Time</span>
              </h3>
              <p className="text-xs text-[#78958F]">
                Verified quotation rates plotted chronologically by quotation slip date.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Commodity filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-[#78958F]">Commodity:</span>
                <select
                  value={filterCommodity}
                  onChange={(e) => setFilterCommodity(e.target.value as InsuranceCommodity | "ALL")}
                  className="h-8 rounded bg-[#081827] border border-[#24485C] px-2 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3]"
                >
                  <option value="ALL">All Commodities</option>
                  {SUPPORTED_COMMODITIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label.split(" (")[0]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clause filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-[#78958F]">Clause:</span>
                <select
                  value={filterClause}
                  onChange={(e) => setFilterClause(e.target.value as CoverageClause | "ALL")}
                  className="h-8 rounded bg-[#081827] border border-[#24485C] px-2 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3]"
                >
                  <option value="ALL">All Clauses</option>
                  <option value="ICC_A">ICC (A) All Risks</option>
                  <option value="ICC_B">ICC (B) Named Perils</option>
                  <option value="ICC_C">ICC (C) Basic Perils</option>
                </select>
              </div>
            </div>
          </div>

          {/* Recharts Chart */}
          <div className="h-[320px] w-full pt-2">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#35BFC3" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#35BFC3" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...GRID} stroke="#24485C" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    {...AXIS}
                    tickFormatter={(v) => fmtShortDate(v)}
                    tickMargin={8}
                  />
                  <YAxis
                    {...AXIS}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => `${Number(v).toFixed(3)}%`}
                    tickMargin={8}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const pt = payload[0].payload;
                      return (
                        <TooltipCard
                          title={`${pt.commodityLabel}`}
                          rows={[
                            { label: "Record Date", value: fmtShortDate(pt.date) },
                            {
                              label: "Historical Rate",
                              value: `${pt.ratePct.toFixed(3)}%`,
                              color: "#35BFC3",
                            },
                            { label: "Corridor", value: `${pt.originLabel} → ${pt.destinationLabel}` },
                            { label: "Coverage Clause", value: pt.clause.replace("_", " ") },
                          ]}
                        />
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ratePct"
                    stroke="#35BFC3"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#rateGradient)"
                    dot={{ fill: "#35BFC3", r: 4, stroke: "#081827", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#F2B653" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#78958F] font-mono">
                No historical records match the selected filter combination.
              </div>
            )}
          </div>
        </BentoCard>
      )}

      {/* TAB 2: Commodity Comparisons */}
      {activeTab === "commodities" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BentoCard glowColor="amber" className="p-5 space-y-4">
            <div className="border-b border-[#24485C] pb-3">
              <h3 className="text-sm font-semibold text-[#F3EEE5] flex items-center gap-2">
                <BarChart3 className="size-4 text-[#F2B653]" />
                <span>Commodity Historical Rate Benchmarks</span>
              </h3>
              <p className="text-xs text-[#78958F]">
                Average historical rate percentages across verified dry-bulk commodities.
              </p>
            </div>

            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analytics?.commodityComparisons || []}
                  margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                >
                  <CartesianGrid {...GRID} stroke="#24485C" strokeDasharray="3 3" />
                  <XAxis dataKey="label" {...AXIS} tickMargin={6} />
                  <YAxis
                    {...AXIS}
                    domain={[0, 0.22]}
                    tickFormatter={(v) => `${Number(v).toFixed(2)}%`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const c = payload[0].payload;
                      return (
                        <TooltipCard
                          title={c.label}
                          rows={[
                            { label: "Average Rate", value: `${c.avgRatePct.toFixed(3)}%`, color: "#F2B653" },
                            { label: "Rate Range", value: `${c.minRatePct.toFixed(3)}% – ${c.maxRatePct.toFixed(3)}%` },
                            { label: "Sampled Slips", value: `${c.recordCount} verified` },
                          ]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="avgRatePct" radius={[4, 4, 0, 0]} fill="#F2B653" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </BentoCard>

          {/* Commodity Details Table */}
          <BentoCard glowColor="amber" className="p-5 flex flex-col justify-between">
            <div>
              <div className="border-b border-[#24485C] pb-3 mb-3">
                <h3 className="text-sm font-semibold text-[#F3EEE5]">Commodity Rate Matrix</h3>
                <p className="text-xs text-[#78958F]">Empirical rate ranges and sample counts.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#24485C] text-[#78958F]">
                      <th className="pb-2">Commodity</th>
                      <th className="pb-2 text-right">Avg Rate</th>
                      <th className="pb-2 text-right">Min – Max</th>
                      <th className="pb-2 text-right">Records</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#24485C]/60">
                    {(analytics?.commodityComparisons || []).map((c) => (
                      <tr key={c.commodity} className="hover:bg-[#15364A]/30">
                        <td className="py-2.5 font-bold text-[#F3EEE5]">{c.label}</td>
                        <td className="py-2.5 text-right font-bold text-[#F2B653]">
                          {c.avgRatePct.toFixed(3)}%
                        </td>
                        <td className="py-2.5 text-right text-[#D8E2E8]">
                          {c.minRatePct.toFixed(3)}% – {c.maxRatePct.toFixed(3)}%
                        </td>
                        <td className="py-2.5 text-right text-[#35BFC3]">{c.recordCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-4 text-[10px] text-[#78958F] border-t border-[#24485C] pt-2">
              Note: Hard coking coal typically commands a marginally higher rate than iron ore due to
              spontaneous heating considerations on long transits.
            </p>
          </BentoCard>
        </div>
      )}

      {/* TAB 3: Route Comparisons */}
      {activeTab === "routes" && (
        <BentoCard glowColor="teal" className="p-5 space-y-4">
          <div className="border-b border-[#24485C] pb-3">
            <h3 className="text-sm font-semibold text-[#F3EEE5] flex items-center gap-2">
              <Route className="size-4 text-[#35BFC3]" />
              <span>Transit Corridor Rate Differences</span>
            </h3>
            <p className="text-xs text-[#78958F]">
              Historical rate variations across primary origin-destination bulk trade corridors.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#24485C] text-[#78958F]">
                  <th className="pb-2.5">Corridor Route</th>
                  <th className="pb-2.5">Origin Load Port</th>
                  <th className="pb-2.5">East Coast Destination</th>
                  <th className="pb-2.5 text-right">Avg Rate (%)</th>
                  <th className="pb-2.5 text-right">Historical Spread</th>
                  <th className="pb-2.5 text-right">Sample Slips</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24485C]/60">
                {(analytics?.routeComparisons || []).map((r) => (
                  <tr key={r.routeKey} className="hover:bg-[#15364A]/30">
                    <td className="py-3 font-bold text-[#F3EEE5]">{r.routeLabel}</td>
                    <td className="py-3 text-[#D8E2E8]">{r.originName}</td>
                    <td className="py-3 text-[#35BFC3]">{r.destinationName}</td>
                    <td className="py-3 text-right font-bold text-[#F2B653]">
                      {r.avgRatePct.toFixed(3)}%
                    </td>
                    <td className="py-3 text-right text-[#D8E2E8]">
                      {r.minRatePct.toFixed(3)}% – {r.maxRatePct.toFixed(3)}%
                    </td>
                    <td className="py-3 text-right font-bold text-[#F3EEE5]">{r.recordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BentoCard>
      )}

      {/* TAB 4: Coverage Clause Comparisons */}
      {activeTab === "clauses" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(analytics?.coverageComparisons || []).map((c) => (
            <BentoCard
              key={c.clause}
              glowColor={c.clause === "ICC_A" ? "teal" : c.clause === "ICC_B" ? "amber" : "coral"}
              className="p-5 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[#24485C] pb-2.5">
                  <span className="font-mono text-xs font-bold text-[#F3EEE5]">
                    {c.shortLabel}
                  </span>
                  <span className="font-mono text-xs text-[#35BFC3] bg-[#35BFC3]/15 px-2 py-0.5 rounded border border-[#35BFC3]/30">
                    {c.recordCount} verified records
                  </span>
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-mono text-[#78958F] uppercase">Average Historical Rate</p>
                  <p className="text-3xl font-extrabold font-mono text-[#F3EEE5] mt-0.5">
                    {c.avgRatePct.toFixed(3)}%
                  </p>
                  <p className="text-[11px] text-[#78958F] font-mono mt-1">
                    Spread: {c.minRatePct.toFixed(3)}% – {c.maxRatePct.toFixed(3)}%
                  </p>
                </div>

                <p className="text-xs text-[#D8E2E8] leading-relaxed mt-3 pt-3 border-t border-[#24485C]/60">
                  {c.description}
                </p>
              </div>

              <div className="rounded bg-[#081827] p-2 text-[10px] text-[#78958F] border border-[#24485C]">
                Observed rate differences represent historical evidence, not binding future quotations.
              </div>
            </BentoCard>
          ))}
        </div>
      )}
    </div>
  );
}

