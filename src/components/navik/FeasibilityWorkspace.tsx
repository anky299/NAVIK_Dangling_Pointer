/**
 * NAVIK Fleet & Port Feasibility Workspace.
 *
 * Operational terminal for evaluating bulk-carrier naval envelopes against
 * Indian East Coast port depths, berth pockets, river drafts, and unloader outreaches.
 *
 * Supports Paradip (PRDP), Visakhapatnam (VIZG), Gangavaram (GGVM),
 * Dhamra (DHMR), and Haldia (HLDA).
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Eye,
  Filter,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  LineChart,
  Maximize2,
  Navigation,
  RefreshCw,
  Ruler,
  Scale,
  Search,
  ShieldAlert,
  Ship,
  Sparkles,
  Waves,
  XCircle,
} from "lucide-react";
import {
  PORTS,
  VESSEL_CLASSES,
  portByCode,
  vesselById,
  LIGHTERING,
  CARGO_LABELS,
} from "@/lib/api/reference";
import {
  evaluatePortFleetFeasibility,
  evaluateVesselFeasibility,
  type ConstraintCheck,
  type ConstraintStatus,
  type VesselFeasibilityReport,
} from "@/lib/sim/feasibility";
import { congestionQuery, dashboardQuery } from "@/lib/api/queries";
import { fmt1, fmt2, fmtInt, fmtRate, fmtUsd } from "@/lib/format";
import type { CargoType, FeasibilityStatus, PortCode, VesselClassId } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  FeasibilityStatus,
  {
    label: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    icon: typeof CheckCircle2;
  }
> = {
  FEASIBLE: {
    label: "Feasible",
    badgeBg: "bg-emerald-500/10",
    badgeBorder: "border-emerald-500/30",
    badgeText: "text-emerald-400",
    icon: CheckCircle2,
  },
  CONDITIONAL: {
    label: "Conditional",
    badgeBg: "bg-copper/15",
    badgeBorder: "border-copper/40",
    badgeText: "text-copper-soft",
    icon: AlertTriangle,
  },
  REJECTED: {
    label: "Rejected",
    badgeBg: "bg-crimson/15",
    badgeBorder: "border-crimson/40",
    badgeText: "text-crimson",
    icon: XCircle,
  },
};

const CHECK_STATUS_CONFIG: Record<
  ConstraintStatus,
  { label: string; badgeClass: string; icon: typeof CheckCircle2 }
> = {
  PASS: {
    label: "PASS",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    icon: CheckCircle2,
  },
  CONDITIONAL: {
    label: "CONDITIONAL",
    badgeClass: "border-copper/40 bg-copper/10 text-copper-soft",
    icon: AlertTriangle,
  },
  VIOLATION: {
    label: "VIOLATION",
    badgeClass: "border-crimson/40 bg-crimson/10 text-crimson",
    icon: XCircle,
  },
  UNVERIFIED: {
    label: "VERIFICATION NEEDED",
    badgeClass: "border-brass/40 bg-brass/10 text-brass",
    icon: HelpCircle,
  },
};

export function FeasibilityWorkspace() {
  const navigate = useNavigate();

  // Selected state
  const [selectedPortCode, setSelectedPortCode] = useState<PortCode>("PRDP");
  const [selectedVesselId, setSelectedVesselId] = useState<VesselClassId>("CAPESIZE");
  const [selectedCargo, setSelectedCargo] = useState<CargoType>("COKING_COAL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | FeasibilityStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"MATRIX" | "PROFILE" | "TRADE_OFFS">("MATRIX");

  // Queries
  const congQ = useQuery(congestionQuery());
  const dashQ = useQuery(dashboardQuery());

  const congestionList = congQ.data?.ports ?? [];
  const selectedPortCongestion = congestionList.find((p) => p.port === selectedPortCode);

  // Compute fleet feasibility summary for selected port
  const fleetSummary = useMemo(
    () => evaluatePortFleetFeasibility(selectedPortCode, selectedCargo),
    [selectedPortCode, selectedCargo],
  );

  // Active selected vessel report
  const selectedReport = useMemo(() => {
    const found = fleetSummary.reports.find((r) => r.vesselClass.id === selectedVesselId);
    if (found) return found;
    return fleetSummary.reports[0];
  }, [fleetSummary, selectedVesselId]);

  // Filtered vessel reports for the matrix
  const filteredReports = useMemo(() => {
    return fleetSummary.reports.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.vesselClass.name.toLowerCase().includes(q) ||
          r.summaryReason.toLowerCase().includes(q) ||
          r.keyTradeoff.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [fleetSummary, statusFilter, searchQuery]);

  const selectedPort = fleetSummary.port;
  const lightering = LIGHTERING[selectedPortCode];

  // Escalate to charter workspace with query params
  const handleEscalateToCharter = (vesselClassId: VesselClassId) => {
    navigate({
      to: "/charter",
    });
  };

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header & Terminal Controls */}
      <div className="flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-brass animate-pulse" />
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-brass">
              NAUTICAL ENGINEERING · FLEET & PORT SUITABILITY
            </span>
            <span className="rounded border border-border/70 bg-surface/80 px-2 py-0.5 text-[10px] font-mono uppercase text-foreground/70">
              Indian East Coast Intake
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Fleet & Port <span className="text-copper">Feasibility</span>
          </h1>
          <p className="max-w-2xl text-sm text-foreground/70">
            Rigorous evaluation of bulk-carrier particulars (draft, LOA, beam, DWT) against civil,
            nautical, and river limitations across Paradip, Visakhapatnam, Gangavaram, Dhamra, and
            Haldia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper transition"
          >
            <Compass className="h-3.5 w-3.5 text-copper-soft" />
            <span>Command Deck</span>
          </Link>

          <Link
            to="/market"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper transition"
          >
            <LineChart className="h-3.5 w-3.5 text-brass" />
            <span>Market Terminal</span>
          </Link>

          <button
            type="button"
            onClick={() => handleEscalateToCharter(selectedVesselId)}
            className="inline-flex items-center gap-1.5 rounded-md bg-copper px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-copper-soft transition"
          >
            <Anchor className="h-3.5 w-3.5" />
            <span>Escalate to Charter</span>
          </button>
        </div>
      </div>

      {/* 2. Destination Port Selector Ribbon */}
      <div className="rounded-xl border border-border/80 bg-surface/50 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-foreground/60">
              Select Discharge Destination Terminal:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {PORTS.map((p) => {
                const isSelected = p.code === selectedPortCode;
                const isLighteringPort = Boolean(LIGHTERING[p.code]);
                return (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => {
                      setSelectedPortCode(p.code);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition border",
                      isSelected
                        ? "border-copper bg-copper/15 text-copper-soft font-semibold shadow-sm"
                        : "border-border/70 bg-ink/50 text-foreground/80 hover:border-border hover:bg-surface",
                    )}
                  >
                    <Ship
                      className={cn(
                        "h-3.5 w-3.5",
                        isSelected ? "text-copper" : "text-foreground/50",
                      )}
                    />
                    <span className="font-semibold">{p.name}</span>
                    <span className="font-mono text-[10px] text-foreground/50">({p.code})</span>
                    <span className="rounded bg-ink/70 px-1.5 py-0.5 font-mono text-[10px] text-brass border border-border/40">
                      {p.maxDraftM.toFixed(1)}m
                    </span>
                    {isLighteringPort && (
                      <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-mono text-amber-300">
                        Lightering
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cargo Type Filter */}
          <div className="flex items-center gap-2 border-t border-border/50 pt-3 lg:border-t-0 lg:pt-0">
            <span className="text-xs font-mono text-foreground/60 whitespace-nowrap">Cargo:</span>
            <select
              value={selectedCargo}
              onChange={(e) => setSelectedCargo(e.target.value as CargoType)}
              className="rounded-md border border-border bg-ink px-2.5 py-1.5 text-xs text-foreground font-mono focus:border-copper focus:outline-none"
            >
              {(Object.keys(CARGO_LABELS) as CargoType[]).map((c) => (
                <option key={c} value={c}>
                  {CARGO_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Feasibility Summary Metrics Ribbon (Phase 4) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-border/80 bg-surface/50 p-3.5">
          <div className="text-[11px] font-mono uppercase text-foreground/60 mb-1 flex items-center justify-between">
            <span>Evaluated</span>
            <Layers className="h-3.5 w-3.5 text-foreground/50" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {fleetSummary.totalEvaluated}
            <span className="text-xs font-normal text-foreground/50 ml-1">classes</span>
          </div>
          <div className="text-[10px] font-mono text-foreground/50 mt-1">Bulk fleet coverage</div>
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5">
          <div className="text-[11px] font-mono uppercase text-emerald-400 mb-1 flex items-center justify-between">
            <span>Feasible</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">
            {fleetSummary.feasibleCount}
            <span className="text-xs font-normal text-emerald-400/60 ml-1">direct</span>
          </div>
          <div className="text-[10px] font-mono text-emerald-400/70 mt-1">Safe depth & berth</div>
        </div>

        <div className="rounded-lg border border-copper/30 bg-copper/5 p-3.5">
          <div className="text-[11px] font-mono uppercase text-copper-soft mb-1 flex items-center justify-between">
            <span>Conditional</span>
            <AlertTriangle className="h-3.5 w-3.5 text-copper-soft" />
          </div>
          <div className="text-xl font-bold font-mono text-copper">
            {fleetSummary.conditionalCount}
            <span className="text-xs font-normal text-copper/60 ml-1">operational</span>
          </div>
          <div className="text-[10px] font-mono text-copper-soft/70 mt-1">
            Part-laden / Lightered
          </div>
        </div>

        <div className="rounded-lg border border-crimson/30 bg-crimson/5 p-3.5">
          <div className="text-[11px] font-mono uppercase text-crimson mb-1 flex items-center justify-between">
            <span>Rejected</span>
            <XCircle className="h-3.5 w-3.5 text-crimson" />
          </div>
          <div className="text-xl font-bold font-mono text-crimson">
            {fleetSummary.rejectedCount}
            <span className="text-xs font-normal text-crimson/60 ml-1">ineligible</span>
          </div>
          <div className="text-[10px] font-mono text-crimson/70 mt-1">Physical violations</div>
        </div>

        <div className="rounded-lg border border-brass/30 bg-brass/5 p-3.5">
          <div className="text-[11px] font-mono uppercase text-brass mb-1 flex items-center justify-between">
            <span>Verifications</span>
            <HelpCircle className="h-3.5 w-3.5 text-brass" />
          </div>
          <div className="text-xl font-bold font-mono text-brass">
            {fleetSummary.verificationRequiredCount}
            <span className="text-xs font-normal text-brass/60 ml-1">flags</span>
          </div>
          <div className="text-[10px] font-mono text-brass/70 mt-1">Port agent checks</div>
        </div>

        <div className="rounded-lg border border-border/80 bg-surface/50 p-3.5 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-mono uppercase text-foreground/60 mb-1 flex items-center justify-between">
            <span>Queue / Delay</span>
            <Clock className="h-3.5 w-3.5 text-copper" />
          </div>
          <div className="text-xl font-bold font-mono text-foreground">
            {selectedPortCongestion ? selectedPortCongestion.avgWaitDays.toFixed(1) : "2.1"}
            <span className="text-xs font-normal text-foreground/50 ml-1">days</span>
          </div>
          <div className="text-[10px] font-mono text-foreground/50 mt-1">
            {selectedPortCongestion?.waitingVessels ?? 8} vessels anchored
          </div>
        </div>
      </div>

      {/* 4. Tab Switcher: Suitability Matrix vs Port Terminal Profile vs Trade-offs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("MATRIX")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition",
            activeTab === "MATRIX"
              ? "bg-copper text-ink font-semibold shadow-sm"
              : "text-foreground/70 hover:text-foreground hover:bg-surface",
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Vessel Suitability Matrix</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PROFILE")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition",
            activeTab === "PROFILE"
              ? "bg-copper text-ink font-semibold shadow-sm"
              : "text-foreground/70 hover:text-foreground hover:bg-surface",
          )}
        >
          <Ship className="h-3.5 w-3.5" />
          <span>Port & Terminal Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TRADE_OFFS")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition",
            activeTab === "TRADE_OFFS"
              ? "bg-copper text-ink font-semibold shadow-sm"
              : "text-foreground/70 hover:text-foreground hover:bg-surface",
          )}
        >
          <Scale className="h-3.5 w-3.5" />
          <span>Fleet Trade-offs & Recommendations</span>
        </button>
      </div>

      {/* 5. Main Workspace Views */}
      {activeTab === "MATRIX" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 rounded-md border border-border bg-ink/70 p-0.5 text-xs">
              {(["ALL", "FEASIBLE", "CONDITIONAL", "REJECTED"] as const).map((st) => {
                const count =
                  st === "ALL"
                    ? fleetSummary.reports.length
                    : fleetSummary.reports.filter((r) => r.status === st).length;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-mono transition",
                      statusFilter === st
                        ? "bg-copper text-ink font-semibold"
                        : "text-foreground/70 hover:text-foreground",
                    )}
                  >
                    {st} ({count})
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-foreground/40" />
              <input
                type="text"
                placeholder="Filter vessel classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-md border border-border bg-ink/70 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-foreground/40 focus:border-copper focus:outline-none w-56 font-mono"
              />
            </div>
          </div>

          {/* Interactive Matrix Table */}
          <div className="rounded-xl border border-border/80 bg-surface/40 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-ink/60 font-mono text-foreground/60">
                    <th className="py-3 px-4 font-medium">Vessel Class</th>
                    <th className="py-3 px-3 font-medium">Deadweight</th>
                    <th className="py-3 px-3 font-medium">Laden Draft</th>
                    <th className="py-3 px-3 font-medium">LOA · Beam</th>
                    <th className="py-3 px-3 font-medium text-right">Effective Intake</th>
                    <th className="py-3 px-3 font-medium">Port Clearance / Limit</th>
                    <th className="py-3 px-3 font-medium text-right">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredReports.map((report) => {
                    const isSelected = report.vesselClass.id === selectedVesselId;
                    const statusConf = STATUS_CONFIG[report.status];
                    const draftDiff = selectedPort.maxDraftM - report.vesselClass.ladenDraftM;

                    return (
                      <tr
                        key={report.vesselClass.id}
                        onClick={() => setSelectedVesselId(report.vesselClass.id)}
                        className={cn(
                          "cursor-pointer transition hover:bg-surface/60",
                          isSelected ? "bg-copper/10 border-l-2 border-l-copper" : "",
                        )}
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            {report.vesselClass.name}
                            {fleetSummary.recommendedClassId === report.vesselClass.id && (
                              <span className="rounded bg-brass/20 px-1 py-0.2 text-[9px] font-mono text-brass border border-brass/40">
                                Recommended
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-foreground/50">
                            {report.vesselClass.serviceSpeedKn} kn ·{" "}
                            {fmtRate(report.vesselClass.dailyHireUsd)}/d
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono text-foreground">
                          {Math.round(report.vesselClass.dwtMin / 1000)}k–
                          {Math.round(report.vesselClass.dwtMax / 1000)}k t
                        </td>

                        <td className="py-3 px-3 font-mono">
                          <div className="text-foreground">
                            {report.vesselClass.ladenDraftM.toFixed(1)} m
                          </div>
                          <div
                            className={cn(
                              "text-[10px]",
                              draftDiff >= 0
                                ? "text-emerald-400"
                                : draftDiff >= -1.2
                                  ? "text-amber-400"
                                  : "text-crimson",
                            )}
                          >
                            {draftDiff >= 0
                              ? `+${draftDiff.toFixed(1)}m margin`
                              : `${Math.abs(draftDiff).toFixed(1)}m deficit`}
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono text-foreground/80">
                          <div>{report.vesselClass.loaM.toFixed(1)}m LOA</div>
                          <div className="text-[10px] text-foreground/50">
                            {report.vesselClass.beamM.toFixed(1)}m beam
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-medium">
                          <div className="text-foreground">
                            {report.effectiveCapacityT > 0
                              ? `${fmtInt(report.effectiveCapacityT)} t`
                              : "0 t (Ineligible)"}
                          </div>
                          {report.capacityDeratingPct > 0 && (
                            <div className="text-[10px] text-amber-400 font-normal">
                              Derated -{report.capacityDeratingPct}%
                            </div>
                          )}
                          {report.requiresLightering && (
                            <div className="text-[10px] text-copper-soft font-normal">
                              Lightered @ Sandheads
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 text-xs max-w-xs">
                          <div className="text-foreground/90 font-medium truncate">
                            {report.summaryReason}
                          </div>
                          <div className="text-[10px] text-foreground/50 truncate">
                            {report.keyTradeoff}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-mono border",
                              statusConf.badgeBg,
                              statusConf.badgeBorder,
                              statusConf.badgeText,
                            )}
                          >
                            <statusConf.icon className="h-3 w-3" />
                            {statusConf.label}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVesselId(report.vesselClass.id);
                            }}
                            className={cn(
                              "rounded px-2.5 py-1 text-[11px] font-medium transition",
                              isSelected
                                ? "bg-copper text-ink font-semibold"
                                : "border border-border/70 text-foreground/70 hover:border-copper/40 hover:text-foreground",
                            )}
                          >
                            {isSelected ? "Inspecting" : "Inspect"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredReports.length === 0 && (
              <div className="text-center py-12 text-xs font-mono text-foreground/50">
                No vessel classes match the current status filter.
              </div>
            )}
          </div>

          {/* 6. Explainable Constraint Inspector for Selected Vessel (Phase 7) */}
          <div className="rounded-xl border border-border/80 bg-surface/40 p-5 space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-brass">
                  EXPLAINABLE CONSTRAINT INSPECTION
                </span>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-copper" />
                  {selectedReport.vesselClass.name} Candidate vs {selectedPort.name} (
                  {selectedPort.code})
                </h3>
                <p className="text-xs text-foreground/60">
                  Comprehensive engineering checks across draft, length overall, beam, deadweight,
                  and verification items.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-mono font-semibold border",
                    STATUS_CONFIG[selectedReport.status].badgeBg,
                    STATUS_CONFIG[selectedReport.status].badgeBorder,
                    STATUS_CONFIG[selectedReport.status].badgeText,
                  )}
                >
                  Status: {STATUS_CONFIG[selectedReport.status].label}
                </span>

                <button
                  type="button"
                  onClick={() => handleEscalateToCharter(selectedReport.vesselClass.id)}
                  className="inline-flex items-center gap-1 rounded-md bg-copper px-3 py-1 text-xs font-semibold text-ink hover:bg-copper-soft transition"
                >
                  <span>Charter This Class</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Checks Grid */}
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
              {selectedReport.checks.map((check) => {
                const conf = CHECK_STATUS_CONFIG[check.status];
                return (
                  <div
                    key={check.id}
                    className="rounded-lg border border-border/60 bg-ink/50 p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-[10px] text-foreground/50 uppercase">
                          {check.category} CHECK
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono border",
                            conf.badgeClass,
                          )}
                        >
                          <conf.icon className="h-2.5 w-2.5" />
                          {conf.label}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-foreground mb-2">{check.name}</h4>

                      <div className="rounded bg-surface/60 p-2 border border-border/40 font-mono text-[11px] mb-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-foreground/50">Vessel Value:</span>
                          <span className="font-semibold text-foreground">
                            {check.vesselValue} {check.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-foreground/50">Port Limit:</span>
                          <span className="font-semibold text-brass">
                            {check.limitValue} {check.unit}
                          </span>
                        </div>
                        {check.marginLabel && (
                          <div className="flex items-center justify-between pt-1 border-t border-border/30">
                            <span className="text-foreground/50">Margin:</span>
                            <span
                              className={cn(
                                "font-semibold",
                                check.status === "PASS"
                                  ? "text-emerald-400"
                                  : check.status === "VIOLATION"
                                    ? "text-crimson"
                                    : "text-amber-400",
                              )}
                            >
                              {check.marginLabel}
                            </span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-foreground/70 leading-relaxed mb-3">
                        {check.explanation}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/40 text-[11px]">
                      <span className="font-mono text-[10px] text-copper uppercase block mb-0.5">
                        Recommended Desk Action:
                      </span>
                      <span className="text-foreground/80">{check.recommendedAction}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Nautical Safety Disclaimer */}
            <div className="rounded-lg border border-border/60 bg-surface/30 p-3.5 text-xs text-foreground/60 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-brass shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-foreground">
                  Nautical Engineering Advisory Disclaimer
                </span>
                <p>
                  This evaluation is derived from standard design particulars and published port
                  limits. It is not a substitute for official Kolkata / Paradip / Visakhapatnam /
                  Dhamra Port Trust circulars, daily tide tables, Admiralty sailing directions, or
                  Master/Pilot navigation judgment.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Port Terminal Engineering Profile Tab (Phase 6) */}
      {activeTab === "PROFILE" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Port Specifications (7 cols) */}
          <div className="rounded-xl border border-border/80 bg-surface/40 p-5 lg:col-span-7 space-y-5">
            <div className="flex items-start justify-between border-b border-border/50 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-brass">
                  TERMINAL CIVIL & NAUTICAL PARTICULARS
                </span>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-copper" />
                  {selectedPort.name} Port ({selectedPort.code}) · {selectedPort.state}, India
                </h3>
                <span className="text-xs font-mono text-foreground/50">
                  Coordinates: {selectedPort.lat.toFixed(2)}°N, {selectedPort.lon.toFixed(2)}°E
                </span>
              </div>
              <span className="rounded bg-ink/80 px-2 py-1 font-mono text-xs text-copper border border-border/50">
                Max Draft: {selectedPort.maxDraftM.toFixed(1)}m
              </span>
            </div>

            <p className="text-xs text-foreground/80 leading-relaxed italic bg-ink/40 p-3 rounded-lg border border-border/40">
              "{selectedPort.notes}"
            </p>

            {/* Technical Particulars Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/50 bg-ink/40 p-3">
                <div className="text-[10px] font-mono text-foreground/50 uppercase">
                  Max Permissible Draft
                </div>
                <div className="text-lg font-bold font-mono text-foreground">
                  {selectedPort.maxDraftM.toFixed(1)} m
                </div>
                <div className="text-[10px] text-foreground/50 mt-0.5">Approach channel datum</div>
              </div>

              <div className="rounded-lg border border-border/50 bg-ink/40 p-3">
                <div className="text-[10px] font-mono text-foreground/50 uppercase">
                  Max Length (LOA)
                </div>
                <div className="text-lg font-bold font-mono text-foreground">
                  {selectedPort.maxLoaM} m
                </div>
                <div className="text-[10px] text-foreground/50 mt-0.5">Quay pocket envelope</div>
              </div>

              <div className="rounded-lg border border-border/50 bg-ink/40 p-3">
                <div className="text-[10px] font-mono text-foreground/50 uppercase">Max Beam</div>
                <div className="text-lg font-bold font-mono text-foreground">
                  {selectedPort.maxBeamM} m
                </div>
                <div className="text-[10px] text-foreground/50 mt-0.5">Unloader crane reach</div>
              </div>

              <div className="rounded-lg border border-border/50 bg-ink/40 p-3">
                <div className="text-[10px] font-mono text-foreground/50 uppercase">
                  Maximum DWT
                </div>
                <div className="text-lg font-bold font-mono text-foreground">
                  {fmtInt(selectedPort.maxDwt)} t
                </div>
                <div className="text-[10px] text-foreground/50 mt-0.5">Bollard structural pull</div>
              </div>

              <div className="rounded-lg border border-border/50 bg-ink/40 p-3">
                <div className="text-[10px] font-mono text-foreground/50 uppercase">
                  Discharge Rate
                </div>
                <div className="text-lg font-bold font-mono text-foreground">
                  {fmtInt(selectedPort.dischargeRateTpd)} tpd
                </div>
                <div className="text-[10px] text-foreground/50 mt-0.5">Continuous conveyor</div>
              </div>

              <div className="rounded-lg border border-border/50 bg-ink/40 p-3">
                <div className="text-[10px] font-mono text-foreground/50 uppercase">
                  Port Dues / Tariff
                </div>
                <div className="text-lg font-bold font-mono text-foreground">
                  ${selectedPort.portDuesUsdPerT.toFixed(2)} /t
                </div>
                <div className="text-[10px] text-foreground/50 mt-0.5">Pilotage, berth & light</div>
              </div>
            </div>

            {/* Lightering Particulars (if supported) */}
            {lightering && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <Waves className="h-4 w-4" />
                  <span>Offshore Lightering / Transshipment Supported</span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  Due to the Hooghly River navigational bar, deep-draft bulkers (Panamax, Kamsarmax,
                  Capesize) discharge a portion or whole of cargo at{" "}
                  <strong>{lightering.location}</strong>.
                </p>
                <div className="flex items-center gap-4 text-xs font-mono text-amber-300/90 pt-1">
                  <span>Additional Cost: +${lightering.costUsdPerT.toFixed(2)}/t</span>
                  <span>Extra Voyage Duration: +{lightering.extraDays} days</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Operational Telemetry & Compatible Fleet (5 cols) */}
          <div className="rounded-xl border border-border/80 bg-surface/40 p-5 lg:col-span-5 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-border/50 pb-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-brass">
                  OPERATIONAL STATUS & QUEUES
                </span>
                <h4 className="text-base font-semibold text-foreground">
                  Current Anchorage Telemetry
                </h4>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-ink/40 p-3">
                  <span className="text-xs text-foreground/70">Vessels in Anchorage Queue:</span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {selectedPortCongestion?.waitingVessels ?? 8} bulkers
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-ink/40 p-3">
                  <span className="text-xs text-foreground/70">Average Turnaround Wait:</span>
                  <span className="font-mono text-sm font-bold text-copper">
                    {selectedPortCongestion?.avgWaitDays.toFixed(1) ?? "2.1"} days
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-ink/40 p-3">
                  <span className="text-xs text-foreground/70">Berth Occupancy Ratio:</span>
                  <span className="font-mono text-sm font-bold text-foreground">
                    {selectedPortCongestion?.berthOccupancyPct ?? 78}%
                  </span>
                </div>
              </div>

              {/* Compatible Fleet Classes */}
              <div>
                <span className="text-[11px] font-mono text-foreground/60 uppercase block mb-2">
                  Fleet Compatibility Matrix:
                </span>
                <div className="space-y-1.5">
                  {fleetSummary.reports.map((r) => {
                    const st = STATUS_CONFIG[r.status];
                    return (
                      <div
                        key={r.vesselClass.id}
                        className="flex items-center justify-between text-xs p-2 rounded border border-border/40 bg-ink/30"
                      >
                        <span className="font-semibold text-foreground">{r.vesselClass.name}</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono border",
                            st.badgeBg,
                            st.badgeBorder,
                            st.badgeText,
                          )}
                        >
                          <st.icon className="h-3 w-3" />
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/50 flex items-center justify-between">
              <span className="text-xs text-foreground/50">Inspect port congestion?</span>
              <Link
                to="/market"
                className="inline-flex items-center gap-1 text-xs font-semibold text-copper hover:text-copper-soft transition"
              >
                <span>Market Intelligence Tracker</span>
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 8. Fleet Trade-offs & Recommendations Tab (Phase 8) */}
      {activeTab === "TRADE_OFFS" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border/80 bg-surface/40 p-5 space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-brass">
                OPERATIONAL TRADE-OFF COMPARISONS
              </span>
              <h3 className="text-lg font-semibold text-foreground">
                Comparative Fleet Economics for {selectedPort.name}
              </h3>
              <p className="text-xs text-foreground/60">
                Evaluation of freight cost efficiencies versus logistics risk and physical berth
                restrictions.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Supramax / Ultramax Card */}
              <div className="rounded-lg border border-border/70 bg-ink/50 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      Supramax & Ultramax (50k–66k t)
                    </span>
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
                      100% Unconstrained
                    </span>
                  </div>
                  <div className="text-xs text-foreground/80 leading-relaxed mb-3">
                    Enjoys full physical berthing access across all 5 East Coast ports without
                    lightering or short-loading. Lowest draft (12.8m) guarantees prompt berthing
                    even during neap tides.
                  </div>
                  <div className="font-mono text-[11px] text-foreground/60 space-y-1 bg-surface/50 p-2.5 rounded border border-border/40">
                    <div>Draft Margin: Safe (+4.3m at PRDP)</div>
                    <div>Hire Benchmark: ~$14,500/d</div>
                    <div>
                      Trade-off: Higher freight cost per tonne due to smaller cargo parcel size.
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-border/40">
                  <span className="text-[10px] font-mono text-brass block">Best For:</span>
                  <span className="text-xs text-foreground/80">
                    Limestone, minor bulk, or shallow river docks.
                  </span>
                </div>
              </div>

              {/* Panamax / Kamsarmax Card */}
              <div className="rounded-lg border border-border/70 bg-ink/50 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      Panamax & Kamsarmax (70k–85k t)
                    </span>
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
                      Primary Workhorse
                    </span>
                  </div>
                  <div className="text-xs text-foreground/80 leading-relaxed mb-3">
                    The standard industrial workhorse for Indian coking coal and thermal coal
                    intake. Fully compliant with Paradip, Dhamra, Gangavaram, and Visakhapatnam
                    Inner Harbour.
                  </div>
                  <div className="font-mono text-[11px] text-foreground/60 space-y-1 bg-surface/50 p-2.5 rounded border border-border/40">
                    <div>Draft Margin: Safe (+2.9m at PRDP)</div>
                    <div>Hire Benchmark: ~$13,900/d</div>
                    <div>Trade-off: At Haldia, still requires Sandheads lightering.</div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-border/40">
                  <span className="text-[10px] font-mono text-brass block">Best For:</span>
                  <span className="text-xs text-foreground/80">
                    Reliable monthly coal deliveries with minimum demurrage risk.
                  </span>
                </div>
              </div>

              {/* Capesize & Newcastlemax Card */}
              <div className="rounded-lg border border-border/70 bg-ink/50 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      Capesize & Newcastlemax (170k–210k t)
                    </span>
                    <span className="rounded bg-copper/15 px-2 py-0.5 text-[10px] font-mono text-copper-soft border border-copper/40">
                      High Efficiency / Selective
                    </span>
                  </div>
                  <div className="text-xs text-foreground/80 leading-relaxed mb-3">
                    Maximizes economies of scale, slashing ton-mile freight rates by 25–35%.
                    However, fully laden access is limited strictly to Gangavaram and Dhamra
                    deepwater berths.
                  </div>
                  <div className="font-mono text-[11px] text-foreground/60 space-y-1 bg-surface/50 p-2.5 rounded border border-border/40">
                    <div>Draft Margin: Tight (18.1m vs 17.1m PRDP)</div>
                    <div>Hire Benchmark: ~$23,500/d</div>
                    <div>
                      Trade-off: Paradip requires part-laden or tidal surge; Haldia requires
                      Sandheads.
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-border/40">
                  <span className="text-[10px] font-mono text-brass block">Best For:</span>
                  <span className="text-xs text-foreground/80">
                    Massive raw material movements to Gangavaram or Dhamra.
                  </span>
                </div>
              </div>
            </div>

            {/* Strategic Summary Box */}
            <div className="rounded-lg border border-copper/40 bg-copper/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-copper" />
                  Desk Recommendation for {selectedPort.name} ({selectedPort.code})
                </span>
                <p className="text-xs text-foreground/75 leading-relaxed">
                  {fleetSummary.recommendedClassId
                    ? `Optimal operational candidate is ${vesselById(fleetSummary.recommendedClassId).name} for full cargo intake without lightering overhead.`
                    : "No unconstrained vessel class identified. Consider lightering or diversion."}
                </p>
              </div>

              {fleetSummary.recommendedClassId && (
                <button
                  type="button"
                  onClick={() => handleEscalateToCharter(fleetSummary.recommendedClassId!)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-copper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-copper-soft transition whitespace-nowrap"
                >
                  <Anchor className="h-3.5 w-3.5" />
                  <span>Simulate {vesselById(fleetSummary.recommendedClassId).name} Charter</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
