import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  Activity,
  Layers,
  Calendar,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Database,
  Compass,
} from "lucide-react";
import { historySeriesQuery, freightForecastQuery } from "@/lib/api/queries";
import type { MarketSeriesId, ForecastHorizonWeeks } from "@/lib/api/types";
import { fmtInt, fmt2, fmtShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const SERIES_OPTIONS: Array<{
  id: MarketSeriesId;
  name: string;
  code: string;
  unit: string;
  vessel: string;
  description: string;
}> = [
  {
    id: "bdi",
    name: "Baltic Dry Index",
    code: "BDI",
    unit: "pts",
    vessel: "Composite Fleet",
    description: "Global dry bulk benchmark covering Capesize, Panamax, and Supramax time-charter rates.",
  },
  {
    id: "bci",
    name: "Baltic Capesize Index",
    code: "BCI",
    unit: "pts",
    vessel: "Capesize (~180k DWT)",
    description: "Benchmark for Capesize iron ore and coking coal voyages.",
  },
  {
    id: "bpi",
    name: "Baltic Panamax Index",
    code: "BPI",
    unit: "pts",
    vessel: "Panamax (~75k-82k DWT)",
    description: "Key benchmark for thermal coal and grains transiting standard channels.",
  },
  {
    id: "bsi",
    name: "Baltic Supramax Index",
    code: "BSI",
    unit: "pts",
    vessel: "Supramax (~50k-60k DWT)",
    description: "Geared bulk carrier voyages with self-loading capability.",
  },
  {
    id: "bhsi",
    name: "Baltic Handysize Index",
    code: "BHSI",
    unit: "pts",
    vessel: "Handysize (~28k-38k DWT)",
    description: "Regional small-bulk coastal and draft-constrained trade benchmark.",
  },
  {
    id: "brent",
    name: "Brent Crude Oil",
    code: "BRENT",
    unit: "$/bbl",
    vessel: "Fuel Proxy",
    description: "Global crude marker directly linked to VLSFO bunker fuel refining and pricing.",
  },
  {
    id: "usdinr",
    name: "USD / INR Exchange Rate",
    code: "USDINR",
    unit: "₹/$",
    vessel: "Macro Currency",
    description: "Rupee exchange rate determining Indian landed procurement costs in INR.",
  },
];

const ROUTES_OPTIONS = [
  { id: "AU_HBI_PRDP_CAPE", name: "Hay Point (AUS) → Paradip", vessel: "Capesize", cargo: "Coking Coal" },
  { id: "AU_GLD_PRDP_CAPE", name: "Gladstone (AUS) → Paradip", vessel: "Capesize", cargo: "Coking Coal" },
  { id: "AU_DAM_VIZG_CAPE", name: "Dampier (AUS) → Visakhapatnam", vessel: "Capesize", cargo: "Iron Ore" },
  { id: "ID_TAB_DHMR_PMAX", name: "Taboneo (IDN) → Dhamra", vessel: "Panamax", cargo: "Thermal Coal" },
  { id: "ZA_RBC_HLDA_SMAX", name: "Richards Bay (ZAF) → Haldia", vessel: "Supramax", cargo: "Thermal Coal" },
];

const HORIZONS: Array<{ weeks: ForecastHorizonWeeks; label: string }> = [
  { weeks: 1, label: "1 Week" },
  { weeks: 4, label: "4 Weeks (1M)" },
  { weeks: 8, label: "8 Weeks (2M)" },
  { weeks: 12, label: "12 Weeks (3M)" },
];

export function BackendMarketAnalytics() {
  const [selectedSeries, setSelectedSeries] = useState<MarketSeriesId>("bdi");
  const [rangeMonths, setRangeMonths] = useState<number>(12);
  const [selectedHorizon, setSelectedHorizon] = useState<ForecastHorizonWeeks>(4);
  const [selectedRoute, setSelectedRoute] = useState(ROUTES_OPTIONS[0]);

  // Compute start date based on rangeMonths
  const startDateStr = useMemo(() => {
    if (rangeMonths === 0) return undefined; // all
    const d = new Date("2026-10-25");
    d.setMonth(d.getMonth() - rangeMonths);
    return d.toISOString().slice(0, 10);
  }, [rangeMonths]);

  // Historical series query
  const historyQ = useQuery(historySeriesQuery(selectedSeries, startDateStr));

  // Quantile forecast query
  const forecastQ = useQuery(
    freightForecastQuery(selectedHorizon, selectedRoute.id, selectedRoute.vessel),
  );

  const seriesMeta = SERIES_OPTIONS.find((s) => s.id === selectedSeries) ?? SERIES_OPTIONS[0];
  const historyData = historyQ.data?.data ?? [];

  // Check if any points in the current dataset have is_derived = true
  const hasDerivedPoints = useMemo(() => {
    return historyData.some((p) => p.is_derived);
  }, [historyData]);

  // Stats
  const stats = useMemo(() => {
    if (historyData.length === 0) return { latest: 0, min: 0, max: 0, avg: 0, changePct: 0 };
    const values = historyData.map((d) => d.value);
    const latest = values[values.length - 1];
    const first = values[0];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / values.length;
    const changePct = first !== 0 ? ((latest - first) / first) * 100 : 0;
    return { latest, min, max, avg, changePct };
  }, [historyData]);

  return (
    <div className="space-y-6 rounded-xl border border-[#24485C] bg-[#0D2233] p-5 lg:p-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#24485C] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-[#35BFC3] animate-pulse" />
            <span className="font-mono text-[0.7rem] uppercase tracking-wider text-[#35BFC3] font-semibold">
              Live FastAPI Analytics
            </span>
          </div>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-[#F3EEE5] sm:text-2xl">
            Baltic Exchange Indices & Conformal Machine Learning Forecasts
          </h2>
          <p className="mt-1 text-xs text-[#D8E2E8]">
            Directly connected to backend time-series loaders and LightGBM quantile regression models.
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1 rounded-lg border border-[#24485C] bg-[#081827] p-1">
          {[
            { m: 3, label: "3M" },
            { m: 6, label: "6M" },
            { m: 12, label: "1Y" },
            { m: 36, label: "3Y" },
            { m: 0, label: "All" },
          ].map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRangeMonths(r.m)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-mono transition-colors",
                rangeMonths === r.m
                  ? "bg-[#35BFC3] text-[#081827] font-bold"
                  : "text-[#78958F] hover:text-[#F3EEE5]",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Series Selector Pills */}
      <div className="flex flex-wrap gap-2">
        {SERIES_OPTIONS.map((s) => {
          const isSelected = selectedSeries === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedSeries(s.id)}
              className={cn(
                "group flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all",
                isSelected
                  ? "border-[#35BFC3] bg-[#15364A] text-[#F3EEE5] shadow-md shadow-[#35BFC3]/10"
                  : "border-[#24485C] bg-[#081827]/70 text-[#78958F] hover:border-[#35BFC3]/40 hover:text-[#F3EEE5]",
              )}
            >
              <span
                className={cn(
                  "font-mono font-bold text-[0.72rem]",
                  isSelected ? "text-[#35BFC3]" : "text-[#78958F] group-hover:text-[#35BFC3]",
                )}
              >
                {s.code}
              </span>
              <span className="text-[0.75rem]">{s.name}</span>
            </button>
          );
        })}
      </div>

      {/* Provenance & Subindex Flag Banner */}
      {hasDerivedPoints && (
        <div className="flex items-start gap-3 rounded-lg border border-[#F2B653]/40 bg-[#F2B653]/10 p-3 text-xs text-[#F2B653]">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">
              Data Provenance Note: Derived Sub-Index Calibration Active
            </p>
            <p className="text-[0.75rem] text-[#F3EEE5]/90 leading-relaxed">
              Baltic sub-index data (BCI, BPI, BSI, BHSI) post-July 31, 2019 carries the{" "}
              <code className="rounded bg-[#081827] px-1 py-0.5 font-mono text-[#F2B653]">
                is_derived = true
              </code>{" "}
              flag in compliance with Baltic Exchange terms. These values represent calibrated proxy series
              benchmarked against the primary Baltic Dry Index.
            </p>
          </div>
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[#24485C] bg-[#081827] p-3">
          <p className="text-[0.68rem] uppercase font-mono tracking-wider text-[#78958F]">
            Latest Observation
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-[#F3EEE5]">
              {selectedSeries === "brent" || selectedSeries === "usdinr"
                ? fmt2(stats.latest)
                : fmtInt(stats.latest)}
            </span>
            <span className="text-xs text-[#78958F]">{seriesMeta.unit}</span>
          </div>
          <span
            className={cn(
              "mt-1 inline-block text-[0.7rem] font-mono",
              stats.changePct >= 0 ? "text-[#35BFC3]" : "text-[#E87945]",
            )}
          >
            {stats.changePct >= 0 ? "+" : ""}
            {fmt2(stats.changePct)}% in period
          </span>
        </div>

        <div className="rounded-lg border border-[#24485C] bg-[#081827] p-3">
          <p className="text-[0.68rem] uppercase font-mono tracking-wider text-[#78958F]">
            Period Low (Min)
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-[#D8E2E8]">
              {selectedSeries === "brent" || selectedSeries === "usdinr"
                ? fmt2(stats.min)
                : fmtInt(stats.min)}
            </span>
            <span className="text-xs text-[#78958F]">{seriesMeta.unit}</span>
          </div>
          <span className="mt-1 inline-block text-[0.7rem] font-mono text-[#78958F]">
            Floored rate support
          </span>
        </div>

        <div className="rounded-lg border border-[#24485C] bg-[#081827] p-3">
          <p className="text-[0.68rem] uppercase font-mono tracking-wider text-[#78958F]">
            Period High (Max)
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-[#F2B653]">
              {selectedSeries === "brent" || selectedSeries === "usdinr"
                ? fmt2(stats.max)
                : fmtInt(stats.max)}
            </span>
            <span className="text-xs text-[#78958F]">{seriesMeta.unit}</span>
          </div>
          <span className="mt-1 inline-block text-[0.7rem] font-mono text-[#78958F]">
            Cycle peak resistance
          </span>
        </div>

        <div className="rounded-lg border border-[#24485C] bg-[#081827] p-3">
          <p className="text-[0.68rem] uppercase font-mono tracking-wider text-[#78958F]">
            Period Average
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-[#F3EEE5]">
              {selectedSeries === "brent" || selectedSeries === "usdinr"
                ? fmt2(stats.avg)
                : fmtInt(stats.avg)}
            </span>
            <span className="text-xs text-[#78958F]">{seriesMeta.unit}</span>
          </div>
          <span className="mt-1 inline-block text-[0.7rem] font-mono text-[#78958F]">
            {historyData.length} observation points
          </span>
        </div>
      </div>

      {/* Main Historical Chart */}
      <div className="rounded-xl border border-[#24485C] bg-[#081827] p-4">
        <div className="mb-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#F3EEE5]">{seriesMeta.name} Trajectory</span>
            <span className="font-mono text-[#78958F]">({seriesMeta.code})</span>
          </div>
          <div className="flex items-center gap-4 text-[0.7rem] font-mono">
            <span className="flex items-center gap-1.5 text-[#35BFC3]">
              <span className="size-2 rounded-full bg-[#35BFC3]" /> Direct Fix
            </span>
            {hasDerivedPoints && (
              <span className="flex items-center gap-1.5 text-[#F2B653]">
                <span className="size-2 rounded-full bg-[#F2B653]" /> Derived Proxy (post-2019)
              </span>
            )}
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid stroke="#24485C" strokeDasharray="3 3" opacity={0.4} />
              <XAxis
                dataKey="date"
                stroke="#78958F"
                fontSize={10}
                tickFormatter={(d) => fmtShortDate(d)}
                minTickGap={40}
              />
              <YAxis
                stroke="#78958F"
                fontSize={10}
                domain={["auto", "auto"]}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as {
                    date: string;
                    value: number;
                    is_derived?: boolean;
                  };
                  return (
                    <div className="rounded-lg border border-[#24485C] bg-[#0D2233] p-2.5 text-xs shadow-xl text-[#F3EEE5]">
                      <p className="font-mono text-[0.7rem] text-[#78958F]">{point.date}</p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="font-mono text-base font-bold text-[#35BFC3]">
                          {selectedSeries === "brent" || selectedSeries === "usdinr"
                            ? fmt2(point.value)
                            : fmtInt(point.value)}
                        </span>
                        <span className="text-[0.7rem] text-[#78958F]">{seriesMeta.unit}</span>
                      </div>
                      {point.is_derived && (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-[#F2B653]/15 px-1.5 py-0.5 text-[0.65rem] font-semibold text-[#F2B653]">
                          <AlertCircle className="size-3" /> Derived Proxy
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#35BFC3"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#35BFC3" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Machine Learning Quantile Forecast Section */}
      <div className="rounded-xl border border-[#24485C] bg-[#081827] p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-[#F2B653]" />
              <h3 className="text-base font-bold text-[#F3EEE5]">
                LightGBM Conformal Quantile Forecast & Route Rates
              </h3>
            </div>
            <p className="text-xs text-[#78958F] mt-0.5">
              Split-conformal prediction intervals delivering 80% coverage on Baltic indices.
            </p>
          </div>

          {/* Horizon Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-[#24485C] bg-[#0D2233] p-1">
            {HORIZONS.map((h) => (
              <button
                key={h.weeks}
                type="button"
                onClick={() => setSelectedHorizon(h.weeks)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-mono transition-colors",
                  selectedHorizon === h.weeks
                    ? "bg-[#F2B653] text-[#081827] font-bold"
                    : "text-[#78958F] hover:text-[#F3EEE5]",
                )}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        {/* Route selector dropdown */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[0.7rem] uppercase font-mono tracking-wider text-[#78958F]">
              Route Calibration
            </label>
            <select
              aria-label="Route Calibration"
              value={selectedRoute.id}
              onChange={(e) => {
                const r = ROUTES_OPTIONS.find((opt) => opt.id === e.target.value);
                if (r) setSelectedRoute(r);
              }}
              className="mt-1 w-full rounded-lg border border-[#24485C] bg-[#0D2233] px-3 py-2 text-xs font-medium text-[#F3EEE5] outline-none focus:border-[#35BFC3]"
            >
              {ROUTES_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.vessel} ({r.cargo})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[0.7rem] uppercase font-mono tracking-wider text-[#78958F]">
              Model Formulation Note
            </label>
            <div className="mt-1 rounded-lg border border-[#24485C] bg-[#0D2233] px-3 py-2 text-xs text-[#D8E2E8] leading-tight flex items-center justify-between">
              <span>{forecastQ.data?.calibration_note ?? "80% Conformal Interval"}</span>
              <span className="font-mono text-[0.65rem] text-[#35BFC3] bg-[#35BFC3]/15 px-1.5 py-0.5 rounded">
                Horizon: {selectedHorizon}W
              </span>
            </div>
          </div>
        </div>

        {/* Quantile Fan Display Cards */}
        {forecastQ.data && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 pt-2">
            {/* Q10 */}
            <div className="rounded-lg border border-[#24485C] bg-[#0D2233] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[0.7rem] font-mono uppercase text-[#78958F]">10th Percentile (Q10)</span>
                <span className="text-[0.65rem] font-mono text-[#35BFC3]">Bearish Support</span>
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-[#35BFC3]">
                {fmtInt(forecastQ.data.bdi_q10)}
              </div>
              <p className="mt-1 text-[0.7rem] text-[#78958F]">
                10% probability BDI settles below this level
              </p>
            </div>

            {/* Q50 Median */}
            <div className="rounded-lg border border-[#F2B653]/60 bg-[#F2B653]/10 p-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[0.7rem] font-mono uppercase text-[#F2B653] font-bold">
                  Median Forecast (Q50)
                </span>
                <span className="text-[0.65rem] font-mono bg-[#F2B653]/20 text-[#F2B653] px-1.5 py-0.5 rounded font-semibold">
                  BASE
                </span>
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-[#F2B653]">
                {fmtInt(forecastQ.data.bdi_median)}
              </div>
              <p className="mt-1 text-[0.7rem] text-[#D8E2E8]">
                Central tendency expected index value
              </p>
            </div>

            {/* Q90 */}
            <div className="rounded-lg border border-[#24485C] bg-[#0D2233] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[0.7rem] font-mono uppercase text-[#78958F]">90th Percentile (Q90)</span>
                <span className="text-[0.65rem] font-mono text-[#E87945]">Tail Risk</span>
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-[#E87945]">
                {fmtInt(forecastQ.data.bdi_q90)}
              </div>
              <p className="mt-1 text-[0.7rem] text-[#78958F]">
                90% probability upper bound spike ceiling
              </p>
            </div>

            {/* Per-Tonne Route Rate */}
            <div className="rounded-lg border border-[#35BFC3]/50 bg-[#15364A] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[0.7rem] font-mono uppercase text-[#35BFC3] font-semibold">
                  Voyage Freight Rate
                </span>
                <span className="text-[0.65rem] font-mono text-[#F3EEE5]">{selectedRoute.vessel}</span>
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-[#F3EEE5]">
                ${fmt2(forecastQ.data.per_tonne_rate_usd ?? 14.50)}
                <span className="text-xs font-normal text-[#78958F] ml-1">/ MT</span>
              </div>
              <p className="mt-1 text-[0.7rem] text-[#78958F]">
                Estimated voyage cost formula rate
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

