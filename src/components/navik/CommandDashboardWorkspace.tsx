/**
 * NAVIK Operational Command Center Workspace.
 *
 * Provides executive and operations desk teams with a unified operational picture:
 * - Active East Coast India raw material inflow status
 * - Interactive schematic route canvas & discharge port telemetry
 * - Live maritime risk alerts & bottleneck tracker
 * - Recent chartering decisions with one-click workspace escalation
 * - Active fixture commitments & vessel class distributions
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Anchor,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Filter,
  Flame,
  Gauge,
  Info,
  Layers,
  LineChart,
  Navigation,
  RefreshCw,
  Search,
  ShieldAlert,
  Ship,
  Sparkles,
  TrendingUp,
  Waves,
} from "lucide-react";
import { dashboardQuery, congestionQuery, contractsQuery, portsQuery } from "@/lib/api/queries";
import {
  filterRiskAlerts,
  getPortOperationalDetail,
  summarizeCongestion,
  summarizeInflowPipeline,
} from "@/lib/sim/dashboard";
import { RouteMap, ALL_LANES, type MapLane } from "@/components/navik/RouteMap";
import { fmtInt, fmtUsd, fmtRate } from "@/lib/format";
import { ORIGINS, PORTS } from "@/lib/api/reference";
import type { PortCode, RiskLevel } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card/60 backdrop-blur-md shadow-deep transition-all duration-200",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: "brass" | "warning" | "danger" | "outline" | "neutral" | "success";
  className?: string;
  children: React.ReactNode;
}) {
  const styles = {
    brass: "border-[#D7B88C]/50 bg-[#D7B88C]/15 text-[#D7B88C]",
    warning: "border-[#B96F50]/50 bg-[#B96F50]/15 text-[#FAF5EC]",
    danger: "border-crimson/50 bg-crimson/15 text-crimson",
    success: "border-[#D7B88C]/40 bg-[#79513D]/25 text-[#FAF5EC]",
    outline: "border-border/80 text-foreground/75 bg-card/40",
    neutral: "border-border/60 bg-muted/40 text-foreground/80",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-mono font-medium border",
        styles[variant] ?? styles.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}

const SEVERITY_STYLES: Record<
  RiskLevel,
  { border: string; bg: string; text: string; badge: "danger" | "warning" | "brass" | "outline" }
> = {
  HIGH: {
    border: "border-crimson/50",
    bg: "bg-crimson/10",
    text: "text-crimson",
    badge: "danger",
  },
  ELEVATED: {
    border: "border-[#B96F50]/50",
    bg: "bg-[#B96F50]/10",
    text: "text-[#C88C78]",
    badge: "warning",
  },
  MODERATE: {
    border: "border-[#D7B88C]/40",
    bg: "bg-[#D7B88C]/10",
    text: "text-[#D7B88C]",
    badge: "brass",
  },
  LOW: {
    border: "border-[#79513D]/40",
    bg: "bg-[#382720]/40",
    text: "text-fog",
    badge: "outline",
  },
};

export function CommandDashboardWorkspace() {
  const qc = useQueryClient();
  const [selectedPort, setSelectedPort] = useState<PortCode>("PRDP");
  const [alertSeverity, setAlertSeverity] = useState<"ALL" | RiskLevel>("ALL");
  const [alertSearch, setAlertSearch] = useState("");
  const [selectedLaneGroup, setSelectedLaneGroup] = useState<"ALL" | "COAL" | "IRON_ORE">("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Queries
  const dashQ = useQuery(dashboardQuery());
  const congQ = useQuery(congestionQuery());
  const contractsQ = useQuery(contractsQuery());
  const portsQ = useQuery(portsQuery());

  const bundle = dashQ.data;
  const snapshot = bundle?.snapshot;
  const alerts = bundle?.alerts ?? [];
  const recent = bundle?.recent ?? [];
  const contracts = contractsQ.data ?? [];
  const congestionList = congQ.data?.ports ?? [];

  // Computed metrics
  const congestionSummary = useMemo(() => summarizeCongestion(congestionList), [congestionList]);
  const inflowSummary = useMemo(
    () => summarizeInflowPipeline(recent, contracts),
    [recent, contracts],
  );
  const selectedPortDetail = useMemo(
    () => getPortOperationalDetail(selectedPort, congestionList),
    [selectedPort, congestionList],
  );

  const filteredAlerts = useMemo(
    () => filterRiskAlerts(alerts, alertSeverity, alertSearch),
    [alerts, alertSeverity, alertSearch],
  );

  // Filter lanes based on selected commodity corridor
  const activeLanes: MapLane[] = useMemo(() => {
    if (selectedLaneGroup === "COAL") {
      return ALL_LANES.filter(
        (l) => l.origin === "AUS_QLD" || l.origin === "AUS_NSW" || l.origin === "IDN_KAL",
      );
    }
    if (selectedLaneGroup === "IRON_ORE") {
      return ALL_LANES.filter((l) => l.origin === "AUS_WA");
    }
    return ALL_LANES;
  }, [selectedLaneGroup]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["congestion"] }),
      qc.invalidateQueries({ queryKey: ["contracts"] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header & Desk Control Bar */}
      <div className="flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#D7B88C] animate-pulse shadow-[0_0_8px_rgba(215,184,140,0.7)]" />
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#D7B88C]">
              NAVIK Command Center · Active Desk
            </span>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              East Coast India Inflow
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Command <span className="text-[#B96F50]">Deck</span>
          </h1>
          <p className="max-w-2xl text-sm text-foreground/70">
            Real-time maritime telemetry, port draft limits, risk alerts, and operational decision
            support for dry-bulk intake across Paradip, Dhamra, Haldia, Vizag, and Gangavaram.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#D7B88C]/30 bg-surface/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-[#382720]/80 hover:text-[#FAF5EC] transition disabled:opacity-50"
            title="Refresh operational data"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-[#B96F50]")}
            />
            <span>Sync Telemetry</span>
          </button>

          <Link
            to="/market"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-[#B96F50]/50 hover:text-[#FAF5EC] transition"
          >
            <LineChart className="h-3.5 w-3.5 text-[#B96F50]" />
            <span>Market Terminal</span>
          </Link>

          <Link
            to="/charter"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#B96F50] px-3.5 py-1.5 text-xs font-semibold text-[#FAF5EC] shadow-sm hover:bg-[#C67C5E] transition"
          >
            <Anchor className="h-3.5 w-3.5" />
            <span>Launch Charter Workspace</span>
          </Link>
        </div>
      </div>

      {/* 2. Operational KPI Ribbon with Enhanced Numerical Hierarchy & Distinct Thematic Tints */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* KPI 1: Baltic Dry Index (Muted Brass Theme) */}
        <Card className="p-4 border-[#D7B88C]/40 bg-gradient-to-br from-card/95 via-card/70 to-[#D7B88C]/15 hover:border-[#D7B88C] transition-all duration-300 shadow-deep">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#D7B88C] font-semibold">
              Baltic Dry Index
            </span>
            <TrendingUp className="h-3.5 w-3.5 text-[#D7B88C]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#FAF5EC] tracking-tight">
            {snapshot ? fmtInt(snapshot.freightIndex) : "1,842"}
            <span className="text-xs font-normal font-sans text-muted-foreground ml-1.5">pts</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-[#D7B88C] font-mono bg-[#D7B88C]/15 border border-[#D7B88C]/30 px-1.5 py-0.5 rounded w-fit">
            <ArrowUpRight className="h-3 w-3" />
            <span>+{snapshot?.freightIndexChangePct ?? 2.6}% 7D benchmark</span>
          </div>
        </Card>

        {/* KPI 2: VLSFO Singapore (Burnt Coral Theme) */}
        <Card className="p-4 border-[#B96F50]/40 bg-gradient-to-br from-card/95 via-card/70 to-[#B96F50]/15 hover:border-[#B96F50] transition-all duration-300 shadow-deep">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#B96F50] font-semibold">
              VLSFO Singapore
            </span>
            <Flame className="h-3.5 w-3.5 text-[#B96F50]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#FAF5EC] tracking-tight">
            {snapshot ? fmtRate(snapshot.vlsfoUsdPerT) : "$618.50"}
            <span className="text-xs font-normal font-sans text-muted-foreground ml-1.5">/t</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-[#FAF5EC] font-mono bg-[#B96F50]/20 border border-[#B96F50]/40 px-1.5 py-0.5 rounded w-fit">
            <ArrowUpRight className="h-3 w-3" />
            <span>+{snapshot?.vlsfoChangePct ?? 4.1}% 7D fuel escalation</span>
          </div>
        </Card>

        {/* KPI 3: Anchorage Queue (Dusty Rose Theme) */}
        <Card className="p-4 border-[#C88C78]/40 bg-gradient-to-br from-card/95 via-card/70 to-[#C88C78]/15 hover:border-[#C88C78] transition-all duration-300 shadow-deep">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#C88C78] font-semibold">
              Anchorage Queue
            </span>
            <Clock className="h-3.5 w-3.5 text-[#C88C78]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#FAF5EC] tracking-tight">
            {congestionSummary.averageWaitDays}
            <span className="text-xs font-normal font-sans text-muted-foreground ml-1.5">
              days avg
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-[#C88C78] font-mono bg-[#C88C78]/15 border border-[#C88C78]/30 px-1.5 py-0.5 rounded w-fit">
            <span>{congestionSummary.totalWaitingVessels} vessels waiting berth</span>
          </div>
        </Card>

        {/* KPI 4: Basin Fleet Avail (Walnut Theme) */}
        <Card className="p-4 border-[#79513D]/40 bg-gradient-to-br from-card/95 via-card/70 to-[#79513D]/25 hover:border-[#79513D] transition-all duration-300 shadow-deep">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#FAF5EC] font-semibold">
              Basin Fleet Avail
            </span>
            <Gauge className="h-3.5 w-3.5 text-[#FAF5EC]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#FAF5EC] tracking-tight">
            {snapshot?.fleetAvailabilityPct ?? 79}
            <span className="text-xs font-normal font-sans text-muted-foreground ml-1.5">%</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-[#FAF5EC] font-mono bg-[#79513D]/30 border border-[#79513D]/50 px-1.5 py-0.5 rounded w-fit">
            <CheckCircle2 className="h-3 w-3" />
            <span>Adequate spot tonnage</span>
          </div>
        </Card>

        {/* KPI 5: Committed Inflow (Warm Ivory / Espresso Theme) */}
        <Card className="p-4 border-[#FAF5EC]/30 bg-gradient-to-br from-card/95 via-card/70 to-[#382720]/40 hover:border-[#FAF5EC]/60 transition-all duration-300 shadow-deep col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#F2E6D5] font-semibold">
              Committed Inflow
            </span>
            <Ship className="h-3.5 w-3.5 text-[#B96F50]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#FAF5EC] tracking-tight">
            {fmtInt(inflowSummary.totalTonnage)}
            <span className="text-xs font-normal font-sans text-muted-foreground ml-1.5">t</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-[#FAF5EC] font-mono bg-[#382720]/80 border border-[#D7B88C]/30 px-1.5 py-0.5 rounded w-fit">
            <span>{inflowSummary.activeFixturesCount} active fixtures</span>
          </div>
        </Card>
      </div>

      {/* 3. Interactive Route Canvas & Port Terminal Inspector */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Schematic Map Canvas (7 cols) */}
        <Card className="p-5 lg:col-span-7 bg-surface/40 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-[#B96F50]" />
                  Inbound Trade Corridors & Port Nodes
                </h2>
                <p className="text-xs text-foreground/60">
                  Australia & Indonesia origin hubs to East Coast India terminals. Click any port
                  node to inspect limits.
                </p>
              </div>

              {/* Corridor filter buttons */}
              <div className="flex items-center gap-1 rounded-md border border-border bg-ink/60 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedLaneGroup("ALL")}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-medium transition",
                    selectedLaneGroup === "ALL"
                      ? "bg-[#B96F50] text-[#FAF5EC] font-semibold"
                      : "text-foreground/70 hover:text-foreground",
                  )}
                >
                  All Corridors
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLaneGroup("COAL")}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-medium transition",
                    selectedLaneGroup === "COAL"
                      ? "bg-[#B96F50] text-[#FAF5EC] font-semibold"
                      : "text-foreground/70 hover:text-foreground",
                  )}
                >
                  Coal Lanes
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLaneGroup("IRON_ORE")}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-medium transition",
                    selectedLaneGroup === "IRON_ORE"
                      ? "bg-[#B96F50] text-[#FAF5EC] font-semibold"
                      : "text-foreground/70 hover:text-foreground",
                  )}
                >
                  Ore Lanes
                </button>
              </div>
            </div>

            {/* SVG Animated Route Canvas */}
            <div className="relative rounded-lg border border-border/40 bg-ink/70 p-3 overflow-hidden">
              <RouteMap
                title="East Coast India Maritime Corridors"
                lanes={activeLanes}
                highlightPort={selectedPort}
                onPortSelect={(code) => setSelectedPort(code)}
                className="w-full max-h-[380px]"
              />
              <div className="absolute bottom-2 right-3 text-[10px] font-mono text-foreground/40 bg-ink/80 px-2 py-0.5 rounded border border-border/40">
                Schematic canvas · Not for navigation
              </div>
            </div>
          </div>

          {/* Quick origin & transit pill reference */}
          <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-foreground/50 font-mono text-[11px]">Primary Load Ports:</span>
            <div className="flex flex-wrap gap-2">
              {ORIGINS.map((o) => (
                <div
                  key={o.id}
                  className="inline-flex items-center gap-1.5 rounded bg-surface/80 px-2 py-1 border border-border/60 text-[11px] font-mono"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brass" />
                  <span className="font-semibold text-foreground/80">{o.loadPort}</span>
                  <span className="text-foreground/50">({o.country})</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Right: Port Terminal Constraints Card (5 cols) */}
        <Card className="p-5 lg:col-span-5 bg-surface/40 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between border-b border-border/50 pb-3 mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-brass">
                  Terminal Telemetry
                </span>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  {selectedPortDetail.name} Port ({selectedPortDetail.code})
                </h3>
                <span className="text-xs text-foreground/60">
                  {selectedPortDetail.state}, India
                </span>
              </div>
              <Badge
                variant={
                  selectedPortDetail.status === "CRITICAL"
                    ? "danger"
                    : selectedPortDetail.status === "CONGESTED"
                      ? "warning"
                      : "brass"
                }
              >
                {selectedPortDetail.status}
              </Badge>
            </div>

            {/* Port Port Selector Switcher */}
            <div className="grid grid-cols-5 gap-1.5 mb-5">
              {PORTS.map((p) => {
                const isSelected = p.code === selectedPort;
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => setSelectedPort(p.code)}
                    className={cn(
                      "py-1.5 text-center rounded border transition text-xs font-mono",
                      isSelected
                        ? "border-[#B96F50] bg-[#B96F50]/20 text-[#FAF5EC] font-bold"
                        : "border-border/60 bg-ink/40 text-foreground/70 hover:border-border hover:text-foreground",
                    )}
                  >
                    {p.code}
                  </button>
                );
              })}
            </div>

            {/* Detailed port specifications */}
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border/60 bg-ink/40 p-3">
                  <div className="text-[11px] font-mono text-foreground/60 mb-0.5">
                    Maximum Draft
                  </div>
                  <div className="text-lg font-bold font-mono text-foreground flex items-baseline gap-1">
                    {selectedPortDetail.maxDraftM.toFixed(1)}
                    <span className="text-xs font-normal text-foreground/50">m</span>
                  </div>
                  {selectedPortDetail.draftRisk ? (
                    <span className="text-[10px] text-amber-400 flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      Capesize requires lightering
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#D7B88C] flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      Deepwater berths available
                    </span>
                  )}
                </div>

                <div className="rounded-md border border-border/60 bg-ink/40 p-3">
                  <div className="text-[11px] font-mono text-foreground/60 mb-0.5">
                    Queue / Wait Time
                  </div>
                  <div className="text-lg font-bold font-mono text-foreground flex items-baseline gap-1">
                    {selectedPortDetail.avgWaitDays.toFixed(1)}
                    <span className="text-xs font-normal text-foreground/50">days</span>
                  </div>
                  <span className="text-[10px] text-foreground/60 mt-1 block">
                    {selectedPortDetail.waitingVessels} vessels at anchorage
                  </span>
                </div>
              </div>

              <div className="rounded-md border border-border/60 bg-ink/40 p-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-foreground/60 mb-1.5">
                  <span>Berth Utilization</span>
                  <span className="font-semibold text-foreground">
                    {selectedPortDetail.berthOccupancyPct}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      selectedPortDetail.berthOccupancyPct > 85
                        ? "bg-crimson"
                        : selectedPortDetail.berthOccupancyPct > 75
                          ? "bg-[#B96F50]"
                          : "bg-[#D7B88C]",
                    )}
                    style={{ width: `${selectedPortDetail.berthOccupancyPct}%` }}
                  />
                </div>
              </div>

              {/* Vessel Class Suitability */}
              <div className="rounded-md border border-border/60 bg-ink/40 p-3">
                <div className="text-[11px] font-mono uppercase text-foreground/60 mb-2">
                  Vessel Class Compatibility
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["Supramax", "Panamax", "Post-Panamax", "Capesize", "Newcastlemax"].map(
                    (cls) => {
                      const isSupported = selectedPortDetail.supportedClasses.includes(cls);
                      return (
                        <span
                          key={cls}
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-mono border",
                            isSupported
                              ? "border-[#D7B88C]/40 bg-[#79513D]/25 text-[#FAF5EC]"
                              : "border-crimson/30 bg-crimson/10 text-crimson line-through opacity-70",
                          )}
                        >
                          {isSupported ? "✓" : "✕"} {cls}
                        </span>
                      );
                    },
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-foreground/50">Need full berth constraints?</span>
            <Link
              to="/feasibility"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#B96F50] hover:text-[#C67C5E] transition"
            >
              <span>Port Feasibility Suite</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </Card>
      </div>

      {/* 4. Active Voyage Fixtures Pipeline & Desk Decision History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Active Contracts / Voyage Commitments (7 cols) */}
        <Card className="p-5 lg:col-span-7 bg-surface/40">
          <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Layers className="h-4 w-4 text-brass" />
                Active Voyage Commitments & Fixtures
              </h2>
              <p className="text-xs text-foreground/60">
                Fixed and pending charter contracts currently lifting raw materials for East Coast
                India.
              </p>
            </div>
            <Link
              to="/contracts"
              className="text-xs font-medium text-copper hover:underline inline-flex items-center gap-1"
            >
              <span>View All Records</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/60 text-foreground/50 font-mono">
                  <th className="pb-2.5 font-medium">Vessel / Reference</th>
                  <th className="pb-2.5 font-medium">Class / Cargo</th>
                  <th className="pb-2.5 font-medium">Route</th>
                  <th className="pb-2.5 font-medium text-right">Tonnage</th>
                  <th className="pb-2.5 font-medium text-right">Rate</th>
                  <th className="pb-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {contracts.slice(0, 5).map((c) => {
                  const originDef = ORIGINS.find((o) => o.id === c.origin);
                  return (
                    <tr key={c.id} className="hover:bg-surface/50 transition">
                      <td className="py-2.5">
                        <div className="font-semibold text-foreground">{c.vesselName}</div>
                        <div className="font-mono text-[10px] text-foreground/50">
                          {c.reference}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {c.vesselClass}
                        </Badge>
                        <div className="text-[10px] text-foreground/50 mt-0.5">{c.type}</div>
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-foreground/80">
                        {originDef?.loadPort ?? c.origin} → {c.destination}
                      </td>
                      <td className="py-2.5 text-right font-mono font-medium text-foreground">
                        {fmtInt(c.tonnage)} t
                      </td>
                      <td className="py-2.5 text-right font-mono font-medium text-[#FAF5EC]">
                        ${c.rateUsdPerT.toFixed(2)}/t
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge
                          variant={
                            c.status === "FIXED"
                              ? "brass"
                              : c.status === "UNDER_REVIEW"
                                ? "warning"
                                : c.status === "COMPLETED"
                                  ? "outline"
                                  : "neutral"
                          }
                          className="text-[10px]"
                        >
                          {c.status.replace("_", " ")}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Right: Recent Charter Decisions (5 cols) */}
        <Card className="p-5 lg:col-span-5 bg-surface/40">
          <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Compass className="h-4 w-4 text-[#B96F50]" />
                Recent Decision Logs
              </h2>
              <p className="text-xs text-foreground/60">
                Simulated recommendations generated by the chartering engine.
              </p>
            </div>
            <Link
              to="/charter"
              className="text-xs font-medium text-[#B96F50] hover:underline inline-flex items-center gap-1"
            >
              <span>Open Desk</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {recent.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-ink/40 p-3 hover:border-[#B96F50]/40 transition"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">{d.id}</span>
                    <Badge
                      variant={
                        d.decision === "CHARTER_NOW"
                          ? "brass"
                          : d.decision === "WAIT"
                            ? "warning"
                            : "outline"
                      }
                      className="text-[10px]"
                    >
                      {d.decision.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-foreground/70 font-mono">
                    {fmtInt(d.cargoTonnes)}t {d.cargoType.replace("_", " ")}
                  </div>
                  <div className="text-[10px] text-foreground/50 font-mono">
                    {d.origin} → {d.destination} · {d.vesselClass}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-foreground">
                    ${d.rateUsdPerT.toFixed(2)}/t
                  </div>
                  <div className="text-[10px] font-mono text-[#D7B88C]">
                    {Math.round(d.confidence * 100)}% conf
                  </div>
                  <Link
                    to="/charter"
                    className="text-[10px] font-semibold text-[#B96F50] hover:underline inline-flex items-center gap-0.5 mt-1"
                  >
                    <span>Simulate</span>
                    <ArrowUpRight className="h-2.5 w-2.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 5. Operational Risk Alerts Feed */}
      <Card className="p-5 bg-surface/40">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/50 pb-4 mb-5">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-crimson" />
              Operational Maritime Risk Alerts
            </h2>
            <p className="text-xs text-foreground/60">
              Active voyage impediments, meteorological warnings, draft restrictions, and bunker
              escalations.
            </p>
          </div>

          {/* Alert filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-foreground/40" />
              <input
                type="text"
                placeholder="Filter alerts..."
                value={alertSearch}
                onChange={(e) => setAlertSearch(e.target.value)}
                className="rounded-md border border-border/80 bg-ink/70 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:border-[#B96F50] focus:outline-none w-44"
              />
            </div>

            {/* Severity switcher */}
            <div className="flex items-center gap-1 rounded-md border border-border bg-ink/60 p-0.5 text-xs">
              {(["ALL", "HIGH", "ELEVATED", "MODERATE", "LOW"] as const).map((sev) => {
                const count =
                  sev === "ALL" ? alerts.length : alerts.filter((a) => a.severity === sev).length;
                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setAlertSeverity(sev)}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] font-mono transition",
                      alertSeverity === sev
                        ? "bg-[#B96F50] text-[#FAF5EC] font-semibold"
                        : "text-foreground/70 hover:text-foreground",
                    )}
                  >
                    {sev} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Alerts list with tiered visual severity and escalation links */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {filteredAlerts.map((alert) => {
            const style = SEVERITY_STYLES[alert.severity];
            const isHigh = alert.severity === "HIGH";
            const targetRoute =
              alert.title.toLowerCase().includes("draft") ||
              alert.detail.toLowerCase().includes("draft") ||
              alert.title.toLowerCase().includes("haldia")
                ? "/feasibility"
                : alert.title.toLowerCase().includes("bunker") ||
                    alert.detail.toLowerCase().includes("vlsfo")
                  ? "/scenarios"
                  : "/charter";

            return (
              <div
                key={alert.id}
                className={cn(
                  "rounded-lg border p-4 transition-all duration-200 flex flex-col justify-between bg-card/60 backdrop-blur-sm hover:border-[#B96F50]/50",
                  style.border,
                  isHigh && "shadow-[0_0_20px_-8px_rgba(200,80,80,0.35)]",
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      {isHigh && (
                        <span className="relative flex size-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full size-2 bg-rose-500" />
                        </span>
                      )}
                      <Badge variant={style.badge} className="text-[10px] font-mono">
                        {alert.severity}
                      </Badge>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">{alert.id}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-foreground mb-1 tracking-tight">
                    {alert.title}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    {alert.detail}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-border/40 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span className="text-[#D7B88C]">{alert.region}</span>
                  <Link
                    to={targetRoute}
                    className="inline-flex items-center gap-1 text-[11px] text-[#FAF5EC] hover:text-[#B96F50] transition font-medium"
                  >
                    <span>Escalate</span>
                    <ArrowUpRight className="size-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {filteredAlerts.length === 0 && (
          <div className="text-center py-10 text-foreground/50 text-xs font-mono">
            No active risk alerts match your current filter parameters.
          </div>
        )}
      </Card>

      {/* 6. Desk Provenance & Benchmark Model Disclaimer */}
      <div className="rounded-lg border border-border/50 bg-surface/20 p-4 text-xs text-foreground/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-brass shrink-0" />
          <span>
            Telemetry and vessel scheduling calibrated against dry-bulk fixtures for East Coast
            India (Q4 2026). All figures labelled as simulated desk intelligence.
          </span>
        </div>
        <div className="font-mono text-[11px] text-foreground/40 whitespace-nowrap">
          Engine: NAVIK SIM-V2.4 · Baltic / Platts Reference
        </div>
      </div>
    </div>
  );
}
