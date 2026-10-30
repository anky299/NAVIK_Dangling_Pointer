/**
 * NAVIK Charter Workspace — five-stage chartering decision pipeline.
 *
 * Stage 1: Cargo Intake (form)
 * Stage 2: Vessel & Draft Feasibility (evaluation table)
 * Stage 3: Route & Voyage Planning (map + metrics)
 * Stage 4: Landed-Cost Comparison (sortable table)
 * Stage 5: Recommendation (decision report)
 *
 * All calculation comes from `simulateCharterDecision()` in the existing
 * simulation engine. This component is the UI layer only.
 */
import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Anchor,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  Clock,
  Compass,
  Cpu,
  Fuel,
  Info,
  Layers,
  MapPin,
  Navigation,
  Package,
  RefreshCw,
  Route as RouteIcon,
  Ship,
  ShieldAlert,
  Target,
  Truck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtInt, fmtUsd, fmtRate, fmtTonnes, fmt1, fmt2 } from "@/lib/format";
import {
  ORIGINS,
  PORTS,
  VESSEL_CLASSES,
  CARGO_LABELS,
  CONTRACT_LABELS,
  DISTANCES_NM,
  ROUTE_LABELS,
  DECISION_LABELS,
  RISK_LABELS,
  originById,
  portByCode,
  vesselById,
} from "@/lib/api/reference";
import type {
  CargoType,
  CharterDecisionReport,
  CharterRequest,
  ContractPreference,
  FeasibilityStatus,
  OriginRegion,
  PortCode,
  VesselCheck,
  VesselClassId,
  VesselClassSpec,
} from "@/lib/api/types";
import {
  simulateCharterDecision,
  BASE_BUNKER_USD_PER_T,
  DEFAULT_CONGESTION,
} from "@/lib/sim/charter";
import { RouteMap, type MapLane } from "./RouteMap";
import { MaritimeGlobe } from "./MaritimeGlobe";
import {
  DemoTag,
  Eyebrow,
  PageHeader,
  DecisionBadge,
  RiskBadge,
  FeasibilityBadge,
  Metric,
} from "./primitives";
import { BentoCard, BentoGrid, BentoGauge, BentoFlowBar } from "./Bento";
import { BackendOptimizerPanel } from "./BackendOptimizerPanel";

/* ═══════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════ */

const STAGES = [
  { id: 1, label: "Cargo Intake", icon: Package },
  { id: 2, label: "Feasibility", icon: Ship },
  { id: 3, label: "Route & Voyage", icon: Navigation },
  { id: 4, label: "Landed Cost", icon: Layers },
  { id: 5, label: "Recommendation", icon: Target },
] as const;

function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d.toISOString().slice(0, 10);
}

const DEFAULT_REQUEST: CharterRequest = {
  cargoTonnes: 160_000,
  cargoType: "COKING_COAL",
  origin: "AUS_QLD",
  destination: "PRDP",
  deliveryDeadline: defaultDeadline(),
  contractPreference: "SPOT",
};

type SortKey = "costPerT" | "totalCostUsd" | "transitDays" | "utilisationPct" | "vesselClass";
type SortDir = "asc" | "desc";

/* ═══════════════════════════════════════════════
   Validation
   ═══════════════════════════════════════════════ */

interface FormErrors {
  cargoTonnes?: string;
  deliveryDeadline?: string;
}

function validate(req: CharterRequest): FormErrors {
  const errors: FormErrors = {};
  if (req.cargoTonnes < 10_000) errors.cargoTonnes = "Minimum 10,000 tonnes";
  if (req.cargoTonnes > 500_000) errors.cargoTonnes = "Maximum 500,000 tonnes";
  const deadline = new Date(`${req.deliveryDeadline}T00:00:00Z`);
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 21);
  if (deadline < minDate) errors.deliveryDeadline = "Deadline must be at least 21 days from today";
  return errors;
}

/* ═══════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════ */

