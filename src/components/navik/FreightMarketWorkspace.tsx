/**
 * NAVIK Freight Market Intelligence Workspace.
 *
 * A maritime freight intelligence terminal that displays:
 * - Market overview with key indicators
 * - Interactive freight-rate time-series chart
 * - Route comparison matrix
 * - Bunker fuel price intelligence
 * - Port congestion dashboard
 * - Analyst insights and market signals
 *
 * All data comes from the existing fixture/service layer.
 * All simulated data is clearly labelled.
 */
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Anchor,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Clock,
  Droplets,
  ExternalLink,
  Filter,
  Fuel,
  Info,
  LineChart as LineChartIcon,
  Loader2,
  MapPin,
  Minus,
  Navigation,
  RefreshCw,
  Ship,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fmtInt,
  fmtUsd,
  fmtRate,
  fmt1,
  fmt2,
  fmtShortDate,
  fmtDate,
  fmtDateTime,
  fmtPct,
} from "@/lib/format";
import { isDemoMode, FIXTURE_AS_OF } from "@/lib/api/config";
import { ORIGINS, PORTS, DISTANCES_NM, originById, portByCode } from "@/lib/api/reference";
import { dashboardQuery, freightQuery, bunkerQuery, congestionQuery } from "@/lib/api/queries";
import type {
  CongestionIndicator,
  FreightPoint,
  MarketSnapshot,
  OriginRegion,
  PortCode,
  Timeframe,
  Trend,
} from "@/lib/api/types";
import { AXIS, GRID, TooltipCard, Legend } from "@/components/navik/charts";
import {
  DemoTag,
  Delta,
  Eyebrow,
  Metric,
  PanelHeader,
  RiskBadge,
  Segmented,
  TrendIcon,
} from "@/components/navik/primitives";
import {
  BentoCard,
  BentoGrid,
  BentoKpi,
  BentoGauge,
  BentoSparkline,
} from "./Bento";
import { BackendMarketAnalytics } from "./BackendMarketAnalytics";
import {
  buildRouteComparisons,
  computeBunkerImpact,
  generateInsights,
  TIMEFRAME_OPTIONS,
  type BunkerImpact,
  type MarketInsight,
  type RouteComparison,
} from "@/lib/sim/market";

/* =========================================================
   Constants & Helpers
   ========================================================= */

const ORIGINS_LIST = ORIGINS.map((o) => ({
  value: o.id,
  label: o.shortName,
  loadPort: o.loadPort,
}));
const DEFAULT_ORIGIN: OriginRegion = "AUS_QLD";
const DEFAULT_DEST: PortCode = "PRDP";
const DEFAULT_TF: Timeframe = "6M";

const CHART_COLORS = {
  historical: "#35BFC3", // Arctic Teal
  forecast: "#F2B653", // Champagne Amber
  p10p90: "rgba(242, 182, 83, 0.18)", // Amber envelope band
  vlsfo: "#F2B653", // Champagne Amber
  hsfo: "#E87945", // Burnt Orange
  congestionBar: "#F2B653", // Champagne Amber
  grid: "rgba(36, 72, 92, 0.45)",
};

const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.25 },
};

/* =========================================================
   Main Component
   ========================================================= */

