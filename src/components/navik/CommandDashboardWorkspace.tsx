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
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShieldAlert,
  Ship,
  Sparkles,
  SunMedium,
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
import { MaritimeGlobe } from "./MaritimeGlobe";
import { fmtInt, fmtUsd, fmtRate } from "@/lib/format";
import { ORIGINS, PORTS } from "@/lib/api/reference";
import type { PortCode, RiskLevel } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import {
  BentoCard,
  BentoGrid,
  BentoKpi,
  BentoGauge,
  BentoFlowBar,
  BentoSegmented,
  BentoHeader,
  BentoSparkline,
} from "./Bento";
import { BackendInsightsCard } from "./BackendInsightsCard";
import heroCarrier from "@/assets/hero-carrier.jpg";
import portTerminal from "@/assets/port-terminal.jpg";

function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: "brass" | "warning" | "danger" | "outline" | "neutral" | "success" | "cyan" | "amber" | "orange" | "violet";
  className?: string;
  children: React.ReactNode;
}) {
  const styles = {
    brass: "border-[#F2B653]/40 bg-[#F2B653]/15 text-[#F2B653] font-semibold",
    warning: "border-[#F2B653]/40 bg-[#F2B653]/15 text-[#F2B653] font-semibold",
    danger: "border-[#E87945]/50 bg-[#E87945]/15 text-[#E87945] font-bold",
    success: "border-[#35BFC3]/40 bg-[#35BFC3]/15 text-[#35BFC3] font-semibold",
    cyan: "border-[#35BFC3]/40 bg-[#35BFC3]/15 text-[#35BFC3] font-semibold",
    amber: "border-[#F2B653]/40 bg-[#F2B653]/15 text-[#F2B653] font-semibold",
    orange: "border-[#E87945]/50 bg-[#E87945]/15 text-[#E87945] font-semibold",
    violet: "border-[#A78BFA]/40 bg-[#A78BFA]/15 text-[#A78BFA] font-semibold",
    outline: "border-[#24485C] text-[#D8E2E8] bg-[#0D2233]",
    neutral: "border-[#24485C] bg-[#15364A] text-[#F3EEE5]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-mono font-medium border",
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
    border: "border-[#E87945]/60",
    bg: "bg-[#E87945]/10",
    text: "text-[#E87945]",
    badge: "danger",
  },
  ELEVATED: {
    border: "border-[#F2B653]/50",
    bg: "bg-[#F2B653]/15",
    text: "text-[#F2B653]",
    badge: "warning",
  },
  MODERATE: {
    border: "border-[#78958F]/40",
    bg: "bg-[#78958F]/15",
    text: "text-[#78958F]",
    badge: "brass",
  },
  LOW: {
    border: "border-[#24485C]",
    bg: "bg-[#15364A]/50",
    text: "text-[#D8E2E8]",
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
    <div className="space-y-6 pb-16">
      {/* 1. Hero Deck & 3D Maritime Globe Banner */}
      <div className="relative min-h-[320px] lg:min-h-[350px] flex flex-col justify-center overflow-hidden rounded-2xl border border-[#24485C] bg-[#081827] p-6 lg:p-8 shadow-2xl">
        {/* 3D Rotating Maritime Globe in upper right background */}
        <div className="absolute -top-10 -right-8 sm:-top-8 sm:-right-4 w-[560px] sm:w-[720px] lg:w-[920px] h-[380px] sm:h-[440px] lg:h-[480px] pointer-events-none z-0 opacity-95 overflow-hidden">
          <MaritimeGlobe className="w-full h-full pointer-events-auto" height={480} />
          {/* Subtle atmosphere gradient blend masks */}
          <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-[#081827] via-[#081827]/75 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#081827] to-transparent pointer-events-none" />
        </div>

        {/* Floating Weather Widget in upper right (matching reference screenshot) */}
        <div className="absolute top-5 right-5 sm:top-6 sm:right-6 z-10 hidden sm:flex items-center gap-3.5 rounded-xl border border-[#24485C] bg-[#0D2233]/85 backdrop-blur-md px-4 py-2.5 shadow-lg">
          <div>
            <p className="text-[0.62rem] font-mono text-[#D8E2E8]/70 uppercase tracking-wider">Bay of Bengal</p>
            <div className="flex items-center gap-2 mt-0.5">
              <SunMedium className="size-4 text-[#F2B653]" />
              <span className="text-base font-bold text-[#F3EEE5]">28° C</span>
            </div>
          </div>
          <div className="border-l border-[#24485C] pl-3 space-y-0.5 text-[0.65rem] font-mono">
            <p className="text-[#35BFC3] font-semibold">Moderate Seas</p>
            <p className="text-[#D8E2E8]/70">Wind 12 kn | ESE</p>
          </div>
        </div>

        {/* Hero Left Content */}
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#35BFC3] animate-pulse shadow-[0_0_8px_rgba(53,191,195,0.8)]" />
            <span className="text-[0.68rem] font-mono uppercase tracking-[0.16em] text-[#D8E2E8]/70 font-semibold">
              NAVIK <span className="text-[#24485C]">•</span> EAST COAST INDIA DESK <span className="text-[#24485C]">•</span> <span className="text-[#35BFC3]">ACTIVE</span>
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-[#F3EEE5] md:text-5xl">
            Command <span className="text-[#F2B653]">Deck</span>
          </h1>

          <p className="text-xs sm:text-sm leading-relaxed text-[#D8E2E8] font-normal max-w-xl">
            Real-time maritime telemetry, port draft limits, risk alerts, and operational decision
            support for dry-bulk intake across Paradip, Dhamra, Haldia, Vizag, and Gangavaram.
          </p>

          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#24485C] bg-[#15364A] px-3.5 py-2 text-xs font-semibold text-[#F3EEE5] shadow-sm hover:border-[#35BFC3] hover:bg-[#1f435b] transition disabled:opacity-50"
              title="Refresh operational data"
            >
              <RefreshCw
                className={cn("size-3.5", isRefreshing && "animate-spin text-[#35BFC3]")}
              />
              <span>Sync Telemetry</span>
            </button>

            <Link
              to="/market"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#24485C] bg-[#15364A] px-3.5 py-2 text-xs font-semibold text-[#F3EEE5] shadow-sm hover:border-[#F2B653] hover:text-[#F2B653] transition"
            >
              <LineChart className="size-3.5 text-[#F2B653]" />
              <span>Market Terminal</span>
            </Link>

            <Link
              to="/charter"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#F2B653] px-4 py-2 text-xs font-bold text-[#081827] shadow-[0_2px_12px_rgba(242,182,83,0.35)] hover:bg-[#F5C26B] transition"
            >
              <Anchor className="size-3.5 stroke-[2.5]" />
              <span>Launch Charter Workspace</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Operational Bento KPI Ribbon Row 1 */}
      <BentoGrid cols={12}>
        {/* KPI 1: Baltic Dry Index (4 cols) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-4">
          <BentoKpi
            label="Baltic Dry Index"
            value={snapshot ? fmtInt(snapshot.freightIndex) : "1,842"}
            unit="pts"
            changePct={snapshot?.freightIndexChangePct ?? 2.6}
            changeLabel="7D"
            sparklineData={[1740, 1765, 1785, 1810, 1800, 1825, snapshot?.freightIndex ?? 1842]}
            sparklineColor="#35BFC3"
            icon={TrendingUp}
            accentColor="teal"
            glowColor="teal"
            className="h-full relative overflow-hidden"
          />
        </div>

        {/* KPI 2: VLSFO Singapore Fuel (4 cols) */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-4">
          <BentoKpi
            label="VLSFO Singapore"
            value={snapshot ? fmtRate(snapshot.vlsfoUsdPerT) : "$574.00"}
            unit="/t"
            changePct={snapshot?.vlsfoChangePct ?? 4.1}
            changeLabel="7D"
            sparklineData={[545, 552, 558, 564, 560, 568, snapshot?.vlsfoUsdPerT ?? 574]}
            sparklineColor="#F2B653"
            icon={Flame}
            accentColor="amber"
            glowColor="amber"
            className="h-full relative overflow-hidden"
          />
        </div>

        {/* KPI 3: Fleet Basin Readiness Circular Gauge (4 cols) */}
        <BentoCard glowColor="amber" variant="default" className="col-span-12 sm:col-span-12 lg:col-span-4 flex flex-col justify-between">
          <BentoHeader
            eyebrow="Fleet Basin Availability"
            icon={Gauge}
            action={
              <span className="font-mono text-[10px] text-[#D8E2E8] bg-[#0D2233] border border-[#24485C] px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                <MapPin className="size-2.5 text-[#F2B653]" /> Bay of Bengal
              </span>
            }
          />
          <div className="flex items-center justify-around py-2">
            <BentoGauge
              value={snapshot?.fleetAvailabilityPct ?? 79}
              max={100}
              label="READY"
              color="#35BFC3"
              trackColor="#0D2233"
              size={96}
              strokeWidth={8}
            />
            <div className="space-y-1.5 text-xs font-mono">
              <div className="text-[#F3EEE5] font-semibold flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#35BFC3]" />
                <span>Capesize: 74%</span>
              </div>
              <div className="text-[#F3EEE5] font-semibold flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#F2B653]" />
                <span>Panamax: 82%</span>
              </div>
              <div className="text-[11px] text-[#35BFC3] font-semibold pt-1">
                ✓ Adequate spot ballast
              </div>
            </div>
          </div>
        </BentoCard>

        {/* KPI 4: Anchorage Queue (5 cols) */}
        <BentoCard glowColor="violet" variant="default" className="col-span-12 sm:col-span-6 lg:col-span-5 flex flex-col justify-between relative overflow-hidden">
          <BentoHeader
            eyebrow="East Coast Anchorage Queue"
            icon={Clock}
            action={
              <span className="font-mono text-[10px] text-[#A78BFA] bg-[#A78BFA]/15 border border-[#A78BFA]/30 px-2 py-0.5 rounded-md font-semibold">
                {congestionSummary.totalWaitingVessels ?? 48} vessels waiting
              </span>
            }
          />
          <div className="flex items-baseline justify-between pt-1">
            <div>
              <div className="font-mono text-2xl lg:text-3xl font-bold text-[#F3EEE5]">
                {congestionSummary.averageWaitDays ?? 2.3} <span className="text-xs font-normal font-sans text-[#D8E2E8]">days avg</span>
              </div>
              <p className="mt-1 text-xs text-[#D8E2E8]/70 font-mono">
                PRDP: 3.1d · DHMR: 2.4d · HLDA: 1.8d
              </p>
            </div>
            <BentoSparkline
              data={[2.8, 2.7, 2.5, 2.4, 2.3, 2.3, congestionSummary.averageWaitDays ?? 2.3]}
              color="#A78BFA"
              height={36}
              width={110}
            />
          </div>
        </BentoCard>

        {/* KPI 5: Committed Inflow with Mirrored Flow Bar (7 cols) */}
        <BentoCard glowColor="teal" variant="default" className="col-span-12 sm:col-span-6 lg:col-span-7 flex flex-col justify-between relative overflow-hidden">
          <BentoHeader
            eyebrow="Committed Inflow Volume"
            icon={Ship}
            title={`${fmtInt(inflowSummary.totalTonnage || 711000)} t Total Fixed`}
            action={
              <span className="font-mono text-[10px] text-[#D8E2E8] bg-[#0D2233] border border-[#24485C] px-2 py-0.5 rounded-md font-semibold">
                {inflowSummary.activeFixturesCount || 6} active fixtures
              </span>
            }
          />
          <div className="pt-1">
            <BentoFlowBar
              leftLabel="Coking / Thermal Coal"
              leftValue={Math.round((inflowSummary.totalTonnage || 711000) * 0.68)}
              rightLabel="Iron Ore Fines"
              rightValue={Math.round((inflowSummary.totalTonnage || 711000) * 0.32)}
              unit="t"
              leftColor="#35BFC3"
              rightColor="#E87945"
            />
          </div>
        </BentoCard>
      </BentoGrid>

      {/* 3. Interactive Route Canvas & Port Terminal Inspector */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Schematic Map Canvas (7 cols) */}
        <BentoCard glowColor="teal" className="p-5 lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#24485C] pb-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-[#F3EEE5] flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-[#35BFC3]" />
                  Inbound Trade Corridors & Port Nodes
                </h2>
                <p className="text-xs text-[#D8E2E8]">
                  Australia & Indonesia origin hubs to East Coast India terminals. Click any port
                  node to inspect limits.
                </p>
              </div>

              {/* Corridor filter buttons */}
              <BentoSegmented
                value={selectedLaneGroup}
                onChange={(val) => setSelectedLaneGroup(val as "ALL" | "COAL" | "IRON_ORE")}
                options={[
                  { value: "ALL", label: "All Corridors" },
                  { value: "COAL", label: "Coal Lanes" },
                  { value: "IRON_ORE", label: "Ore Lanes" },
                ]}
              />
            </div>

            {/* SVG Animated Route Canvas */}
            <div className="relative rounded-xl border border-[#24485C] bg-[#081827] p-3 overflow-hidden shadow-inner">
              <RouteMap
                title="East Coast India Maritime Corridors"
                lanes={activeLanes}
                highlightPort={selectedPort}
                onPortSelect={(code) => setSelectedPort(code)}
                theme="dark"
                className="w-full max-h-[380px]"
              />
              <div className="absolute bottom-2.5 right-3 text-[10px] font-mono text-[#D8E2E8]/70 bg-[#0D2233]/90 px-2.5 py-0.5 rounded border border-[#24485C]">
                Schematic canvas · Not for navigation
              </div>
            </div>
          </div>

          {/* Quick origin & transit pill reference */}
          <div className="mt-4 pt-3 border-t border-[#24485C] flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[#D8E2E8]/70 font-mono text-[11px]">Primary Load Ports:</span>
            <div className="flex flex-wrap gap-2">
              {ORIGINS.map((o) => (
                <div
                  key={o.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D2233] px-2.5 py-1 border border-[#24485C] text-[11px] font-mono"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#35BFC3]" />
                  <span className="font-semibold text-[#F3EEE5]">{o.loadPort}</span>
                  <span className="text-[#D8E2E8]/70">({o.country})</span>
                </div>
              ))}
            </div>
          </div>
        </BentoCard>

        {/* Right: Terminal Telemetry matching reference image */}
        <BentoCard glowColor="amber" className="p-5 lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#24485C] pb-3 mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#D8E2E8] font-semibold">
                  TERMINAL TELEMETRY
                </span>
                <h3 className="text-lg font-semibold text-[#F3EEE5]">
                  Discharge Congestion
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase px-2.5 py-1 rounded-md border border-[#E87945]/40 bg-[#E87945]/15 text-[#E87945]">
                <span className="size-1.5 rounded-full bg-[#E87945] animate-pulse" />
                CONGESTED
              </span>
            </div>

            {/* 4 Terminal rows with progress bars (matching reference screenshot) */}
            <div className="space-y-3.5 mb-5">
              {[
                { name: "Paradip", code: "PRDP", pct: 92, delta: "+2%", deltaColor: "text-[#E87945]", vessels: "12 vessels", barColor: "bg-[#E87945]" },
                { name: "Dhamra", code: "DHMR", pct: 76, delta: "0%", deltaColor: "text-[#D8E2E8]", vessels: "8 vessels", barColor: "bg-[#F2B653]" },
                { name: "Haldia", code: "HLDA", pct: 68, delta: "+1%", deltaColor: "text-[#F2B653]", vessels: "6 vessels", barColor: "bg-[#F2B653]" },
                { name: "Vizag", code: "VIZG", pct: 54, delta: "-3%", deltaColor: "text-[#35BFC3]", vessels: "4 vessels", barColor: "bg-[#35BFC3]" },
              ].map((item) => (
                <div
                  key={item.code}
                  onClick={() => setSelectedPort(item.code as PortCode)}
                  className={cn(
                    "p-2 rounded-lg border transition-all cursor-pointer",
                    selectedPort === item.code
                      ? "border-[#F2B653] bg-[#15364A] shadow-[0_0_12px_rgba(242,182,83,0.15)]"
                      : "border-[#24485C]/60 bg-[#0D2233] hover:border-[#24485C] hover:bg-[#15364A]",
                  )}
                >
                  <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                    <div className="flex items-center gap-2">
                      <Anchor className="size-3 text-[#D8E2E8]/70" />
                      <span className="font-bold text-[#F3EEE5]">{item.name}</span>
                      <span className="text-[10px] text-[#D8E2E8]/70">({item.code})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#F3EEE5]">{item.pct}%</span>
                      <span className={cn("text-[10px] font-semibold", item.deltaColor)}>
                        {item.delta.startsWith("+") ? `↑ ${item.delta}` : item.delta.startsWith("-") ? `↓ ${item.delta}` : `→ ${item.delta}`}
                      </span>
                      <span className="text-[10px] text-[#D8E2E8]">{item.vessels}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#081827] overflow-hidden border border-[#24485C]/50">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", item.barColor)}
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Port Inspection Panel */}
            <div className="border-t border-[#24485C] pt-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F3EEE5]">
                  {selectedPortDetail.name} Port ({selectedPortDetail.code})
                </span>
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

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-lg border border-[#24485C] bg-[#0D2233] p-2.5">
                  <div className="text-[10px] font-mono text-[#D8E2E8]">Max Draft</div>
                  <div className="text-base font-bold font-mono text-[#F3EEE5]">
                    {selectedPortDetail.maxDraftM.toFixed(1)}m
                  </div>
                  <span className={cn("text-[10px] block mt-0.5 font-semibold", selectedPortDetail.draftRisk ? "text-[#E87945]" : "text-[#35BFC3]")}>
                    {selectedPortDetail.draftRisk ? "Capesize lightering" : "Deepwater ok"}
                  </span>
                </div>

                <div className="rounded-lg border border-[#24485C] bg-[#0D2233] p-2.5">
                  <div className="text-[10px] font-mono text-[#D8E2E8]">Queue / Wait</div>
                  <div className="text-base font-bold font-mono text-[#F3EEE5]">
                    {selectedPortDetail.avgWaitDays.toFixed(1)}d
                  </div>
                  <span className="text-[10px] text-[#D8E2E8] block mt-0.5">
                    {selectedPortDetail.waitingVessels} at anchorage
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#24485C] flex items-center justify-between">
            <span className="text-xs text-[#D8E2E8]/70">Need full berth constraints?</span>
            <Link
              to="/feasibility"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#35BFC3] hover:text-[#50D5D9] transition"
            >
              <span>Port Feasibility Suite</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </BentoCard>
      </div>

      {/* 4. Active Voyage Fixtures Pipeline & Desk Decision History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Active Contracts / Voyage Commitments (7 cols) */}
        <BentoCard glowColor="teal" className="p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[#24485C] pb-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#F3EEE5] flex items-center gap-2">
                <Layers className="size-4 text-[#35BFC3]" />
                Active Voyage Commitments & Fixtures
              </h2>
              <p className="text-xs text-[#D8E2E8]">
                Fixed and pending charter contracts currently lifting raw materials for East Coast
                India.
              </p>
            </div>
            <Link
              to="/contracts"
              className="text-xs font-semibold text-[#35BFC3] hover:text-[#50D5D9] inline-flex items-center gap-1"
            >
              <span>View All Records</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#24485C] text-[#D8E2E8] font-mono">
                  <th className="pb-2.5 font-medium">Vessel / Reference</th>
                  <th className="pb-2.5 font-medium">Class / Cargo</th>
                  <th className="pb-2.5 font-medium">Route</th>
                  <th className="pb-2.5 font-medium text-right">Tonnage</th>
                  <th className="pb-2.5 font-medium text-right">Rate</th>
                  <th className="pb-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24485C]/60">
                {contracts.slice(0, 5).map((c) => {
                  const originDef = ORIGINS.find((o) => o.id === c.origin);
                  return (
                    <tr key={c.id} className="hover:bg-[#15364A]/60 transition">
                      <td className="py-2.5">
                        <div className="font-semibold text-[#F3EEE5]">{c.vesselName}</div>
                        <div className="font-mono text-[10px] text-[#D8E2E8]/70">
                          {c.reference}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {c.vesselClass}
                        </Badge>
                        <div className="text-[10px] text-[#D8E2E8] mt-0.5">{c.type}</div>
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-[#F3EEE5]">
                        {originDef?.loadPort ?? c.origin} → {c.destination}
                      </td>
                      <td className="py-2.5 text-right font-mono font-medium text-[#F3EEE5]">
                        {fmtInt(c.tonnage)} t
                      </td>
                      <td className="py-2.5 text-right font-mono font-medium text-[#F3EEE5]">
                        ${c.rateUsdPerT.toFixed(2)}/t
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge
                          variant={
                            c.status === "FIXED"
                              ? "amber"
                              : c.status === "UNDER_REVIEW"
                                ? "cyan"
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
        </BentoCard>

        {/* Right: Recent Charter Decisions (5 cols) */}
        <BentoCard glowColor="amber" className="p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#24485C] pb-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#F3EEE5] flex items-center gap-2">
                <Compass className="size-4 text-[#F2B653]" />
                Recent Decision Logs
              </h2>
              <p className="text-xs text-[#D8E2E8]">
                Recent decision support logs generated by the chartering engine.
              </p>
            </div>
            <Link
              to="/charter"
              className="text-xs font-semibold text-[#F2B653] hover:text-[#F5C26B] inline-flex items-center gap-1"
            >
              <span>Open Desk</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {recent.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-xl border border-[#24485C] bg-[#0D2233] p-3 hover:border-[#F2B653]/50 hover:bg-[#15364A] transition"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#F3EEE5]">{d.id}</span>
                    <Badge
                      variant={
                        d.decision === "CHARTER_NOW"
                          ? "amber"
                          : d.decision === "WAIT"
                            ? "outline"
                            : "cyan"
                      }
                      className="text-[10px]"
                    >
                      {d.decision.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-[#D8E2E8] font-mono">
                    {fmtInt(d.cargoTonnes)}t {d.cargoType.replace("_", " ")}
                  </div>
                  <div className="text-[10px] text-[#D8E2E8]/70 font-mono">
                    {d.origin} → {d.destination} · {d.vesselClass}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-[#F3EEE5]">
                    ${d.rateUsdPerT.toFixed(2)}/t
                  </div>
                  <div className="text-[10px] font-mono text-[#F2B653] font-medium">
                    {Math.round(d.confidence * 100)}% conf
                  </div>
                  <Link
                    to="/charter"
                    className="text-[10px] font-semibold text-[#35BFC3] hover:underline inline-flex items-center gap-0.5 mt-1"
                  >
                    <span>Evaluate</span>
                    <ArrowUpRight className="size-2.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </BentoCard>
      </div>

      {/* Live Machine Learning Feature Importance & Portfolio Value Insights */}
      <BackendInsightsCard />

      {/* 5. Operational Risk Alerts Feed */}
      <BentoCard glowColor="orange" className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-[#24485C] pb-4 mb-5">
          <div>
            <h2 className="text-base font-semibold text-[#F3EEE5] flex items-center gap-2">
              <ShieldAlert className="size-4 text-[#E87945]" />
              Operational Maritime Risk Alerts
            </h2>
            <p className="text-xs text-[#D8E2E8]">
              Active voyage impediments, meteorological warnings, draft restrictions, and bunker escalations.
            </p>
          </div>

          {/* Alert filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 size-3.5 text-[#D8E2E8]" />
              <input
                type="text"
                placeholder="Filter alerts..."
                value={alertSearch}
                onChange={(e) => setAlertSearch(e.target.value)}
                className="rounded-lg border border-[#24485C] bg-[#0D2233] pl-8 pr-3 py-1.5 text-xs text-[#F3EEE5] placeholder:text-[#D8E2E8]/60 focus:border-[#F2B653] focus:outline-none w-44"
              />
            </div>

            {/* Severity switcher */}
            <BentoSegmented
              value={alertSeverity}
              onChange={(val) => setAlertSeverity(val as "ALL" | RiskLevel)}
              options={(["ALL", "HIGH", "ELEVATED", "MODERATE", "LOW"] as const).map((sev) => ({
                value: sev,
                label: sev,
                badge: String(
                  sev === "ALL" ? alerts.length : alerts.filter((a) => a.severity === sev).length,
                ),
              }))}
            />
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
                  "rounded-xl border p-4 transition-all duration-200 flex flex-col justify-between bg-[#0D2233]/90 backdrop-blur-sm hover:border-[#F2B653]/60",
                  style.border,
                  isHigh && "shadow-[0_0_20px_-8px_rgba(232,121,69,0.35)]",
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      {isHigh && (
                        <span className="relative flex size-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E87945] opacity-75" />
                          <span className="relative inline-flex rounded-full size-2 bg-[#E87945]" />
                        </span>
                      )}
                      <Badge variant={style.badge} className="text-[10px] font-mono">
                        {alert.severity}
                      </Badge>
                    </div>
                    <span className="text-[10px] font-mono text-[#D8E2E8]/70">{alert.id}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-[#F3EEE5] mb-1 tracking-tight">
                    {alert.title}
                  </h4>
                  <p className="text-xs text-[#D8E2E8] leading-relaxed mb-3">
                    {alert.detail}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-[#24485C] flex items-center justify-between text-[11px] font-mono text-[#D8E2E8]/70">
                  <span className="text-[#35BFC3] font-medium">{alert.region}</span>
                  <Link
                    to={targetRoute}
                    className="inline-flex items-center gap-1 text-[11px] text-[#F3EEE5] hover:text-[#F2B653] transition font-medium"
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
          <div className="text-center py-10 text-[#D8E2E8]/70 text-xs font-mono">
            No active risk alerts match your current filter parameters.
          </div>
        )}
      </BentoCard>

      {/* 6. Desk Provenance & Benchmark Model Disclaimer */}
      <div className="rounded-xl border border-[#24485C] bg-[#0D2233] p-4 text-xs text-[#D8E2E8]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info className="size-4 text-[#35BFC3] shrink-0" />
          <span>
            Telemetry and vessel scheduling calibrated against dry-bulk fixtures for East Coast
            India. Benchmark rates referenced to Baltic Exchange and Platts assessments.
          </span>
        </div>
        <div className="font-mono text-[11px] text-[#D8E2E8] whitespace-nowrap">
          Engine: NAVIK Decision Pipeline · Maritime Intelligence Core
        </div>
      </div>
    </div>
  );
}