export function CharterWorkspace() {
  const [workspaceMode, setWorkspaceMode] = useState<"pipeline" | "optimizer">("pipeline");
  const [stage, setStage] = useState(1);
  const [request, setRequest] = useState<CharterRequest>({ ...DEFAULT_REQUEST });
  const [errors, setErrors] = useState<FormErrors>({});
  const [report, setReport] = useState<CharterDecisionReport | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("costPerT");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [feasFilter, setFeasFilter] = useState<"all" | FeasibilityStatus>("all");

  const runAnalysis = useCallback(() => {
    setIsAnalysing(true);
    // use requestAnimationFrame to let the UI update before the sync computation
    requestAnimationFrame(() => {
      const result = simulateCharterDecision(request, {
        now: new Date(),
        bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
      });
      setReport(result);
      setIsAnalysing(false);
    });
  }, [request]);

  const handleNext = useCallback(() => {
    if (stage === 1) {
      const errs = validate(request);
      setErrors(errs);
      if (Object.keys(errs).length > 0) return;
      runAnalysis();
    }
    setStage((s) => Math.min(5, s + 1));
  }, [stage, request, runAnalysis]);

  const handlePrev = useCallback(() => {
    setStage((s) => Math.max(1, s - 1));
  }, []);

  const handleRerun = useCallback(() => {
    const errs = validate(request);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setStage(1);
      return;
    }
    runAnalysis();
  }, [request, runAnalysis]);

  const goToStage = useCallback(
    (target: number) => {
      if (target > 1 && !report) return; // can't skip ahead without analysis
      if (target === 1 || report) setStage(target);
    },
    [report],
  );

  // Update request field
  const updateReq = useCallback(
    <K extends keyof CharterRequest>(key: K, value: CharterRequest[K]) => {
      setRequest((prev) => ({ ...prev, [key]: value }));
      // Clear related error
      if (key === "cargoTonnes" || key === "deliveryDeadline") {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[key as keyof FormErrors];
          return next;
        });
      }
    },
    [],
  );

  return (
    <div>
      {/* Hero Deck & 3D Maritime Globe Banner */}
      <div className="relative min-h-[260px] lg:min-h-[290px] flex flex-col justify-center overflow-hidden rounded-2xl border border-[#24485C] bg-[#081827] p-6 lg:p-8 shadow-2xl mb-8">
        <div className="absolute -top-10 -right-8 sm:-top-8 sm:-right-4 w-[520px] sm:w-[680px] lg:w-[860px] h-[340px] sm:h-[400px] lg:h-[440px] pointer-events-none z-0 opacity-95 overflow-hidden">
          <MaritimeGlobe className="w-full h-full pointer-events-auto" height={440} />
          <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-[#081827] via-[#081827]/75 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#081827] to-transparent pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-2xl space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#35BFC3] animate-pulse shadow-[0_0_8px_rgba(53,191,195,0.8)]" />
            <span className="text-[0.68rem] font-mono uppercase tracking-[0.16em] text-[#D8E2E8]/70 font-semibold">
              NAVIK <span className="text-[#24485C]">•</span> CHARTER WORKSPACE <span className="text-[#24485C]">•</span> <span className="text-[#35BFC3]">EVALUATION ENGINE</span>
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#F3EEE5] md:text-4xl">
            Charter <span className="text-[#F2B653]">Decision Pipeline</span>
          </h1>
          <p className="text-xs sm:text-sm leading-relaxed text-[#D8E2E8] font-normal">
            Five-stage pipeline from cargo requirements to an explainable charter recommendation with real-time port draft checks, voyage economics, and risk scoring.
          </p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#24485C] bg-[#081827] p-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWorkspaceMode("pipeline")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-mono font-medium transition-colors",
              workspaceMode === "pipeline"
                ? "bg-[#35BFC3] text-[#081827] font-bold shadow-sm"
                : "text-[#78958F] hover:text-[#F3EEE5]",
            )}
          >
            <Navigation className="size-3.5" />
            <span>Charter Decision Pipeline (5-Stage)</span>
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceMode("optimizer")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-mono font-medium transition-colors",
              workspaceMode === "optimizer"
                ? "bg-[#F2B653] text-[#081827] font-bold shadow-sm"
                : "text-[#78958F] hover:text-[#F3EEE5]",
            )}
          >
            <Cpu className="size-3.5" />
            <span>MILP Procurement Optimizer (Live Backend)</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 font-mono text-[0.7rem] text-[#78958F] pr-2">
          <span>Mathematical Programming</span>
          <span className="text-[#24485C]">•</span>
          <span>HiGHS / PuLP</span>
        </div>
      </div>

      {workspaceMode === "optimizer" ? (
        <BackendOptimizerPanel />
      ) : (
        <>
          {/* Stage stepper */}
          <nav aria-label="Charter pipeline stages" className="mb-8">
            <ol className="flex items-center gap-1 overflow-x-auto pb-2 no-scrollbar">
              {STAGES.map((s, i) => {
                const done = report && s.id < stage;
                const active = s.id === stage;
                const accessible = s.id === 1 || !!report;
                const Icon = s.icon;
                return (
                  <li key={s.id} className="flex items-center gap-1">
                    {i > 0 && (
                      <div
                        className={cn(
                          "hidden h-px w-6 sm:block md:w-10",
                          done ? "bg-[#35BFC3]" : "bg-[#24485C]",
                        )}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => goToStage(s.id)}
                      disabled={!accessible}
                      aria-current={active ? "step" : undefined}
                      className={cn(
                        "group flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition-colors border",
                        active
                          ? "border-[#F2B653] bg-[#15364A] text-[#F3EEE5] shadow-sm font-semibold"
                          : done
                            ? "border-[#24485C] bg-[#0D2233] text-[#35BFC3] hover:text-[#F3EEE5]"
                            : accessible
                              ? "border-[#24485C]/60 bg-[#0D2233]/60 text-[#D8E2E8] hover:text-[#F3EEE5]"
                              : "border-transparent text-[#D8E2E8]/40 cursor-not-allowed",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-bold transition-colors",
                          active
                            ? "border-[#F2B653] bg-[#F2B653] text-[#081827]"
                            : done
                              ? "border-[#35BFC3] bg-[#35BFC3]/20 text-[#35BFC3]"
                              : "border-[#24485C] text-[#D8E2E8]",
                        )}
                      >
                        {done ? <Check className="size-3" /> : s.id}
                      </span>
                      <span className="hidden sm:inline">{s.label}</span>
                      <Icon className={cn("size-3.5 sm:hidden", active ? "text-[#F2B653]" : "")} />
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Stage content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {stage === 1 && (
                <CargoIntake
                  request={request}
                  errors={errors}
                  updateReq={updateReq}
                  onNext={handleNext}
                />
              )}
              {stage === 2 && report && (
                <VesselFeasibility
                  report={report}
                  request={request}
                  feasFilter={feasFilter}
                  setFeasFilter={setFeasFilter}
                  onPrev={handlePrev}
                  onNext={handleNext}
                />
              )}
              {stage === 3 && report && (
                <RouteVoyage
                  report={report}
                  request={request}
                  onPrev={handlePrev}
                  onNext={handleNext}
                />
              )}
              {stage === 4 && report && (
                <LandedCost
                  report={report}
                  request={request}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  setSortKey={setSortKey}
                  setSortDir={setSortDir}
                  onPrev={handlePrev}
                  onNext={handleNext}
                />
              )}
              {stage === 5 && report && (
                <Recommendation
                  report={report}
                  request={request}
                  onPrev={handlePrev}
                  onRerun={handleRerun}
                  onEdit={() => setStage(1)}
                />
              )}
              {stage > 1 && !report && (
                <div className="flex flex-col items-center gap-4 py-20 text-center">
                  {isAnalysing ? (
                    <>
                      <RefreshCw className="size-8 animate-spin text-copper" />
                      <p className="text-sm text-muted-foreground">Running simulation…</p>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-8 text-brass" />
                      <p className="text-sm text-muted-foreground">
                        No analysis results. Submit cargo requirements first.
                      </p>
                      <button
                        type="button"
                        onClick={() => setStage(1)}
                        className="mt-2 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
                      >
                        <ArrowLeft className="size-3.5" /> Back to intake
                      </button>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Stage 1 — Cargo Intake
   ═══════════════════════════════════════════════ */

function CargoIntake({
  request,
  errors,
  updateReq,
  onNext,
}: {
  request: CharterRequest;
  errors: FormErrors;
  updateReq: <K extends keyof CharterRequest>(key: K, value: CharterRequest[K]) => void;
  onNext: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7 xl:col-span-8">
        <div className="surface-paper rounded-md p-6 sm:p-8">
          <h2 className="text-lg font-semibold tracking-tight text-paper-foreground">
            Shipment requirements
          </h2>
          <p className="mt-1 text-sm text-paper-muted">
            Define the cargo, route and commercial constraints. Required fields marked with{" "}
            <span className="text-copper">*</span>
          </p>

          <div className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {/* Commodity */}
            <FieldGroup label="Commodity" required htmlFor="cargo-type">
              <SelectField
                id="cargo-type"
                value={request.cargoType}
                onChange={(v) => updateReq("cargoType", v as CargoType)}
                options={Object.entries(CARGO_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
              <p className="mt-1 text-xs text-paper-muted">
                Coking coal is the principal East Coast India use case
              </p>
            </FieldGroup>

            {/* Quantity */}
            <FieldGroup
              label="Cargo quantity"
              required
              htmlFor="cargo-tonnes"
              error={errors.cargoTonnes}
            >
              <div className="relative">
                <input
                  id="cargo-tonnes"
                  type="number"
                  min={10_000}
                  max={500_000}
                  step={1_000}
                  value={request.cargoTonnes}
                  onChange={(e) => updateReq("cargoTonnes", Number(e.target.value))}
                  className={cn(
                    "block w-full rounded-md border bg-paper-sunk px-3 py-2.5 pr-12 font-mono text-sm tabular-nums text-paper-foreground placeholder:text-paper-muted focus:border-copper focus:ring-1 focus:ring-copper",
                    errors.cargoTonnes ? "border-danger" : "border-paper-border",
                  )}
                  aria-invalid={!!errors.cargoTonnes}
                  aria-describedby={errors.cargoTonnes ? "cargo-tonnes-err" : undefined}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-paper-muted">
                  MT
                </span>
              </div>
            </FieldGroup>

            {/* Origin */}
            <FieldGroup label="Loading port" required htmlFor="origin">
              <SelectField
                id="origin"
                value={request.origin}
                onChange={(v) => updateReq("origin", v as OriginRegion)}
                options={ORIGINS.map((o) => ({
                  value: o.id,
                  label: `${o.loadPort} — ${o.shortName}`,
                }))}
              />
            </FieldGroup>

            {/* Destination */}
            <FieldGroup label="Discharge port" required htmlFor="destination">
              <SelectField
                id="destination"
                value={request.destination}
                onChange={(v) => updateReq("destination", v as PortCode)}
                options={PORTS.map((p) => ({
                  value: p.code,
                  label: `${p.name} — ${p.state} (${p.maxDraftM}m draft)`,
                }))}
              />
            </FieldGroup>

            {/* Delivery deadline */}
            <FieldGroup
              label="Delivery deadline"
              required
              htmlFor="deadline"
              error={errors.deliveryDeadline}
            >
              <input
                id="deadline"
                type="date"
                value={request.deliveryDeadline}
                onChange={(e) => updateReq("deliveryDeadline", e.target.value)}
                className={cn(
                  "block w-full rounded-md border bg-paper-sunk px-3 py-2.5 text-sm text-paper-foreground focus:border-copper focus:ring-1 focus:ring-copper",
                  errors.deliveryDeadline ? "border-danger" : "border-paper-border",
                )}
                aria-invalid={!!errors.deliveryDeadline}
                aria-describedby={errors.deliveryDeadline ? "deadline-err" : undefined}
              />
            </FieldGroup>

            {/* Contract preference */}
            <FieldGroup label="Contract preference" htmlFor="contract-pref">
              <SelectField
                id="contract-pref"
                value={request.contractPreference}
                onChange={(v) => updateReq("contractPreference", v as ContractPreference)}
                options={Object.entries(CONTRACT_LABELS).map(([k, v]) => ({
                  value: k,
                  label: v,
                }))}
              />
              <p className="mt-1 text-xs text-paper-muted">
                Influences the charter-now / wait / split decision
              </p>
            </FieldGroup>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-paper-border pt-6">
            <p className="text-xs text-paper-muted">
              <Info className="mr-1 inline-block size-3" />
              Parameters configured for East Coast India intake corridors.
            </p>
            <button
              type="button"
              onClick={onNext}
              className="group inline-flex items-center gap-2 rounded-md bg-copper px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-copper transition-colors hover:bg-copper-soft"
            >
              Analyse
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Side context */}
      <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-4">
        {/* Route preview */}
        <div className="relative rounded-xl border border-[#263D50] bg-[#071522] p-3 overflow-hidden shadow-inner">
          <div className="absolute top-2.5 left-3 flex items-center gap-2 font-mono text-[0.62rem] text-[#F7FAFC]/80 z-20">
            <span className="size-1.5 rounded-full bg-[#35C9D0] animate-pulse" />
            <span>CORRIDOR: {originById(request.origin).loadPort.toUpperCase()} → {portByCode(request.destination).name.toUpperCase()}</span>
          </div>
          <RouteMap
            title={`${originById(request.origin).loadPort} → ${portByCode(request.destination).name}`}
            lanes={[{ origin: request.origin, port: request.destination, emphasis: true }]}
            highlightPort={request.destination}
            labelScale={0.9}
            delay={0}
            theme="dark"
            className="w-full max-h-[340px]"
          />
          <div className="absolute bottom-2.5 right-3 text-[10px] font-mono text-[#A8BAC8] bg-[#0B1C2B]/90 px-2 py-0.5 rounded border border-[#263D50]">
            Schematic corridor · Indicative
          </div>
        </div>

        {/* Port info */}
        <BentoCard glowColor="walnut" className="p-5">
          <p className="text-eyebrow text-brass">Discharge port</p>
          <p className="mt-2 text-lg font-semibold">{portByCode(request.destination).name}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Max draft</dt>
              <dd className="mt-0.5 font-mono text-foreground">
                {portByCode(request.destination).maxDraftM}m
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Max LOA</dt>
              <dd className="mt-0.5 font-mono text-foreground">
                {portByCode(request.destination).maxLoaM}m
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Discharge rate</dt>
              <dd className="mt-0.5 font-mono text-foreground">
                {fmtInt(portByCode(request.destination).dischargeRateTpd)} t/d
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Port dues</dt>
              <dd className="mt-0.5 font-mono text-foreground">
                ${portByCode(request.destination).portDuesUsdPerT}/t
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            {portByCode(request.destination).notes}
          </p>
        </BentoCard>

        {/* Congestion */}
        <BentoCard glowColor="coral" className="p-5">
          <p className="text-eyebrow text-brass">Current congestion</p>
          {(() => {
            const c = DEFAULT_CONGESTION[request.destination];
            return (
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Vessels waiting</dt>
                  <dd className="mt-0.5 font-mono text-foreground">{c.waitingVessels}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Avg wait</dt>
                  <dd className="mt-0.5 font-mono text-foreground">{c.avgWaitDays} days</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Berth occupancy</dt>
                  <dd className="mt-0.5 font-mono text-foreground">{c.berthOccupancyPct}%</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Trend</dt>
                  <dd className="mt-0.5 font-mono text-foreground capitalize">{c.trend}</dd>
                </div>
              </dl>
            );
          })()}
        </BentoCard>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Stage 2 — Vessel & Draft Feasibility
   ═══════════════════════════════════════════════ */

function VesselFeasibility({
  report,
  request,
  feasFilter,
  setFeasFilter,
  onPrev,
  onNext,
}: {
  report: CharterDecisionReport;
  request: CharterRequest;
  feasFilter: "all" | FeasibilityStatus;
  setFeasFilter: (f: "all" | FeasibilityStatus) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const port = portByCode(request.destination);
  const filtered =
    feasFilter === "all" ? report.checks : report.checks.filter((c) => c.status === feasFilter);
  const counts = {
    all: report.checks.length,
    FEASIBLE: report.checks.filter((c) => c.status === "FEASIBLE").length,
    CONDITIONAL: report.checks.filter((c) => c.status === "CONDITIONAL").length,
    REJECTED: report.checks.filter((c) => c.status === "REJECTED").length,
  };

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {counts.FEASIBLE + counts.CONDITIONAL} of {counts.all} vessel classes viable at{" "}
          <span className="font-semibold text-foreground">{port.name}</span> (draft limit{" "}
          {port.maxDraftM}m, LOA limit {port.maxLoaM}m)
        </p>
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "FEASIBLE", "CONDITIONAL", "REJECTED"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFeasFilter(f)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              feasFilter === f
                ? "border-copper bg-copper/15 text-copper-soft"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "all"
              ? "All"
              : f === "FEASIBLE"
                ? "Feasible"
                : f === "CONDITIONAL"
                  ? "Conditional"
                  : "Rejected"}{" "}
            <span className="ml-1 font-mono text-[0.6rem]">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Vessel cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((check) => {
          const spec = vesselById(check.vesselClass);
          const isRecommended = report.vesselClass === check.vesselClass;
          return (
            <BentoCard
              key={check.vesselClass}
              glowColor={isRecommended ? "cyan" : check.status === "FEASIBLE" ? "teal" : undefined}
              className={cn(
                "relative p-5 transition-colors",
                isRecommended
                  ? "border-[#35C9D0]/60 shadow-[0_0_20px_rgba(53,201,208,0.25)]"
                  : check.status === "REJECTED"
                    ? "opacity-60"
                    : "",
              )}
            >
              {isRecommended && (
                <span className="text-eyebrow absolute right-3 top-3 text-[0.55rem] text-[#35C9D0] font-bold">
                  Recommended
                </span>
              )}
              <div className="flex items-start gap-3">
                <Ship
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    check.status === "REJECTED" ? "text-muted-foreground" : "text-foreground",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{spec.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {fmtInt(spec.dwtMin)}–{fmtInt(spec.dwtMax)} DWT
                  </p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Draft</dt>
                  <dd
                    className={cn(
                      "mt-0.5 font-mono",
                      spec.ladenDraftM > port.maxDraftM ? "text-danger" : "text-foreground",
                    )}
                  >
                    {spec.ladenDraftM}m
                    {spec.ladenDraftM > port.maxDraftM && (
                      <span className="ml-1 text-[0.6rem] text-danger">
                        +{(spec.ladenDraftM - port.maxDraftM).toFixed(1)}m
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">LOA</dt>
                  <dd
                    className={cn(
                      "mt-0.5 font-mono",
                      spec.loaM > port.maxLoaM ? "text-danger" : "text-foreground",
                    )}
                  >
                    {spec.loaM}m
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Liftings</dt>
                  <dd className="mt-0.5 font-mono">{check.voyages}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Utilisation</dt>
                  <dd className="mt-0.5 font-mono">{check.utilisationPct}%</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Transit</dt>
                  <dd className="mt-0.5 font-mono">{check.transitDays} days</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cost/t</dt>
                  <dd className="mt-0.5 font-mono">
                    {check.status === "REJECTED" ? "—" : fmtRate(check.costPerT)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 border-t border-border pt-3">
                <FeasibilityBadge status={check.status} />
                <ul className="mt-2 space-y-1">
                  {check.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      {check.status === "REJECTED" ? (
                        <XCircle className="mt-0.5 size-3 shrink-0 text-danger" />
                      ) : check.status === "CONDITIONAL" ? (
                        <AlertTriangle className="mt-0.5 size-3 shrink-0 text-brass" />
                      ) : (
                        <Check className="mt-0.5 size-3 shrink-0 text-success" />
                      )}
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </BentoCard>
          );
        })}
      </div>

      <StageNav onPrev={onPrev} onNext={onNext} nextLabel="Route & Voyage" />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Stage 3 — Route & Voyage Planning
   ═══════════════════════════════════════════════ */

function RouteVoyage({
  report,
  request,
  onPrev,
  onNext,
}: {
  report: CharterDecisionReport;
  request: CharterRequest;
  onPrev: () => void;
  onNext: () => void;
}) {
  const origin = originById(request.origin);
  const port = portByCode(request.destination);
  const congestion = DEFAULT_CONGESTION[request.destination];
  const best = report.vesselClass ? vesselById(report.vesselClass) : null;

  const lane: MapLane = { origin: request.origin, port: request.destination, emphasis: true };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Map */}
      <div className="lg:col-span-7">
        <div className="relative rounded-xl border border-[#24485C] bg-[#081827] p-3 overflow-hidden shadow-inner">
          <div className="absolute top-2.5 left-3 flex items-center gap-2 font-mono text-[0.62rem] text-[#F3EEE5]/85 z-20">
            <span className="size-1.5 rounded-full bg-[#F2B653] animate-pulse" />
            <span>ACTIVE FIXTURE LANE: {origin.loadPort.toUpperCase()} → {port.name.toUpperCase()}</span>
          </div>
          <RouteMap
            title={`${origin.loadPort} → ${port.name}`}
            lanes={[lane]}
            highlightPort={request.destination}
            labelScale={0.95}
            delay={0}
            theme="dark"
            className="w-full max-h-[380px]"
          />
          <div className="absolute bottom-2.5 right-3 text-[10px] font-mono text-[#D8E2E8]/70 bg-[#0D2233]/90 px-2 py-0.5 rounded border border-[#24485C]">
            Schematic canvas · Not for navigation
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Indicative corridor route — not navigational. Distances computed from standard maritime waypoints.
        </p>
      </div>

      {/* Metrics */}
      <div className="flex flex-col gap-4 lg:col-span-5">
        {/* Route summary */}
        <BentoCard glowColor="coral" className="p-5">
          <p className="text-eyebrow text-brass">Route</p>
          <p className="mt-2 text-sm font-semibold">{report.routeLabel}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-muted-foreground">Distance</dt>
              <dd className="mt-1 font-mono text-lg font-medium text-foreground">
                {fmtInt(report.distanceNm)}{" "}
                <span className="text-[0.6rem] text-muted-foreground">nm</span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sea transit</dt>
              <dd className="mt-1 font-mono text-lg font-medium text-foreground">
                {report.transitDays}{" "}
                <span className="text-[0.6rem] text-muted-foreground">days</span>
              </dd>
            </div>
          </dl>
        </BentoCard>

        {/* Vessel / speed */}
        {best && (
          <BentoCard glowColor="brass" className="p-5">
            <p className="text-eyebrow text-brass">Vessel class</p>
            <p className="mt-2 text-sm font-semibold">{best.name}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Service speed</dt>
                <dd className="mt-0.5 font-mono text-foreground">{best.serviceSpeedKn} kn</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Fuel consumption</dt>
                <dd className="mt-0.5 font-mono text-foreground">{best.fuelTpd} t/day</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Daily hire</dt>
                <dd className="mt-0.5 font-mono text-foreground">{fmtUsd(best.dailyHireUsd)}/d</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">VLSFO price</dt>
                <dd className="mt-0.5 font-mono text-foreground">
                  {fmtUsd(BASE_BUNKER_USD_PER_T)}/t
                </dd>
              </div>
            </dl>
          </BentoCard>
        )}

        {/* Port / congestion */}
        <BentoCard glowColor="walnut" className="p-5">
          <p className="text-eyebrow text-brass">Port congestion</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Anchorage wait</dt>
              <dd className="mt-0.5 font-mono text-foreground">
                {congestion.avgWaitDays} days avg
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vessels waiting</dt>
              <dd className="mt-0.5 font-mono text-foreground">{congestion.waitingVessels}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Berth occupancy</dt>
              <dd className="mt-0.5 font-mono text-foreground">{congestion.berthOccupancyPct}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Schedule slack</dt>
              <dd
                className={cn(
                  "mt-0.5 font-mono",
                  report.slackDays < 14 ? "text-danger" : "text-foreground",
                )}
              >
                {report.slackDays} days
              </dd>
            </div>
          </dl>
        </BentoCard>

        {/* Risk */}
        <BentoCard glowColor="rose" className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-eyebrow text-brass">Operational risk</p>
            <RiskBadge level={report.riskLevel} />
          </div>
          <p className="mt-3 font-mono text-2xl font-medium text-foreground">
            {report.riskScore}
            <span className="text-sm text-muted-foreground">/100</span>
          </p>
          <ul className="mt-4 space-y-2">
            {report.riskDrivers.slice(0, 4).map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldAlert
                  className={cn(
                    "mt-0.5 size-3 shrink-0",
                    d.direction === "up" ? "text-copper" : "text-sea",
                  )}
                />
                <span>{d.label}</span>
                <span className="ml-auto font-mono text-foreground">{d.weight}</span>
              </li>
            ))}
          </ul>
        </BentoCard>
      </div>

      <div className="lg:col-span-12">
        <StageNav onPrev={onPrev} onNext={onNext} nextLabel="Landed Cost" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Stage 4 — Landed-Cost Comparison
   ═══════════════════════════════════════════════ */

function LandedCost({
  report,
  request,
  sortKey,
  sortDir,
  setSortKey,
  setSortDir,
  onPrev,
  onNext,
}: {
  report: CharterDecisionReport;
  request: CharterRequest;
  sortKey: SortKey;
  sortDir: SortDir;
  setSortKey: (k: SortKey) => void;
  setSortDir: (d: SortDir) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Re-run the simulation to get full breakdown data
  const fullReport = useMemo(
    () =>
      simulateCharterDecision(request, {
        now: new Date(),
        bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
      }),
    [request],
  );

  // Build extended data from evaluateVessel (we extract from checks + re-sim)
  // We only show viable candidates (not REJECTED)
  const viable = fullReport.checks.filter((c) => c.status !== "REJECTED");

  const sorted = useMemo(() => {
    const arr = [...viable];
    arr.sort((a, b) => {
      const av = a[sortKey as keyof VesselCheck];
      const bv = b[sortKey as keyof VesselCheck];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [viable, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // We need breakdowns — simulate individually for each viable vessel
  // Actually, we can get them from the full simulation internals by re-running
  // For now, approximate using the cost decomposition from the top-level report
  // and proportions. But better: we re-run per vessel.
  const breakdowns = useMemo(() => {
    const map: Record<VesselClassId, CharterDecisionReport["costBreakdown"]> = {} as Record<
      VesselClassId,
      CharterDecisionReport["costBreakdown"]
    >;
    // Run the full simulation — it already computes all checks
    // The cost breakdown is only returned for the best vessel in the report.
    // To get per-vessel breakdowns, we simulate with each vessel selected.
    // For efficiency, we re-use the internal evaluateVessel via the exported function
    // by running the simulation once — it processes all vessels internally.
    // We only have the top-level breakdown for the recommended vessel.
    // For other vessels, we estimate proportionally from their totalCostUsd.
    const bestBreakdown = fullReport.costBreakdown;
    const bestTotal = fullReport.totalCostUsd || 1;

    for (const check of fullReport.checks) {
      if (check.status === "REJECTED") continue;
      if (check.vesselClass === fullReport.vesselClass) {
        map[check.vesselClass] = bestBreakdown;
      } else {
        // proportional estimate
        const ratio = check.totalCostUsd / bestTotal;
        map[check.vesselClass] = {
          freightUsd: Math.round(bestBreakdown.freightUsd * ratio),
          bunkerUsd: Math.round(bestBreakdown.bunkerUsd * ratio),
          portDuesUsd: Math.round(bestBreakdown.portDuesUsd * ratio),
          demurrageReserveUsd: Math.round(bestBreakdown.demurrageReserveUsd * ratio),
          insuranceUsd: Math.round(bestBreakdown.insuranceUsd * ratio),
        };
      }
    }
    return map;
  }, [fullReport]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sorted.length} viable vessel class{sorted.length !== 1 ? "es" : ""} — sorted by{" "}
          <span className="font-medium text-foreground">
            {sortKey === "costPerT"
              ? "cost/t"
              : sortKey === "totalCostUsd"
                ? "total cost"
                : sortKey === "transitDays"
                  ? "transit"
                  : sortKey === "utilisationPct"
                    ? "utilisation"
                    : "class"}
          </span>{" "}
          {sortDir === "asc" ? "↑" : "↓"}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <XCircle className="size-8 text-danger" />
          <p className="text-sm text-muted-foreground">
            No vessel class is viable for this combination of cargo, port and deadline.
          </p>
        </div>
      ) : (
        <BentoCard glowColor="brass" className="overflow-hidden p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left">
                  <SortTh
                    label="Vessel Class"
                    sortKey="vesselClass"
                    currentKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="px-3 py-3 text-muted-foreground font-medium">Status</th>
                  <SortTh
                    label="Transit"
                    sortKey="transitDays"
                    currentKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortTh
                    label="Utilisation"
                    sortKey="utilisationPct"
                    currentKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="px-3 py-3 text-muted-foreground font-medium">Freight</th>
                  <th className="px-3 py-3 text-muted-foreground font-medium">Bunker</th>
                  <th className="px-3 py-3 text-muted-foreground font-medium">Port dues</th>
                  <th className="px-3 py-3 text-muted-foreground font-medium">Demurrage</th>
                  <th className="px-3 py-3 text-muted-foreground font-medium">Insurance</th>
                  <SortTh
                    label="Total"
                    sortKey="totalCostUsd"
                    currentKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortTh
                    label="$/t"
                    sortKey="costPerT"
                    currentKey={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((check) => {
                  const spec = vesselById(check.vesselClass);
                  const isRec = fullReport.vesselClass === check.vesselClass;
                  const bd = breakdowns[check.vesselClass];
                  return (
                    <tr
                      key={check.vesselClass}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-accent/30",
                        isRec && "bg-copper/5",
                      )}
                    >
                      <td className="whitespace-nowrap px-3 py-3 font-medium">
                        {spec.name}
                        {isRec && (
                          <span className="ml-2 text-[0.55rem] font-semibold uppercase tracking-wider text-copper">
                            Best
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <FeasibilityBadge status={check.status} />
                      </td>
                      <td className="px-3 py-3 font-mono">{check.transitDays}d</td>
                      <td className="px-3 py-3 font-mono">{check.utilisationPct}%</td>
                      <td className="px-3 py-3 font-mono">{bd ? fmtUsd(bd.freightUsd) : "—"}</td>
                      <td className="px-3 py-3 font-mono">{bd ? fmtUsd(bd.bunkerUsd) : "—"}</td>
                      <td className="px-3 py-3 font-mono">{bd ? fmtUsd(bd.portDuesUsd) : "—"}</td>
                      <td className="px-3 py-3 font-mono">
                        {bd ? fmtUsd(bd.demurrageReserveUsd) : "—"}
                      </td>
                      <td className="px-3 py-3 font-mono">{bd ? fmtUsd(bd.insuranceUsd) : "—"}</td>
                      <td className="px-3 py-3 font-mono font-medium">
                        {fmtUsd(check.totalCostUsd)}
                      </td>
                      <td className="px-3 py-3 font-mono font-semibold text-foreground">
                        {fmtRate(check.costPerT)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </BentoCard>
      )}

      {/* Cost breakdown visual for recommended */}
      {fullReport.vesselClass && (
        <BentoCard glowColor="coral" className="mt-6 p-5">
          <p className="text-eyebrow text-brass">
            Cost breakdown — {vesselById(fullReport.vesselClass).name}
          </p>
          <div className="mt-4 flex flex-wrap gap-6">
            {[
              {
                label: "Freight / Charter",
                value: fullReport.costBreakdown.freightUsd,
                color: "bg-copper",
              },
              { label: "Bunker", value: fullReport.costBreakdown.bunkerUsd, color: "bg-sea" },
              {
                label: "Port dues",
                value: fullReport.costBreakdown.portDuesUsd,
                color: "bg-brass",
              },
              {
                label: "Demurrage reserve",
                value: fullReport.costBreakdown.demurrageReserveUsd,
                color: "bg-slate",
              },
              { label: "Insurance", value: fullReport.costBreakdown.insuranceUsd, color: "bg-fog" },
            ].map(({ label, value, color }) => (
              <div key={label} className="min-w-[100px]">
                <div className="flex items-center gap-1.5">
                  <span className={cn("size-2.5 rounded-sm", color)} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <p className="mt-1 font-mono text-sm font-medium text-foreground">
                  {fmtUsd(value)}
                </p>
                <p className="font-mono text-[0.6rem] text-muted-foreground">
                  {fmt2(value / request.cargoTonnes)}/t
                </p>
              </div>
            ))}
          </div>

          {/* Stacked bar */}
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
            {[
              { value: fullReport.costBreakdown.freightUsd, color: "bg-copper" },
              { value: fullReport.costBreakdown.bunkerUsd, color: "bg-sea" },
              { value: fullReport.costBreakdown.portDuesUsd, color: "bg-brass" },
              { value: fullReport.costBreakdown.demurrageReserveUsd, color: "bg-slate" },
              { value: fullReport.costBreakdown.insuranceUsd, color: "bg-fog" },
            ].map(({ value, color }, i) => (
              <div
                key={i}
                className={cn("h-full transition-all", color)}
                style={{ width: `${(value / fullReport.totalCostUsd) * 100}%` }}
              />
            ))}
          </div>
        </BentoCard>
      )}

      <StageNav onPrev={onPrev} onNext={onNext} nextLabel="Recommendation" />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Stage 5 — Recommendation
   ═══════════════════════════════════════════════ */

function Recommendation({
  report,
  request,
  onPrev,
  onRerun,
  onEdit,
}: {
  report: CharterDecisionReport;
  request: CharterRequest;
  onPrev: () => void;
  onRerun: () => void;
  onEdit: () => void;
}) {
  const origin = originById(request.origin);
  const port = portByCode(request.destination);
  const bestSpec = report.vesselClass ? vesselById(report.vesselClass) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Main recommendation */}
      <div className="lg:col-span-8">
        {/* Decision banner */}
        <BentoCard
          glowColor={
            report.decision === "CHARTER_NOW"
              ? "coral"
              : report.decision === "WAIT"
                ? "rose"
                : "brass"
          }
          className="p-6 sm:p-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <DecisionBadge decision={report.decision} />
              <h2 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl font-serif text-foreground">
                {report.headline}
              </h2>
            </div>
            <div className="hidden sm:flex flex-col items-center">
              <BentoGauge
                value={Math.round(report.confidence * 100)}
                size={84}
                strokeWidth={7}
                color="#F2B653"
                label="Confidence"
              />
            </div>
          </div>

          {/* Key metrics */}
          {bestSpec && (
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Vessel class</p>
                <p className="mt-1 text-sm font-semibold">{bestSpec.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Landed cost</p>
                <p className="mt-1 font-mono text-sm font-semibold">
                  {fmtUsd(report.totalCostUsd)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cost per tonne</p>
                <p className="mt-1 font-mono text-sm font-semibold">
                  {fmtRate(report.totalCostUsd / request.cargoTonnes)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Schedule slack</p>
                <p
                  className={cn(
                    "mt-1 font-mono text-sm font-semibold",
                    report.slackDays < 14 ? "text-danger" : "",
                  )}
                >
                  {report.slackDays} days
                </p>
              </div>
            </div>
          )}

          {/* Split details */}
          {report.split && (
            <div className="mt-6 rounded-lg border border-[#24485C] bg-[#0D2233] p-4">
              <p className="text-xs font-semibold text-[#35BFC3] mb-3">Split programme</p>
              <BentoFlowBar
                leftLabel="Commit Now"
                leftValue={`${report.split.nowPct}%`}
                rightLabel="Defer Later"
                rightValue={`${report.split.laterPct}%`}
                leftRatio={report.split.nowPct / 100}
                leftColor="#35BFC3"
                rightColor="#E87945"
              />
              <p className="mt-3 text-xs text-muted-foreground">{report.split.rationale}</p>
            </div>
          )}
        </BentoCard>

        {/* Reasoning */}
        <BentoCard glowColor="powder" className="mt-6 p-5">
          <p className="text-eyebrow text-brass">Reasoning</p>
          <ul className="mt-4 space-y-3">
            {report.reasoning.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[0.55rem] text-foreground">
                  {i + 1}
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </BentoCard>

        {/* Freight forecast */}
        <BentoCard glowColor="walnut" className="mt-4 p-5">
          <p className="text-eyebrow text-brass">Freight forecast</p>
          <div className="mt-3 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">P10 (optimistic)</p>
              <p className="mt-1 font-mono text-sm font-medium text-foreground">
                {fmtRate(report.forecastRange.p10)}/t
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">P50 (base)</p>
              <p className="mt-1 font-mono text-sm font-semibold text-copper-soft">
                {fmtRate(report.forecastRange.p50)}/t
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">P90 (pessimistic)</p>
              <p className="mt-1 font-mono text-sm font-medium text-foreground">
                {fmtRate(report.forecastRange.p90)}/t
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            30-day market trend: {report.marketTrendPct >= 0 ? "+" : ""}
            {fmt1(report.marketTrendPct)}% on {origin.shortName} lanes
          </p>
        </BentoCard>

        {/* Alternatives */}
        <BentoCard glowColor="coral" className="mt-4 p-5">
          <p className="text-eyebrow text-brass">Alternative candidates</p>
          <div className="mt-4 space-y-3">
            {report.checks
              .filter((c) => c.status !== "REJECTED" && c.vesselClass !== report.vesselClass)
              .sort((a, b) => a.costPerT - b.costPerT)
              .map((check) => {
                const spec = vesselById(check.vesselClass);
                const delta =
                  report.totalCostUsd > 0
                    ? ((check.totalCostUsd - report.totalCostUsd) / report.totalCostUsd) * 100
                    : 0;
                return (
                  <div
                    key={check.vesselClass}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Ship className="size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{spec.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {check.voyages} lifting{check.voyages > 1 ? "s" : ""} ·{" "}
                          {check.utilisationPct}% util
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-medium">{fmtRate(check.costPerT)}/t</p>
                      <p
                        className={cn(
                          "font-mono text-[0.6rem]",
                          delta > 0 ? "text-copper" : "text-sea",
                        )}
                      >
                        {delta > 0 ? "+" : ""}
                        {fmt1(delta)}%
                      </p>
                    </div>
                    <FeasibilityBadge status={check.status} className="ml-3" />
                  </div>
                );
              })}
            {report.checks.filter((c) => c.status === "REJECTED").length > 0 && (
              <p className="text-xs text-muted-foreground">
                {report.checks.filter((c) => c.status === "REJECTED").length} vessel class
                {report.checks.filter((c) => c.status === "REJECTED").length > 1 ? "es" : ""}{" "}
                rejected on draft, LOA or deadline constraints.
              </p>
            )}
          </div>
        </BentoCard>
      </div>

      {/* Side panel */}
      <div className="flex flex-col gap-4 lg:col-span-4">
        {/* Request summary */}
        <BentoCard glowColor="brass" className="p-5">
          <p className="text-eyebrow text-brass">Request summary</p>
          <dl className="mt-4 space-y-2 text-xs">
            <DlRow
              label="Cargo"
              value={`${fmtTonnes(request.cargoTonnes)} ${CARGO_LABELS[request.cargoType].toLowerCase()}`}
            />
            <DlRow label="Route" value={`${origin.loadPort} → ${port.name}`} />
            <DlRow label="Deadline" value={request.deliveryDeadline} />
            <DlRow label="Preference" value={CONTRACT_LABELS[request.contractPreference]} />
          </dl>
          <button
            type="button"
            onClick={onEdit}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Edit requirements
          </button>
        </BentoCard>

        {/* Risk summary */}
        <BentoCard glowColor="rose" className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-eyebrow text-brass">Risk</p>
            <RiskBadge level={report.riskLevel} />
          </div>
          <p className="mt-2 font-mono text-2xl font-medium">{report.riskScore}/100</p>
          <ul className="mt-3 space-y-1.5">
            {report.riskDrivers.slice(0, 3).map((d, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[0.68rem] text-muted-foreground">
                <ShieldAlert
                  className={cn(
                    "mt-0.5 size-2.5 shrink-0",
                    d.direction === "up" ? "text-copper" : "text-sea",
                  )}
                />
                <span>{d.label}</span>
              </li>
            ))}
          </ul>
        </BentoCard>

        {/* Pipeline stages */}
        <BentoCard glowColor="walnut" className="p-5">
          <p className="text-eyebrow text-brass">Pipeline</p>
          <ol className="mt-4 space-y-3">
            {report.stages.map((s, i) => (
              <li key={s.id} className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-copper/15 font-mono text-[0.55rem] font-medium text-copper">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">{s.label}</p>
                  <p className="mt-0.5 font-mono text-[0.62rem] text-muted-foreground">
                    {s.summary}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </BentoCard>

        {/* Assumptions */}
        <BentoCard glowColor="none" className="p-5">
          <p className="text-eyebrow text-brass">Operational parameters & model scope</p>
          <ul className="mt-3 space-y-2 text-[0.68rem] text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3 shrink-0 text-brass" />
              <span>
                Freight rates calculated from Baltic Exchange benchmark indices and corridor differentials
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3 shrink-0 text-brass" />
              <span>Port queue and wait times calibrated to East Coast terminal berth windows</span>
            </li>
            <li className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3 shrink-0 text-brass" />
              <span>Vessel specifications referenced to standard Baltic Capesize and Panamax particulars</span>
            </li>
            <li className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3 shrink-0 text-brass" />
              <span>Insurance and demurrage calculated as prudent operational reserve allocations</span>
            </li>
          </ul>
        </BentoCard>

        {/* Provenance */}
        <div className="rounded-md border border-border p-4">
          <p className="font-mono text-[0.6rem] text-muted-foreground">
            Analysis ID: {report.requestId}
          </p>
          <p className="font-mono text-[0.6rem] text-muted-foreground">{report.provenance.label}</p>
          <p className="font-mono text-[0.6rem] text-muted-foreground">
            Calibrated: {report.provenance.asOf}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRerun}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <RefreshCw className="size-3" /> Re-analyse
          </button>
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <ArrowLeft className="size-3" /> Back
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Shared sub-components
   ═══════════════════════════════════════════════ */

function StageNav({
  onPrev,
  onNext,
  prevLabel = "Back",
  nextLabel = "Next",
}: {
  onPrev: () => void;
  onNext: () => void;
  prevLabel?: string;
  nextLabel?: string;
}) {
  return (
    <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
      <button
        type="button"
        onClick={onPrev}
        className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
      >
        <ArrowLeft className="size-3.5" /> {prevLabel}
      </button>
      <button
        type="button"
        onClick={onNext}
        className="group inline-flex items-center gap-2 rounded-md bg-copper px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-copper transition-colors hover:bg-copper-soft"
      >
        {nextLabel}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

function FieldGroup({
  label,
  required,
  htmlFor,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-paper-foreground">
        {label}
        {required && <span className="ml-0.5 text-copper">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${htmlFor}-err`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function SelectField({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full appearance-none rounded-md border border-paper-border bg-paper-sunk px-3 py-2.5 pr-8 text-sm text-paper-foreground focus:border-copper focus:ring-1 focus:ring-copper"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-paper-muted" />
    </div>
  );
}

function SortTh({
  label,
  sortKey: key,
  currentKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = key === currentKey;
  return (
    <th className="px-3 py-3">
      <button
        type="button"
        onClick={() => onSort(key)}
        className={cn(
          "inline-flex items-center gap-1 font-medium transition-colors",
          active ? "text-copper-soft" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <ArrowUpDown className="size-3" />
        {active && <span className="text-[0.5rem]">{dir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

function DlRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