export function FreightMarketWorkspace() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  /* --- Filters --- */
  const [origin, setOrigin] = useState<OriginRegion>(DEFAULT_ORIGIN);
  const [destination] = useState<PortCode>(DEFAULT_DEST);
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TF);
  const [selectedRoute, setSelectedRoute] = useState<OriginRegion | null>(null);

  const activeOrigin = selectedRoute ?? origin;

  /* --- Data queries --- */
  const dashQ = useQuery(dashboardQuery());
  const freightQ = useQuery(freightQuery(activeOrigin, timeframe));

  // Fetch all origin series for the route comparison table
  const ausQldQ = useQuery(freightQuery("AUS_QLD", timeframe));
  const ausNswQ = useQuery(freightQuery("AUS_NSW", timeframe));
  const ausWaQ = useQuery(freightQuery("AUS_WA", timeframe));
  const idnKalQ = useQuery(freightQuery("IDN_KAL", timeframe));

  const bunkerQ = useQuery(bunkerQuery(timeframe));
  const congQ = useQuery(congestionQuery());

  const isLoading = dashQ.isLoading || freightQ.isLoading;
  const isRefreshing = dashQ.isFetching || freightQ.isFetching;

  /* --- Derived data --- */
  const snapshot = dashQ.data?.snapshot;
  const alerts = dashQ.data?.alerts ?? [];

  const allFreightData = useMemo(() => {
    const d: Partial<Record<OriginRegion, FreightPoint[]>> = {};
    if (ausQldQ.data) d.AUS_QLD = ausQldQ.data.points;
    if (ausNswQ.data) d.AUS_NSW = ausNswQ.data.points;
    if (ausWaQ.data) d.AUS_WA = ausWaQ.data.points;
    if (idnKalQ.data) d.IDN_KAL = idnKalQ.data.points;
    return d as Record<OriginRegion, FreightPoint[]>;
  }, [ausQldQ.data, ausNswQ.data, ausWaQ.data, idnKalQ.data]);

  const routeComparisons = useMemo(() => {
    const origins = Object.keys(allFreightData) as OriginRegion[];
    if (origins.length === 0) return [];
    return buildRouteComparisons(allFreightData, destination);
  }, [allFreightData, destination]);

  const bunkerImpact = useMemo(() => {
    if (!bunkerQ.data) return null;
    return computeBunkerImpact(bunkerQ.data.points);
  }, [bunkerQ.data]);

  const insights = useMemo(() => {
    if (!snapshot || routeComparisons.length === 0 || !bunkerImpact) return [];
    return generateInsights(
      snapshot,
      routeComparisons,
      congQ.data?.ports ?? [],
      bunkerImpact,
      alerts,
    );
  }, [snapshot, routeComparisons, congQ.data, bunkerImpact, alerts]);

  /* --- Actions --- */
  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["freight"] });
    qc.invalidateQueries({ queryKey: ["bunker"] });
    qc.invalidateQueries({ queryKey: ["congestion"] });
  }, [qc]);

  const handleAnalyseInCharter = useCallback(
    (routeOrigin?: OriginRegion) => {
      navigate({ to: "/charter" });
    },
    [navigate],
  );

  const handleSelectRoute = useCallback((routeOrigin: OriginRegion) => {
    setSelectedRoute(routeOrigin);
    setOrigin(routeOrigin);
  }, []);

  /* --- Loading state --- */
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-brass" />
        <p className="text-sm tracking-wide">Loading market intelligence…</p>
      </div>
    );
  }

  const demo = isDemoMode();
  const asOf = snapshot?.provenance.asOf ?? FIXTURE_AS_OF;

  return (
    <div className="space-y-8 pb-16">
      {/* ============ HEADER ============ */}
      <MarketHeader
        origin={activeOrigin}
        timeframe={timeframe}
        onOriginChange={(o) => {
          setOrigin(o);
          setSelectedRoute(null);
        }}
        onTimeframeChange={setTimeframe}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        asOf={asOf}
        demo={demo}
      />

      {/* ============ KEY INDICATORS ============ */}
      {snapshot && <KeyIndicators snapshot={snapshot} />}

      {/* ============ LIVE BACKEND ML FORECAST & BALTIC EXCHANGE ============ */}
      <BackendMarketAnalytics />

      {/* ============ FREIGHT CHART ============ */}
      <FreightChart
        data={freightQ.data}
        origin={activeOrigin}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        isLoading={freightQ.isLoading}
      />

      {/* ============ ROUTE COMPARISON ============ */}
      <RouteComparisonTable
        comparisons={routeComparisons}
        activeOrigin={activeOrigin}
        destination={destination}
        onSelectRoute={handleSelectRoute}
        onAnalyse={handleAnalyseInCharter}
      />

      {/* ============ BUNKER & CONGESTION — side by side ============ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {bunkerImpact && bunkerQ.data && (
          <BunkerPanel impact={bunkerImpact} points={bunkerQ.data.points} timeframe={timeframe} />
        )}
        {congQ.data && (
          <CongestionPanel ports={congQ.data.ports} onAnalyse={handleAnalyseInCharter} />
        )}
      </div>

      {/* ============ ANALYST INSIGHTS ============ */}
      {insights.length > 0 && (
        <InsightsPanel insights={insights} alerts={alerts} onAnalyse={handleAnalyseInCharter} />
      )}
    </div>
  );
}

