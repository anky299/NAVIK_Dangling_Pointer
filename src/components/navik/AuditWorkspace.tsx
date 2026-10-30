/**
 * NAVIK Audit Trail Workspace.
 *
 * Chronological governance log of decision-support runs, commercial contract lifecycle actions,
 * scenario stress tests, and parameter updates.
 *
 * Explicit transparency: records are maintained in session storage / local fixtures,
 * not a permanent immutable blockchain/enterprise database.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Anchor,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  FileSignature,
  FileText,
  Filter,
  FlaskConical,
  HelpCircle,
  Info,
  Layers,
  LineChart,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Ship,
  Sliders,
  Terminal,
  Trash2,
  Waypoints,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditAction, AuditDiff, AuditEvent } from "@/lib/api/types";
import { filterAuditEvents, formatActionLabel, summarizeAuditTrail } from "@/lib/sim/audit";
import { listAuditEvents, resetAuditStore } from "@/lib/api/services";
import { fmtDateTime } from "@/lib/format";
import { DemoTag, Eyebrow, Metric, PageHeader, PanelHeader } from "./primitives";
import { BentoCard, BentoGrid } from "./Bento";

/* ═══════════════════════════════════════════════
   Audit Workspace Component
   ═══════════════════════════════════════════════ */

export function AuditWorkspace() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditAction | "ALL">("ALL");
  const [entityFilter, setEntityFilter] = useState<string | "ALL">("ALL");
  const [timeframe, setTimeframe] = useState<"ALL" | "24H" | "7D" | "30D">("ALL");
  const [copied, setCopied] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  // Load audit records
  const refreshAuditEvents = async () => {
    setLoading(true);
    try {
      const data = await listAuditEvents();
      setEvents(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAuditEvents();
  }, []);

  // Filtered timeline
  const filtered = useMemo(() => {
    return filterAuditEvents(events, {
      search,
      action: actionFilter,
      entity: entityFilter,
      timeframe,
    });
  }, [events, search, actionFilter, entityFilter, timeframe]);

  // Summary
  const summary = useMemo(() => summarizeAuditTrail(events), [events]);

  // Export JSON handler
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(filtered, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Reset store
  const handleResetStore = () => {
    resetAuditStore();
    refreshAuditEvents();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ── */}
      <PageHeader
        eyebrow="Desk 03 / Governance & Traceability"
        title="Audit"
        accent="trail."
        description="Chronological audit timeline of significant decision-support runs, charter fixes, scenario simulations, and commercial parameter updates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              <span>{copied ? "Copied Log JSON" : "Copy Audit Log"}</span>
            </button>
            <Link
              to="/contracts"
              className="inline-flex items-center gap-1.5 rounded-md bg-copper px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-copper-soft transition-colors"
            >
              <FileSignature className="size-3.5" />
              <span>Contract Register</span>
            </Link>
            <button
              type="button"
              onClick={handleResetStore}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="Reset audit log to baseline"
            >
              <RotateCcw className="size-3" />
            </button>
          </div>
        }
      />

      {/* ── Session Persistence Notice Card ── */}
      <section
        aria-label="Persistence boundary disclosure"
        className="flex flex-col gap-2 rounded-lg border border-border/80 bg-ink/40 p-4 text-xs"
      >
        <div className="flex items-center gap-2 text-brass">
          <Info className="size-4 shrink-0" />
          <h3 className="font-semibold text-foreground text-[0.8rem]">
            Audit Persistence Disclosure & Scope
          </h3>
        </div>
        <p className="text-[0.75rem] leading-relaxed text-muted-foreground">
          Audit entries below record significant decision-support actions within the operational
          session. Enterprise production deployment connects this module to an immutable, write-only
          compliance database with cryptographically signed verification records.
        </p>
      </section>

      {/* ── Audit Summary KPI Strip ── */}
      <section aria-label="Audit summary metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BentoCard glowColor="brass" className="p-3.5 shadow-sm">
          <Metric label="Total Logged Events" value={`${summary.totalEvents}`} unit="" size="sm" />
          <p className="mt-1 text-[0.68rem] text-muted-foreground">
            {summary.todayCount} logged today
          </p>
        </BentoCard>
        <BentoCard glowColor="coral" className="p-3.5 shadow-sm">
          <Metric
            label="Governance Alerts"
            value={`${summary.governanceAlertCount}`}
            unit=""
            size="sm"
          />
          <p className="mt-1 text-[0.68rem] text-muted-foreground">Overrides & status changes</p>
        </BentoCard>
        <BentoCard glowColor="walnut" className="p-3.5 shadow-sm">
          <Metric
            label="Unique Actors"
            value={`${summary.uniqueActors.length}`}
            unit="operators"
            size="sm"
          />
          <p className="mt-1 text-[0.68rem] text-muted-foreground">Desk analysts & scheduler</p>
        </BentoCard>
        <BentoCard glowColor="rose" className="p-3.5 shadow-sm">
          <Metric
            label="Active Entities"
            value={`${Object.keys(summary.entityBreakdown).length}`}
            unit="domains"
            size="sm"
          />
          <p className="mt-1 text-[0.68rem] text-muted-foreground">
            Contracts, scenarios & decisions
          </p>
        </BentoCard>
      </section>

      {/* ── Filter Controls ── */}
      <section
        aria-label="Audit filters"
        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search event ID, actor, entity, description, diff..."
              className="w-full rounded-md border border-border/80 bg-background/80 py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-copper focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as any)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Actions</option>
              <option value="CONTRACT_CREATED">Contract Created</option>
              <option value="CONTRACT_STATUS_CHANGED">Status Transition</option>
              <option value="CONTRACT_UPDATED">Terms Updated</option>
              <option value="DECISION_APPROVED">Decision Approved</option>
              <option value="DECISION_OVERRIDDEN">Decision Overridden</option>
              <option value="ANALYSIS_RUN">Analysis Run</option>
              <option value="SCENARIO_RUN">Scenario Run</option>
              <option value="VERIFICATION_COMPLETED">Check Verified</option>
              <option value="SETTINGS_CHANGED">Settings Changed</option>
              <option value="DATA_REFRESH">Data Refresh</option>
            </select>

            {/* Entity Filter */}
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Entities</option>
              <option value="Contract">Contract</option>
              <option value="Decision report">Decision report</option>
              <option value="Charter analysis">Charter analysis</option>
              <option value="Scenario">Scenario</option>
              <option value="Market data">Market data</option>
              <option value="Workspace">Workspace</option>
            </select>

            {/* Timeframe Filter */}
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as any)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Time</option>
              <option value="24H">Last 24 Hours</option>
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Chronological Audit Timeline Stream ── */}
      <section aria-label="Audit timeline" className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
            <p className="text-sm">
              No audit records match your active search and filter criteria.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setActionFilter("ALL");
                setEntityFilter("ALL");
                setTimeframe("ALL");
              }}
              className="mt-2 text-xs font-mono text-copper hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((event) => (
              <AuditTimelineItem
                key={event.id}
                event={event}
                onSelect={() => setSelectedEvent(event)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Event Detail Modal ── */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="size-4 text-copper" />
                  <h3 className="font-mono text-sm font-bold text-foreground">
                    Audit Event: {selectedEvent.id}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Timestamp:</span>
                  <p className="font-mono text-foreground">
                    {fmtDateTime(selectedEvent.timestamp)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Action:</span>
                  <p className="font-mono font-medium text-foreground">
                    {formatActionLabel(selectedEvent.action)} ({selectedEvent.action})
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Actor:</span>
                  <p className="font-mono text-foreground">{selectedEvent.actor}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Entity:</span>
                  <p className="text-foreground">
                    {selectedEvent.entity} · ID: {selectedEvent.entityId}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Detail:</span>
                  <p className="text-foreground leading-relaxed bg-ink/30 p-2.5 rounded border border-border/60">
                    {selectedEvent.detail}
                  </p>
                </div>

                {/* Diff */}
                {selectedEvent.diff && selectedEvent.diff.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Recorded Changes:</span>
                    <div className="mt-1 flex flex-col gap-1.5 rounded border border-border/70 bg-background/50 p-2.5">
                      {selectedEvent.diff.map((d) => (
                        <div
                          key={d.field}
                          className="flex items-center justify-between font-mono text-[0.7rem]"
                        >
                          <span className="text-muted-foreground">{d.field}:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="line-through text-danger">
                              {String(d.previousValue ?? "null")}
                            </span>
                            <ArrowRight className="size-2.5 text-muted-foreground" />
                            <span className="text-success font-semibold">
                              {String(d.newValue ?? "null")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                {selectedEvent.relatedPath ? (
                  <Link
                    to={selectedEvent.relatedPath as any}
                    className="inline-flex items-center gap-1 text-xs font-mono text-copper hover:underline"
                  >
                    <span>Navigate to related workspace</span>
                    <ExternalLink className="size-3" />
                  </Link>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Timeline Item Component
   ═══════════════════════════════════════════════ */

interface TimelineItemProps {
  event: AuditEvent;
  onSelect: () => void;
}

function AuditTimelineItem({ event, onSelect }: TimelineItemProps) {
  const getActionIcon = () => {
    switch (event.action) {
      case "CONTRACT_CREATED":
      case "CONTRACT_STATUS_CHANGED":
      case "CONTRACT_UPDATED":
        return <FileSignature className="size-3.5 text-copper" />;
      case "DECISION_OVERRIDDEN":
        return <ShieldAlert className="size-3.5 text-danger" />;
      case "DECISION_APPROVED":
        return <CheckCircle2 className="size-3.5 text-success" />;
      case "SCENARIO_RUN":
        return <FlaskConical className="size-3.5 text-brass" />;
      case "ANALYSIS_RUN":
        return <Anchor className="size-3.5 text-sea" />;
      case "VERIFICATION_COMPLETED":
        return <FileCheck className="size-3.5 text-success" />;
      default:
        return <Clock className="size-3.5 text-muted-foreground" />;
    }
  };

  const getTargetWorkspaceLink = (): { to: string; label: string } | null => {
    if (event.relatedPath) {
      return { to: event.relatedPath, label: "View" };
    }
    if (event.entity === "Contract") return { to: "/contracts", label: "Contracts" };
    if (event.entity === "Decision report" || event.entity === "Charter analysis")
      return { to: "/charter", label: "Charter" };
    if (event.entity === "Scenario") return { to: "/scenarios", label: "Scenario" };
    if (event.entity === "Market data") return { to: "/market", label: "Market" };
    return null;
  };

  const targetLink = getTargetWorkspaceLink();

  return (
    <div
      onClick={onSelect}
      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-card p-3.5 text-xs shadow-sm hover:border-copper/40 hover:bg-ink/20 cursor-pointer transition-colors"
    >
      <div className="flex items-start sm:items-center gap-3">
        {/* Action Icon */}
        <div className="mt-0.5 sm:mt-0 flex size-7 shrink-0 items-center justify-center rounded bg-ink/50 border border-border/80">
          {getActionIcon()}
        </div>

        {/* Content Details */}
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.68rem] font-semibold text-foreground">
              {event.id}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.2 font-mono text-[0.62rem] uppercase text-muted-foreground">
              {formatActionLabel(event.action)}
            </span>
            <span className="text-[0.68rem] text-muted-foreground font-mono">by {event.actor}</span>
          </div>

          <p className="text-foreground text-[0.76rem] font-medium leading-relaxed">
            {event.detail}
          </p>

          {/* Diffs */}
          {event.diff && event.diff.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2 text-[0.68rem] font-mono">
              {event.diff.map((d) => (
                <span
                  key={d.field}
                  className="inline-flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 border border-border/60"
                >
                  <span className="text-muted-foreground">{d.field}:</span>
                  <span className="line-through text-danger/80">
                    {String(d.previousValue ?? "null")}
                  </span>
                  <ArrowRight className="size-2 text-muted-foreground" />
                  <span className="text-success font-semibold">{String(d.newValue ?? "null")}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timestamp & Link */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
        <span className="font-mono text-[0.68rem] text-muted-foreground">
          {fmtDateTime(event.timestamp)}
        </span>

        {targetLink && (
          <Link
            to={targetLink.to as any}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-1 font-mono text-[0.65rem] text-copper-soft hover:bg-muted hover:text-foreground"
          >
            <span>{targetLink.label}</span>
            <ExternalLink className="size-2.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