/* =========================================================
   Market Header
   ========================================================= */

function MarketHeader({
  origin,
  timeframe,
  onOriginChange,
  onTimeframeChange,
  onRefresh,
  isRefreshing,
  asOf,
  demo,
}: {
  origin: OriginRegion;
  timeframe: Timeframe;
  onOriginChange: (o: OriginRegion) => void;
  onTimeframeChange: (t: Timeframe) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  asOf: string;
  demo: boolean;
}) {
  const o = originById(origin);

  return (
    <header className="space-y-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>Freight Market Intelligence</Eyebrow>
          </div>
          <h1 className="text-display mt-4 text-[2rem] text-foreground sm:text-4xl lg:text-[2.8rem]">
            Market <span className="serif-accent text-[#F2B653]">intelligence.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[0.9rem] leading-relaxed text-muted-foreground">
            Freight rates, bunker fuel costs and port congestion for bulk-cargo routes from
            Australia and Indonesia to Indian East Coast discharge ports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            aria-label="Refresh market data"
          >
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
            Refresh
          </button>
          <span className="hidden text-[0.65rem] text-muted-foreground sm:inline">
            as of {fmtDateTime(asOf)}
          </span>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <span className="text-eyebrow text-muted-foreground">Origin</span>
          <div className="relative">
            <select
              value={origin}
              onChange={(e) => onOriginChange(e.target.value as OriginRegion)}
              className="appearance-none rounded-md border border-border bg-transparent py-1 pl-2.5 pr-7 font-mono text-[0.72rem] text-foreground focus:outline-none focus:ring-1 focus:ring-brass/40"
              aria-label="Select origin region"
            >
              {ORIGINS_LIST.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label} ({o.loadPort})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <span className="text-border">|</span>

        <div className="flex items-center gap-2">
          <span className="text-eyebrow text-muted-foreground">Period</span>
          <Segmented
            value={timeframe}
            options={TIMEFRAME_OPTIONS}
            onChange={onTimeframeChange}
            label="Timeframe"
          />
        </div>

        <span className="text-border hidden sm:inline">|</span>

        <div className="hidden items-center gap-1.5 text-[0.7rem] text-muted-foreground sm:flex">
          <Navigation className="size-3" />
          <span>{o.loadPort} → Paradip (primary)</span>
        </div>
      </div>
    </header>
  );
}

/* =========================================================
   Key Indicators
   ========================================================= */

function KeyIndicators({ snapshot }: { snapshot: MarketSnapshot }) {
  const bdiSpark = [1740, 1765, 1790, 1815, 1805, 1828, snapshot.freightIndex];
  const avgRateSpark = [14.8, 15.0, 15.1, 15.2, 15.0, 15.3, snapshot.avgRateUsdPerT];
  const vlsfoSpark = [594, 600, 608, 614, 611, 615, snapshot.vlsfoUsdPerT];
  const waitSpark = [2.8, 2.7, 2.5, 2.4, 2.3, snapshot.avgPortWaitDays];

  return (
    <BentoGrid cols={12}>
      {/* 1. Freight Index (3 cols) */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-3">
        <BentoKpi
          label="Freight Index"
          value={fmtInt(snapshot.freightIndex)}
          unit="pts"
          changePct={snapshot.freightIndexChangePct}
          changeLabel="7D"
          sparklineData={bdiSpark}
          sparklineColor="#39C6D8"
          icon={TrendingUp}
          accentColor="cyan"
          className="h-full"
        />
      </div>

      {/* 2. Avg Freight Rate (3 cols) */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-3">
        <BentoKpi
          label="Avg Benchmark Rate"
          value={`$${fmt2(snapshot.avgRateUsdPerT)}`}
          unit="/t"
          changePct={snapshot.avgRateChangePct}
          changeLabel="7D"
          sparklineData={avgRateSpark}
          sparklineColor="#35CBB0"
          icon={LineChartIcon}
          accentColor="teal"
          className="h-full"
        />
      </div>

      {/* 3. VLSFO Singapore (3 cols) */}
      <div className="col-span-12 sm:col-span-6 lg:col-span-3">
        <BentoKpi
          label="VLSFO Bunker"
          value={`$${fmtInt(snapshot.vlsfoUsdPerT)}`}
          unit="/t"
          changePct={snapshot.vlsfoChangePct}
          changeLabel="7D fuel"
          sparklineData={vlsfoSpark}
          sparklineColor="#35C9D0"
          icon={Fuel}
          accentColor="cyan"
          className="h-full"
        />
      </div>

      {/* 4. Fleet & Congestion Bento (3 cols) */}
      <BentoCard
        glowColor="teal"
        variant="default"
        className="col-span-12 sm:col-span-6 lg:col-span-3 p-4 flex flex-col justify-between"
      >
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#35C9D0] font-semibold flex items-center gap-1.5">
            <Ship className="size-3.5 text-[#35C9D0]" />
            Fleet & Queue
          </span>
          <span className="font-mono text-[10px] text-[#35C9D0] bg-[#35C9D0]/15 border border-[#35C9D0]/35 px-1.5 py-0.5 rounded font-semibold">
            {snapshot.forecastBias === "up"
              ? "Firming ↑"
              : snapshot.forecastBias === "down"
                ? "Easing ↓"
                : "Stable →"}
          </span>
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <div>
            <div className="font-mono text-2xl font-bold text-foreground">
              {snapshot.fleetAvailabilityPct}%
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">Tonnage Availability</p>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl font-bold text-[#35C9D0]">
              {fmt1(snapshot.avgPortWaitDays)}d
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">Port Berth Queue</p>
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-[#263D50] flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <span>Queue 7D Trend</span>
          <BentoSparkline data={waitSpark} color="#35C9D0" height={20} width={80} />
        </div>
      </BentoCard>
    </BentoGrid>
  );
}

/* =========================================================
   Freight Chart
   ========================================================= */

function FreightChart({
  data,
  origin,
  timeframe,
  onTimeframeChange,
  isLoading,
}: {
  data: { points: FreightPoint[]; changePct: number; origin: OriginRegion } | undefined;
  origin: OriginRegion;
  timeframe: Timeframe;
  onTimeframeChange: (t: Timeframe) => void;
  isLoading: boolean;
}) {
  const o = originById(origin);
  const points = data?.points ?? [];
  const historical = points.filter((p) => !p.forecast);
  const forecasts = points.filter((p) => p.forecast);
  const lastActual = historical.at(-1);
  const firstForecastDate = forecasts[0]?.date;

  // Build combined chart data with a bridge point
  const chartData = useMemo(() => {
    if (points.length === 0) return [];
    return points.map((p) => ({
      date: p.date,
      rate: p.forecast ? undefined : p.rate,
      forecast: p.forecast ? p.rate : undefined,
      p10: p.p10,
      p90: p.p90,
      // Bridge: the last historical point also has a forecast value for continuity
      ...(p.date === lastActual?.date ? { forecast: p.rate, p10: p.rate, p90: p.rate } : {}),
    }));
  }, [points, lastActual]);

  if (isLoading) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-border">
        <Loader2 className="size-5 animate-spin text-brass" />
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-lg border border-border text-muted-foreground">
        <BarChart3 className="size-8 opacity-50" />
        <p className="text-sm">No freight data available for this selection.</p>
      </div>
    );
  }

  const rates = points.map((p) => p.rate);
  const minRate = Math.floor(Math.min(...rates) * 0.96 * 10) / 10;
  const maxRate = Math.ceil(Math.max(...rates) * 1.04 * 10) / 10;

  return (
    <motion.section className="space-y-4" {...fade}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PanelHeader
          eyebrow="Freight rate"
          title={`${o.shortName} → Paradip`}
          right={
            <div className="flex items-center gap-3">
              {data && <Delta value={data.changePct} className="text-sm" />}
            </div>
          }
        />
      </div>

      <BentoCard glowColor="brass" className="p-5 pt-3">
        <Legend
          items={[
            { label: "Historical rate", color: CHART_COLORS.historical },
            { label: "Projected freight curve", color: CHART_COLORS.forecast, dashed: true },
            { label: "P10–P90 band", color: "rgba(208, 160, 94, 0.4)" },
          ]}
          className="mb-4"
        />

        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
            <defs>
              <linearGradient id="freightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.historical} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.historical} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.forecast} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.forecast} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID} />
            <XAxis
              dataKey="date"
              {...AXIS}
              tickFormatter={(d: string) => fmtShortDate(d)}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              {...AXIS}
              domain={[minRate, maxRate]}
              tickFormatter={(v: number) => `$${v.toFixed(1)}`}
              width={52}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                const isForecast = d?.rate === undefined;
                const rate = d?.rate ?? d?.forecast;
                const rows = [
                  {
                    label: isForecast ? "Forecast" : "Rate",
                    value: `$${Number(rate).toFixed(2)}/t`,
                    color: isForecast ? CHART_COLORS.forecast : CHART_COLORS.historical,
                  },
                ];
                if (d?.p10 != null && d?.p90 != null && isForecast) {
                  rows.push({
                    label: "P10",
                    value: `$${Number(d.p10).toFixed(2)}/t`,
                    color: "rgba(208,160,94,0.85)",
                  });
                  rows.push({
                    label: "P90",
                    value: `$${Number(d.p90).toFixed(2)}/t`,
                    color: "rgba(208,160,94,0.85)",
                  });
                }
                return (
                  <TooltipCard
                    title={fmtShortDate(label as string)}
                    rows={rows}
                    note={isForecast ? "Projected forward rate" : undefined}
                  />
                );
              }}
            />
            {/* P10-P90 band for forecast region */}
            <Area
              dataKey="p90"
              stroke="none"
              fill="url(#forecastBand)"
              fillOpacity={1}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Area
              dataKey="p10"
              stroke="none"
              fill="#102A40"
              fillOpacity={1}
              isAnimationActive={false}
              connectNulls={false}
            />
            {/* Historical area */}
            <Area
              dataKey="rate"
              stroke={CHART_COLORS.historical}
              strokeWidth={2}
              fill="url(#freightGrad)"
              fillOpacity={1}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            {/* Forecast line */}
            <Line
              dataKey="forecast"
              stroke={CHART_COLORS.forecast}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            {/* Divider line */}
            {firstForecastDate && (
              <ReferenceLine
                x={firstForecastDate}
                stroke="rgba(188,112,79,0.3)"
                strokeDasharray="3 3"
                label={{
                  value: "Forecast →",
                  position: "top",
                  fill: "rgba(188,112,79,0.6)",
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </BentoCard>
    </motion.section>
  );
}

/* =========================================================
   Route Comparison
   ========================================================= */

type RouteSortKey = "currentRate" | "changePct" | "transitDays" | "distanceNm";
type SortDir = "asc" | "desc";

function RouteComparisonTable({
  comparisons,
  activeOrigin,
  destination,
  onSelectRoute,
  onAnalyse,
}: {
  comparisons: RouteComparison[];
  activeOrigin: OriginRegion;
  destination: PortCode;
  onSelectRoute: (o: OriginRegion) => void;
  onAnalyse: (o?: OriginRegion) => void;
}) {
  const [sortKey, setSortKey] = useState<RouteSortKey>("currentRate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const s = [...comparisons];
    s.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return s;
  }, [comparisons, sortKey, sortDir]);

  const toggleSort = (key: RouteSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortHeader = ({ label, k }: { label: string; k: RouteSortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={cn(
        "inline-flex items-center gap-1 text-left transition-colors hover:text-foreground",
        sortKey === k ? "text-brass" : "text-muted-foreground",
      )}
    >
      {label}
      {sortKey === k && <span className="text-[0.6rem]">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );

  if (comparisons.length === 0) return null;

  return (
    <motion.section className="space-y-4" {...fade}>
      <PanelHeader
        eyebrow="Route comparison"
        title={`Loading origins → ${portByCode(destination).name}`}
        right={
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            {comparisons.length} routes · sorted by{" "}
            {sortKey.replace(/([A-Z])/g, " $1").toLowerCase()} {sortDir === "asc" ? "↑" : "↓"}
          </span>
        }
      />

      <BentoCard glowColor="walnut" className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm" role="table">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="text-eyebrow px-4 py-3 text-muted-foreground">Origin</th>
              <th className="text-eyebrow px-4 py-3 text-muted-foreground">Load Port</th>
              <th className="text-eyebrow px-4 py-3">
                <SortHeader label="Rate $/t" k="currentRate" />
              </th>
              <th className="text-eyebrow px-4 py-3">
                <SortHeader label="Change" k="changePct" />
              </th>
              <th className="text-eyebrow px-4 py-3 text-muted-foreground">Forecast</th>
              <th className="text-eyebrow px-4 py-3">
                <SortHeader label="Nm" k="distanceNm" />
              </th>
              <th className="text-eyebrow px-4 py-3">
                <SortHeader label="Transit" k="transitDays" />
              </th>
              <th className="text-eyebrow px-4 py-3 text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const active = r.origin === activeOrigin;
              return (
                <tr
                  key={r.origin}
                  onClick={() => onSelectRoute(r.origin)}
                  className={cn(
                    "cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/30",
                    active && "bg-accent/20",
                  )}
                  role="row"
                  aria-selected={active}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      {active && <span className="size-1.5 rounded-full bg-brass" />}
                      {r.originName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.loadPort}</td>
                  <td className="font-tabular px-4 py-3 font-mono text-foreground">
                    ${fmt2(r.currentRate)}
                  </td>
                  <td className="px-4 py-3">
                    <Delta value={r.changePct} />
                  </td>
                  <td className="px-4 py-3">
                    {r.forecastRate !== null ? (
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
                        ${fmt2(r.forecastRate)}
                        <TrendIcon
                          trend={r.forecastTrend}
                          className={cn(
                            r.forecastTrend === "up"
                              ? "text-copper"
                              : r.forecastTrend === "down"
                                ? "text-success"
                                : "text-muted-foreground",
                          )}
                        />
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="font-tabular px-4 py-3 font-mono text-muted-foreground">
                    {fmtInt(r.distanceNm)}
                  </td>
                  <td className="font-tabular px-4 py-3 font-mono text-muted-foreground">
                    {fmt1(r.transitDays)}d
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAnalyse(r.origin);
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[0.65rem] text-muted-foreground transition-colors hover:border-copper/50 hover:text-copper"
                      title={`Analyse ${r.originName} in Charter Workspace`}
                    >
                      <Anchor className="size-3" />
                      Charter
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </BentoCard>
    </motion.section>
  );
}

/* =========================================================
   Bunker Panel
   ========================================================= */

function BunkerPanel({
  impact,
  points,
  timeframe,
}: {
  impact: BunkerImpact;
  points: { date: string; vlsfo: number; hsfo: number }[];
  timeframe: Timeframe;
}) {
  // Mini chart data — last 26 points max
  const chartPts = points.slice(-26);

  return (
    <BentoCard glowColor="coral" className="space-y-4 p-5">
      <PanelHeader
        eyebrow="Bunker intelligence"
        title="Fuel Prices"
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-eyebrow text-muted-foreground">VLSFO 0.5%S</p>
          <p className="font-tabular mt-1 font-mono text-xl font-medium text-foreground">
            ${fmtInt(impact.currentVlsfo)}
            <span className="ml-0.5 text-[0.5em] font-normal text-muted-foreground">/t</span>
          </p>
          <Delta value={impact.vlsfoChangePct} invert className="mt-1" />
        </div>
        <div>
          <p className="text-eyebrow text-muted-foreground">HSFO 3.5%S</p>
          <p className="font-tabular mt-1 font-mono text-xl font-medium text-foreground">
            ${fmtInt(impact.currentHsfo)}
            <span className="ml-0.5 text-[0.5em] font-normal text-muted-foreground">/t</span>
          </p>
          <Delta value={impact.hsfoChangePct} invert className="mt-1" />
        </div>
      </div>

      {/* Mini bunker chart */}
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartPts} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
            <CartesianGrid {...GRID} />
            <XAxis
              dataKey="date"
              {...AXIS}
              tickFormatter={(d: string) => fmtShortDate(d)}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              {...AXIS}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => `$${v}`}
              width={44}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <TooltipCard
                    title={fmtShortDate(label as string)}
                    rows={[
                      {
                        label: "VLSFO",
                        value: `$${payload[0]?.value}/t`,
                        color: CHART_COLORS.vlsfo,
                      },
                      { label: "HSFO", value: `$${payload[1]?.value}/t`, color: CHART_COLORS.hsfo },
                    ]}
                  />
                );
              }}
            />
            <Line dataKey="vlsfo" stroke={CHART_COLORS.vlsfo} strokeWidth={1.5} dot={false} />
            <Line dataKey="hsfo" stroke={CHART_COLORS.hsfo} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <Legend
        items={[
          { label: "VLSFO 0.5%", color: CHART_COLORS.vlsfo },
          { label: "HSFO 3.5%", color: CHART_COLORS.hsfo },
        ]}
      />

      {/* Voyage impact */}
      <div className="rounded-md border border-border/60 bg-background/30 px-3 py-2.5">
        <p className="text-eyebrow text-muted-foreground">Voyage cost impact</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Week-on-week VLSFO change {impact.vlsfoChangePct > 0 ? "adds" : "saves"}{" "}
          <span className="font-mono text-foreground">
            {impact.refVoyageImpactUsd !== 0
              ? `$${fmtInt(Math.abs(impact.refVoyageImpactUsd))}`
              : "$0"}
          </span>{" "}
          to a reference Capesize round-trip (48 t/d, ~4,800 nm), or{" "}
          <span className="font-mono text-foreground">
            ${fmt2(Math.abs(impact.refImpactPerT))}/t
          </span>{" "}
          on a 160k t cargo.
        </p>
        <p className="mt-1 text-[0.65rem] italic text-muted-foreground/60">
          Uses the same bunker model as the Charter Workspace.
        </p>
      </div>
    </BentoCard>
  );
}

/* =========================================================
   Congestion Panel
   ========================================================= */

function CongestionPanel({
  ports,
  onAnalyse,
}: {
  ports: CongestionIndicator[];
  onAnalyse: (o?: OriginRegion) => void;
}) {
  // Sort by wait days descending
  const sorted = useMemo(() => [...ports].sort((a, b) => b.avgWaitDays - a.avgWaitDays), [ports]);

  const maxWait = Math.max(...sorted.map((p) => p.avgWaitDays), 1);

  return (
    <BentoCard glowColor="rose" className="space-y-4 p-5">
      <PanelHeader
        eyebrow="Port congestion"
        title="Indian East Coast"
      />

      <div className="space-y-3">
        {sorted.map((port) => {
          const p = portByCode(port.port);
          const pct = (port.avgWaitDays / maxWait) * 100;
          const trendColor =
            port.trend === "up"
              ? "text-copper"
              : port.trend === "down"
                ? "text-success"
                : "text-muted-foreground";
          return (
            <div key={port.port} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="size-3 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                  <span
                    className={cn("inline-flex items-center gap-0.5 text-[0.65rem]", trendColor)}
                  >
                    <TrendIcon trend={port.trend} className="size-3" />
                    {port.trend}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-right">
                  <span className="font-tabular font-mono text-xs text-muted-foreground">
                    {port.waitingVessels} ships
                  </span>
                  <span className="font-tabular font-mono text-sm font-medium text-foreground">
                    {fmt1(port.avgWaitDays)}d
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/40">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      port.avgWaitDays >= 3
                        ? "bg-copper"
                        : port.avgWaitDays >= 2
                          ? "bg-brass"
                          : "bg-success",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-tabular font-mono text-[0.6rem] text-muted-foreground w-8 text-right">
                  {port.berthOccupancyPct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <p className="text-[0.65rem] text-muted-foreground">Berth occupancy % shown right</p>
        <button
          type="button"
          onClick={() => onAnalyse()}
          className="inline-flex items-center gap-1 text-[0.7rem] text-brass transition-colors hover:text-copper"
        >
          Review in Charter <ArrowRight className="size-3" />
        </button>
      </div>
    </BentoCard>
  );
}

/* =========================================================
   Analyst Insights
   ========================================================= */

function InsightsPanel({
  insights,
  alerts,
  onAnalyse,
}: {
  insights: MarketInsight[];
  alerts: {
    id: string;
    severity: string;
    title: string;
    detail: string;
    region: string;
    issuedAt: string;
  }[];
  onAnalyse: (o?: OriginRegion) => void;
}) {
  const severityIcon = (s: MarketInsight["severity"]) => {
    if (s === "warning") return <AlertTriangle className="size-3.5 text-copper" />;
    if (s === "opportunity") return <TrendingUp className="size-3.5 text-success" />;
    return <Info className="size-3.5 text-brass" />;
  };

  return (
    <BentoCard glowColor="brass" className="space-y-4 p-5">
      <PanelHeader
        eyebrow="Market analysis"
        title="Analyst Signals"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Insights */}
        <div className="space-y-3">
          {insights.map((ins) => (
            <div
              key={ins.id}
              className={cn(
                "rounded-lg border px-4 py-3.5 transition-colors",
                ins.severity === "warning"
                  ? "border-copper/25 bg-copper/[0.04]"
                  : ins.severity === "opportunity"
                    ? "border-success/25 bg-success/[0.04]"
                    : "border-border bg-card/30",
              )}
            >
              <div className="flex items-start gap-2.5">
                {severityIcon(ins.severity)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{ins.signal}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{ins.metric}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {ins.implication}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[0.6rem] text-muted-foreground/60">{ins.route}</span>
                    <button
                      type="button"
                      onClick={() => onAnalyse()}
                      className="inline-flex items-center gap-1 text-[0.62rem] text-brass transition-colors hover:text-copper"
                    >
                      Analyse <ArrowRight className="size-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Active Alerts */}
        <div className="space-y-3">
          <p className="text-eyebrow text-muted-foreground">Active Alerts</p>
          {alerts.slice(0, 5).map((alert) => (
            <div key={alert.id} className="rounded-lg border border-border bg-card/30 px-4 py-3">
              <div className="flex items-start gap-2">
                <RiskBadge level={alert.severity as any} className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {alert.detail}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[0.6rem] text-muted-foreground/60">{alert.region}</span>
                    <span className="text-[0.6rem] text-muted-foreground/60">
                      · {fmtShortDate(alert.issuedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA bar */}
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => onAnalyse()}
          className="inline-flex items-center gap-2 rounded-lg bg-[#35C9D0] px-4 py-2 text-xs font-bold text-[#071522] shadow-[0_2px_12px_rgba(53,201,208,0.35)] transition-colors hover:bg-[#4AE1E8]"
        >
          <Anchor className="size-3.5" />
          Analyse in Charter Workspace
        </button>
        <button
          type="button"
          onClick={() => onAnalyse()}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Ship className="size-3.5" />
          Compare vessel options
        </button>
      </div>
    </BentoCard>
  );
}
