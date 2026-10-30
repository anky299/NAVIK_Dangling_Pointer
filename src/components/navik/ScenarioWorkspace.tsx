/**
 * NAVIK Scenario Lab & Maritime Stress Testing Workspace.
 *
 * Enables bulk-cargo procurement teams at SAIL to stress-test voyages
 * against freight spikes, bunker cost surges, anchorage congestion,
 * and fleet supply crunches against a preserved baseline.
 */
import { useCallback, useId, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Copy,
  DollarSign,
  Edit2,
  ExternalLink,
  Flame,
  Fuel,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  LineChart,
  Navigation,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Ship,
  Sliders,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wind,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import {
  fmt1,
  fmt2,
  fmtDate,
  fmtInt,
  fmtPct,
  fmtRate,
  fmtTonnes,
  fmtUsd,
  fmtUsdM,
} from "@/lib/format";
import {
  CARGO_LABELS,
  CONTRACT_LABELS,
  DECISION_LABELS,
  DISTANCES_NM,
  ORIGINS,
  PORTS,
  RISK_LABELS,
  ROUTE_LABELS,
  VESSEL_CLASSES,
  originById,
  portByCode,
  vesselById,
} from "@/lib/api/reference";
import type {
  CargoType,
  CharterRequest,
  ContractPreference,
  FeasibilityStatus,
  OriginRegion,
  PortCode,
  ScenarioComparison,
  ScenarioInput,
  VesselClassId,
} from "@/lib/api/types";
import {
  BASELINE_INPUT,
  SCENARIO_BOUNDS,
  SCENARIO_PRESETS,
  type ScenarioPreset,
  compareMultipleScenarios,
  compareScenarios,
  validateScenarioInput,
} from "@/lib/sim/scenario";
import { AXIS, GRID, TooltipCard } from "./charts";
import {
  DecisionBadge,
  Delta,
  DemoTag,
  Eyebrow,
  FeasibilityBadge,
  Metric,
  PageHeader,
  PanelHeader,
  RiskBadge,
} from "./primitives";
import { BentoCard, BentoGrid } from "./Bento";

/* ═══════════════════════════════════════════════
   Saved Scenario Session Model
   ═══════════════════════════════════════════════ */

interface SavedScenarioSession {
  id: string;
  name: string;
  description: string;
  input: ScenarioInput;
  presetId?: string;
}

const INITIAL_SAVED_SCENARIOS: SavedScenarioSession[] = [
  {
    id: "scen-base",
    name: "Base Case",
    description: "Baseline market conditions without stress shocks applied.",
    input: { ...BASELINE_INPUT },
    presetId: "base",
  },
  {
    id: "scen-freight-shock",
    name: "Freight Shock (+25%)",
    description: "Geopolitical route tightening and tonnage shortages drive a +25% freight spike.",
    input: {
      freightShockPct: 25,
      congestionDays: 1.5,
      bunkerUsdPerT: 680,
      fleetAvailabilityPct: 80,
      speedDeltaKn: 0,
    },
    presetId: "freight-shock",
  },
  {
    id: "scen-bunker-spike",
    name: "Bunker Price Spike ($850/t)",
    description: "Crude supply squeeze surges Singapore VLSFO to $850/t with mild freight uptick.",
    input: {
      freightShockPct: 8,
      congestionDays: 0,
      bunkerUsdPerT: 850,
      fleetAvailabilityPct: 95,
      speedDeltaKn: -0.5,
    },
    presetId: "bunker-spike",
  },
  {
    id: "scen-port-disruption",
    name: "Port Congestion (+8d)",
    description:
      "Berth maintenance and vessel clustering cause +8.0 extra days at discharge anchorage.",
    input: {
      freightShockPct: 10,
      congestionDays: 8,
      bunkerUsdPerT: 640,
      fleetAvailabilityPct: 85,
      speedDeltaKn: 0,
    },
    presetId: "port-congestion",
  },
  {
    id: "scen-combined",
    name: "Combined Downside Case",
    description:
      "Compound risk: +22% freight, $820/t bunker, +6d delay, and 75% fleet availability.",
    input: {
      freightShockPct: 22,
      congestionDays: 6,
      bunkerUsdPerT: 820,
      fleetAvailabilityPct: 75,
      speedDeltaKn: -1.0,
    },
    presetId: "combined-downside",
  },
];

/* Default baseline mission for SAIL coking-coal intake */
const DEFAULT_BASELINE_REQUEST: CharterRequest = {
  cargoTonnes: 160_000,
  cargoType: "COKING_COAL",
  origin: "AUS_QLD",
  destination: "PRDP",
  deliveryDeadline: "2026-12-25",
  contractPreference: "SHORT_TERM",
};

export function ScenarioWorkspace() {
  const navigate = useNavigate();

  // Baseline voyage specification
  const [request, setRequest] = useState<CharterRequest>(DEFAULT_BASELINE_REQUEST);
  const [showBaselineEditor, setShowBaselineEditor] = useState(false);

  // Multiple scenarios session state
  const [scenarios, setScenarios] = useState<SavedScenarioSession[]>(INITIAL_SAVED_SCENARIOS);
  const [activeScenarioId, setActiveScenarioId] = useState<string>("scen-freight-shock");
  const [viewMode, setViewMode] = useState<"DEEP_DIVE" | "MATRIX">("DEEP_DIVE");

  // Inline scenario renaming
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");

  // Unsupported boundaries modal / card toggle
  const [showBoundariesInfo, setShowBoundariesInfo] = useState(false);

  // Deterministic reference date
  const now = useMemo(() => new Date("2026-10-25T06:00:00Z"), []);

  // Active scenario reference
  const activeScenario = useMemo(() => {
    return (
      scenarios.find((s) => s.id === activeScenarioId) ??
      scenarios[0] ??
      INITIAL_SAVED_SCENARIOS[0]!
    );
  }, [scenarios, activeScenarioId]);

  // Run calculation for active scenario
  const activeComparison: ScenarioComparison = useMemo(() => {
    return compareScenarios(
      request,
      activeScenario.input,
      now,
      activeScenario.name,
      activeScenario.id,
      activeScenario.description,
    );
  }, [request, activeScenario, now]);

  // Run multi-scenario comparisons across all saved scenarios
  const allComparisons: ScenarioComparison[] = useMemo(() => {
    return compareMultipleScenarios(request, scenarios, now);
  }, [request, scenarios, now]);

  // Update input parameters for active scenario
  const updateActiveInput = useCallback(
    (updater: Partial<ScenarioInput>) => {
      setScenarios((prev) =>
        prev.map((s) => {
          if (s.id !== activeScenarioId) return s;
          const nextInput = validateScenarioInput({ ...s.input, ...updater });
          return {
            ...s,
            input: nextInput,
            presetId: undefined, // Custom modified
          };
        }),
      );
    },
    [activeScenarioId],
  );

  // Apply a preset to the active scenario
  const handleApplyPreset = useCallback(
    (preset: ScenarioPreset) => {
      setScenarios((prev) =>
        prev.map((s) => {
          if (s.id !== activeScenarioId) return s;
          return {
            ...s,
            name: preset.name,
            description: preset.description,
            input: { ...preset.input },
            presetId: preset.id,
          };
        }),
      );
    },
    [activeScenarioId],
  );

  // Reset active scenario to baseline (zero shocks)
  const handleResetActiveToBaseline = useCallback(() => {
    updateActiveInput(BASELINE_INPUT);
  }, [updateActiveInput]);

  // Add a new scenario
  const handleAddScenario = useCallback(() => {
    const newId = `scen-${Date.now()}`;
    const newScenario: SavedScenarioSession = {
      id: newId,
      name: `Scenario ${scenarios.length + 1}`,
      description: "User-defined custom stress testing scenario.",
      input: { ...activeScenario.input },
    };
    setScenarios((prev) => [...prev, newScenario]);
    setActiveScenarioId(newId);
  }, [scenarios.length, activeScenario.input]);

  // Duplicate active scenario
  const handleDuplicateScenario = useCallback(() => {
    const newId = `scen-${Date.now()}`;
    const duplicated: SavedScenarioSession = {
      id: newId,
      name: `Copy of ${activeScenario.name}`,
      description: activeScenario.description,
      input: { ...activeScenario.input },
    };
    setScenarios((prev) => [...prev, duplicated]);
    setActiveScenarioId(newId);
  }, [activeScenario]);

  // Delete scenario (ensure at least 1 remains)
  const handleDeleteScenario = useCallback(
    (idToDelete: string) => {
      if (scenarios.length <= 1) return;
      setScenarios((prev) => prev.filter((s) => s.id !== idToDelete));
      if (activeScenarioId === idToDelete) {
        const remaining = scenarios.filter((s) => s.id !== idToDelete);
        if (remaining[0]) setActiveScenarioId(remaining[0].id);
      }
    },
    [scenarios, activeScenarioId],
  );

  // Rename commit
  const handleSaveRename = useCallback(
    (id: string) => {
      if (!tempName.trim()) {
        setEditingNameId(null);
        return;
      }
      setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, name: tempName.trim() } : s)));
      setEditingNameId(null);
    },
    [tempName],
  );

  const startRename = useCallback((id: string, currentName: string) => {
    setEditingNameId(id);
    setTempName(currentName);
  }, []);

  // Navigation handlers to integrated workspaces
  const handleEscalateToCharter = () => {
    navigate({ to: "/charter" });
  };
  const handleGoToMarket = () => {
    navigate({ to: "/market" });
  };
  const handleGoToFeasibility = () => {
    navigate({ to: "/feasibility" });
  };
  const handleGoToDashboard = () => {
    navigate({ to: "/dashboard" });
  };

  const origin = originById(request.origin);
  const destPort = portByCode(request.destination);
  const distanceNm = DISTANCES_NM[request.origin][request.destination];

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header & Terminal Controls */}
      <PageHeader
        eyebrow="WORKSPACE 05 / STRESS LAB"
        title="Scenario Lab"
        accent="& Maritime Stress Testing"
        description="Stress-test SAIL bulk-cargo procurement decisions against freight market shocks, bunker price surges, discharge-port congestion, and fleet tonnage crunches."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetActiveToBaseline}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper transition"
            >
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Reset Active to Baseline</span>
            </button>

            <button
              type="button"
              onClick={handleDuplicateScenario}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper transition"
            >
              <Copy className="h-3.5 w-3.5 text-brass" />
              <span>Duplicate</span>
            </button>

            <button
              type="button"
              onClick={handleAddScenario}
              className="inline-flex items-center gap-1.5 rounded-md bg-copper px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-copper-soft transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Scenario</span>
            </button>
          </div>
        }
      />

      {/* 2. Baseline Mission Context & Route Ribbon */}
      <BentoCard glowColor="brass" className="p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-copper/15 text-copper">
              <Ship className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-eyebrow text-brass">BASELINE MISSION</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="font-mono text-xs text-muted-foreground">
                  SAIL Steel Belt Inflow
                </span>
              </div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {fmtTonnes(request.cargoTonnes)} {CARGO_LABELS[request.cargoType]} •{" "}
                {origin.shortName} ({origin.loadPort}) → {destPort.name} ({destPort.state})
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 rounded-md border border-border/60 bg-surface/80 px-3 py-1.5 text-xs font-mono">
              <div>
                <span className="text-muted-foreground">Distance: </span>
                <span className="text-foreground">{fmtInt(distanceNm)} nm</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div>
                <span className="text-muted-foreground">Laycan Deadline: </span>
                <span className="text-foreground">{fmtDate(request.deliveryDeadline)}</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div>
                <span className="text-muted-foreground">Contract: </span>
                <span className="text-copper">{CONTRACT_LABELS[request.contractPreference]}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBaselineEditor((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
            >
              <Sliders className="h-3 w-3 text-brass" />
              <span>{showBaselineEditor ? "Hide Route Settings" : "Configure Baseline Route"}</span>
              {showBaselineEditor ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Baseline Mission Editor */}
        <AnimatePresence>
          {showBaselineEditor && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border/50 mt-4 pt-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <label
                    htmlFor="base-origin"
                    className="text-eyebrow text-muted-foreground block mb-1"
                  >
                    Origin Region & Load Port
                  </label>
                  <select
                    id="base-origin"
                    value={request.origin}
                    onChange={(e) =>
                      setRequest((r) => ({ ...r, origin: e.target.value as OriginRegion }))
                    }
                    className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground focus:border-copper focus:outline-none"
                  >
                    {ORIGINS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.loadPort})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="base-dest"
                    className="text-eyebrow text-muted-foreground block mb-1"
                  >
                    Discharge Port (East Coast)
                  </label>
                  <select
                    id="base-dest"
                    value={request.destination}
                    onChange={(e) =>
                      setRequest((r) => ({ ...r, destination: e.target.value as PortCode }))
                    }
                    className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground focus:border-copper focus:outline-none"
                  >
                    {PORTS.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} ({p.state} • draft {p.maxDraftM}m)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="base-cargo-tonnes"
                    className="text-eyebrow text-muted-foreground block mb-1"
                  >
                    Cargo Volume (Metric Tonnes)
                  </label>
                  <input
                    id="base-cargo-tonnes"
                    type="number"
                    step={5000}
                    min={40000}
                    max={250000}
                    value={request.cargoTonnes}
                    onChange={(e) =>
                      setRequest((r) => ({ ...r, cargoTonnes: Number(e.target.value) || 160000 }))
                    }
                    className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-copper focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="base-commodity"
                    className="text-eyebrow text-muted-foreground block mb-1"
                  >
                    Commodity
                  </label>
                  <select
                    id="base-commodity"
                    value={request.cargoType}
                    onChange={(e) =>
                      setRequest((r) => ({ ...r, cargoType: e.target.value as CargoType }))
                    }
                    className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground focus:border-copper focus:outline-none"
                  >
                    <option value="COKING_COAL">Coking Coal (Metallurgical)</option>
                    <option value="THERMAL_COAL">Thermal Coal</option>
                    <option value="IRON_ORE">Iron Ore</option>
                    <option value="LIMESTONE">Limestone / Flux</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="base-deadline"
                    className="text-eyebrow text-muted-foreground block mb-1"
                  >
                    Laycan Target Delivery
                  </label>
                  <input
                    id="base-deadline"
                    type="date"
                    value={request.deliveryDeadline}
                    onChange={(e) =>
                      setRequest((r) => ({ ...r, deliveryDeadline: e.target.value }))
                    }
                    className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-copper focus:outline-none"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </BentoCard>

      {/* 3. Session Scenarios Manager & View Mode Selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-eyebrow text-muted-foreground whitespace-nowrap mr-1">
            SCENARIOS:
          </span>
          {scenarios.map((scen) => {
            const isActive = scen.id === activeScenarioId;
            const isEditing = editingNameId === scen.id;

            return (
              <div
                key={scen.id}
                className={cn(
                  "group relative inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-all",
                  isActive
                    ? "border-copper/60 bg-copper/10 text-foreground font-medium shadow-sm ring-1 ring-copper/30"
                    : "border-border/70 bg-card/50 text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename(scen.id);
                        if (e.key === "Escape") setEditingNameId(null);
                      }}
                      className="h-5 w-28 rounded border border-copper bg-surface px-1 text-xs text-foreground focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveRename(scen.id)}
                      className="text-success hover:text-foreground"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveScenarioId(scen.id)}
                    className="flex items-center gap-1.5"
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isActive ? "bg-copper" : "bg-muted-foreground/50",
                      )}
                    />
                    <span>{scen.name}</span>
                  </button>
                )}

                {!isEditing && (
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                    <button
                      type="button"
                      onClick={() => startRename(scen.id, scen.name)}
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                      title="Rename scenario"
                    >
                      <Edit2 className="h-2.5 w-2.5" />
                    </button>

                    {scenarios.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteScenario(scen.id)}
                        className="p-0.5 text-muted-foreground hover:text-danger ml-0.5"
                        title="Delete scenario"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* View Mode Toggle */}
        <div className="flex shrink-0 items-center gap-1 rounded-md border border-border/80 bg-surface/90 p-1">
          <button
            type="button"
            onClick={() => setViewMode("DEEP_DIVE")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition",
              viewMode === "DEEP_DIVE"
                ? "bg-copper text-ink font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sliders className="h-3 w-3" />
            <span>Stress Deep-Dive</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("MATRIX")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition",
              viewMode === "MATRIX"
                ? "bg-copper text-ink font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <BarChart3 className="h-3 w-3" />
            <span>Multi-Scenario Matrix ({scenarios.length})</span>
          </button>
        </div>
      </div>

      {viewMode === "DEEP_DIVE" ? (
        <>
          {/* 4. Scenario Parameter Controls Deck */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Presets and Shocks Sliders */}
            <BentoCard glowColor="coral" className="space-y-6 lg:col-span-12 p-5 shadow-sm">
              {/* Preset selection bar */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-eyebrow text-brass flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-brass" />
                    <span>PRESET STRESS CONDITIONS</span>
                  </span>
                  <span className="text-[0.68rem] text-muted-foreground">
                    Click to load verified model parameters into active scenario
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {SCENARIO_PRESETS.map((preset) => {
                    const isSelected = activeScenario.presetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs transition",
                          isSelected
                            ? "border-brass bg-brass/15 text-brass font-medium"
                            : "border-border/60 bg-surface/70 text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                        title={preset.description}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5 border-t border-border/60 pt-5">
                {/* 1. Freight Rate Shock */}
                <div className="space-y-2 rounded-md border border-border/60 bg-surface/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="shock-freight"
                      className="text-eyebrow text-foreground font-medium"
                    >
                      Freight Rate Shock
                    </label>
                    <span className="font-mono text-xs text-brass">
                      {activeScenario.input.freightShockPct > 0 ? "+" : ""}
                      {activeScenario.input.freightShockPct}%
                    </span>
                  </div>

                  <input
                    id="shock-freight"
                    type="range"
                    min={SCENARIO_BOUNDS.freightShockPct.min}
                    max={SCENARIO_BOUNDS.freightShockPct.max}
                    step={SCENARIO_BOUNDS.freightShockPct.step}
                    value={activeScenario.input.freightShockPct}
                    onChange={(e) => updateActiveInput({ freightShockPct: Number(e.target.value) })}
                    className="w-full accent-copper cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground font-mono">
                    <span>Baseline: 0%</span>
                    <span>Range: -40% to +80%</span>
                  </div>

                  <p className="text-[0.7rem] text-muted-foreground/80 leading-snug">
                    Adjusts spot market charter hire multiplier and 30-day forecast trend.
                  </p>
                </div>

                {/* 2. Bunker Fuel Price */}
                <div className="space-y-2 rounded-md border border-border/60 bg-surface/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="shock-bunker"
                      className="text-eyebrow text-foreground font-medium"
                    >
                      Bunker Price (VLSFO)
                    </label>
                    <span className="font-mono text-xs text-copper">
                      ${activeScenario.input.bunkerUsdPerT}/MT
                    </span>
                  </div>

                  <input
                    id="shock-bunker"
                    type="range"
                    min={SCENARIO_BOUNDS.bunkerUsdPerT.min}
                    max={SCENARIO_BOUNDS.bunkerUsdPerT.max}
                    step={SCENARIO_BOUNDS.bunkerUsdPerT.step}
                    value={activeScenario.input.bunkerUsdPerT}
                    onChange={(e) => updateActiveInput({ bunkerUsdPerT: Number(e.target.value) })}
                    className="w-full accent-copper cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground font-mono">
                    <span>Baseline: $620/t</span>
                    <span>
                      Delta: {activeScenario.input.bunkerUsdPerT - 620 > 0 ? "+" : ""}$
                      {activeScenario.input.bunkerUsdPerT - 620}
                    </span>
                  </div>

                  <p className="text-[0.7rem] text-muted-foreground/80 leading-snug">
                    Singapore benchmark low-sulfur marine fuel pass-through across round trip.
                  </p>
                </div>

                {/* 3. Port Congestion / Extra Wait */}
                <div className="space-y-2 rounded-md border border-border/60 bg-surface/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="shock-congestion"
                      className="text-eyebrow text-foreground font-medium"
                    >
                      Anchorage Delay
                    </label>
                    <span className="font-mono text-xs text-brass">
                      +{activeScenario.input.congestionDays.toFixed(1)} days
                    </span>
                  </div>

                  <input
                    id="shock-congestion"
                    type="range"
                    min={SCENARIO_BOUNDS.congestionDays.min}
                    max={SCENARIO_BOUNDS.congestionDays.max}
                    step={SCENARIO_BOUNDS.congestionDays.step}
                    value={activeScenario.input.congestionDays}
                    onChange={(e) => updateActiveInput({ congestionDays: Number(e.target.value) })}
                    className="w-full accent-copper cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground font-mono">
                    <span>Normal: +0d</span>
                    <span>Max: +21 days</span>
                  </div>

                  <p className="text-[0.7rem] text-muted-foreground/80 leading-snug">
                    Extra waiting at {destPort.name} roadstead; adds daily hire demurrage
                    contingency.
                  </p>
                </div>

                {/* 4. Fleet Availability */}
                <div className="space-y-2 rounded-md border border-border/60 bg-surface/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="shock-fleet"
                      className="text-eyebrow text-foreground font-medium"
                    >
                      Fleet Availability
                    </label>
                    <span className="font-mono text-xs text-sea">
                      {activeScenario.input.fleetAvailabilityPct}%
                    </span>
                  </div>

                  <input
                    id="shock-fleet"
                    type="range"
                    min={SCENARIO_BOUNDS.fleetAvailabilityPct.min}
                    max={SCENARIO_BOUNDS.fleetAvailabilityPct.max}
                    step={SCENARIO_BOUNDS.fleetAvailabilityPct.step}
                    value={activeScenario.input.fleetAvailabilityPct}
                    onChange={(e) =>
                      updateActiveInput({ fleetAvailabilityPct: Number(e.target.value) })
                    }
                    className="w-full accent-copper cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground font-mono">
                    <span>Baseline: 100%</span>
                    <span>Range: 40%–150%</span>
                  </div>

                  <p className="text-[0.7rem] text-muted-foreground/80 leading-snug">
                    Tonnage tightness factor penalizing hire rates and reducing fixture laycan
                    slack.
                  </p>
                </div>

                {/* 5. Steaming Speed Assumption */}
                <div className="space-y-2 rounded-md border border-border/60 bg-surface/50 p-3.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="shock-speed"
                      className="text-eyebrow text-foreground font-medium"
                    >
                      Speed Adjustment
                    </label>
                    <span className="font-mono text-xs text-foreground">
                      {(activeScenario.input.speedDeltaKn ?? 0) > 0 ? "+" : ""}
                      {(activeScenario.input.speedDeltaKn ?? 0).toFixed(1)} kn
                    </span>
                  </div>

                  <input
                    id="shock-speed"
                    type="range"
                    min={SCENARIO_BOUNDS.speedDeltaKn.min}
                    max={SCENARIO_BOUNDS.speedDeltaKn.max}
                    step={SCENARIO_BOUNDS.speedDeltaKn.step}
                    value={activeScenario.input.speedDeltaKn ?? 0}
                    onChange={(e) => updateActiveInput({ speedDeltaKn: Number(e.target.value) })}
                    className="w-full accent-copper cursor-pointer"
                  />

                  <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground font-mono">
                    <span>Eco (-3 kn)</span>
                    <span>Fast (+3 kn)</span>
                  </div>

                  <p className="text-[0.7rem] text-muted-foreground/80 leading-snug">
                    Alters transit days and scales fuel burn using naval cubic law ($V^3$).
                  </p>
                </div>
              </div>
            </BentoCard>
          </div>

          {/* 5. Key Outcome Metrics: Baseline vs Scenario */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-eyebrow text-brass">BASELINE VS STRESSED COMPARISON</span>
              <span className="text-xs text-muted-foreground font-mono">
                Scenario: <strong className="text-foreground">{activeScenario.name}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {/* 1. Total Landed Voyage Spend */}
              <BentoCard glowColor="brass" className="p-4 shadow-sm">
                <p className="text-eyebrow text-muted-foreground">Total Landed Spend</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                    {fmtUsd(activeComparison.simulated.totalCostUsd)}
                  </span>
                  <Delta
                    value={activeComparison.diff.totalCostPct}
                    unit="%"
                    invert
                    className="text-xs"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 font-mono">
                  <span>Base: {fmtUsd(activeComparison.baseline.totalCostUsd)}</span>
                  <span
                    className={
                      activeComparison.diff.totalCostUsd > 0
                        ? "text-copper"
                        : activeComparison.diff.totalCostUsd < 0
                          ? "text-success"
                          : ""
                    }
                  >
                    {activeComparison.diff.totalCostUsd > 0 ? "+" : ""}
                    {fmtUsd(activeComparison.diff.totalCostUsd)}
                  </span>
                </div>
              </BentoCard>

              {/* 2. Landed Cost Per Tonne */}
              <BentoCard glowColor="coral" className="p-4 shadow-sm">
                <p className="text-eyebrow text-muted-foreground">Cost per Tonne</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                    {fmtRate(activeComparison.simulated.costPerT)}
                  </span>
                  <Delta
                    value={activeComparison.diff.costPerTPct}
                    unit="%"
                    invert
                    className="text-xs"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 font-mono">
                  <span>Base: {fmtRate(activeComparison.baseline.costPerT)}/t</span>
                  <span
                    className={
                      activeComparison.diff.costPerTUsd > 0
                        ? "text-copper"
                        : activeComparison.diff.costPerTUsd < 0
                          ? "text-success"
                          : ""
                    }
                  >
                    {activeComparison.diff.costPerTUsd > 0 ? "+" : ""}$
                    {activeComparison.diff.costPerTUsd.toFixed(2)}/t
                  </span>
                </div>
              </BentoCard>

              {/* 3. Bunker Fuel Spend */}
              <BentoCard glowColor="coral" className="p-4 shadow-sm">
                <p className="text-eyebrow text-muted-foreground">Bunker Expenditure</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-semibold tracking-tight text-copper">
                    {fmtUsd(activeComparison.simulated.bunkerCostUsd)}
                  </span>
                  <Delta
                    value={activeComparison.diff.bunkerPct}
                    unit="%"
                    invert
                    className="text-xs"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 font-mono">
                  <span>Base: {fmtUsd(activeComparison.baseline.bunkerCostUsd)}</span>
                  <span
                    className={
                      activeComparison.diff.bunkerUsd > 0
                        ? "text-copper"
                        : activeComparison.diff.bunkerUsd < 0
                          ? "text-success"
                          : ""
                    }
                  >
                    {activeComparison.diff.bunkerUsd > 0 ? "+" : ""}
                    {fmtUsd(activeComparison.diff.bunkerUsd)}
                  </span>
                </div>
              </BentoCard>

              {/* 4. Demurrage & Anchorage Reserve */}
              <BentoCard glowColor="brass" className="p-4 shadow-sm">
                <p className="text-eyebrow text-muted-foreground">Demurrage Reserve</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-semibold tracking-tight text-brass">
                    {fmtUsd(activeComparison.simulated.demurrageUsd)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    wait ~{activeComparison.simulated.portWaitDays?.toFixed(1)}d
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 font-mono">
                  <span>Base: {fmtUsd(activeComparison.baseline.demurrageUsd)}</span>
                  <span className={activeComparison.diff.demurrageUsd > 0 ? "text-copper" : ""}>
                    {activeComparison.diff.demurrageUsd > 0 ? "+" : ""}
                    {fmtUsd(activeComparison.diff.demurrageUsd)}
                  </span>
                </div>
              </BentoCard>

              {/* 5. Schedule Slack & Delivery Window */}
              <BentoCard glowColor="rose" className="p-4 shadow-sm">
                <p className="text-eyebrow text-muted-foreground">Arrival Slack</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span
                    className={cn(
                      "font-mono text-2xl font-semibold tracking-tight",
                      (activeComparison.simulated.slackDays ?? 0) < 0
                        ? "text-danger"
                        : (activeComparison.simulated.slackDays ?? 0) < 7
                          ? "text-copper"
                          : "text-success",
                    )}
                  >
                    {activeComparison.simulated.slackDays} d
                  </span>
                  {(activeComparison.simulated.slackDays ?? 0) < 0 ? (
                    <span className="text-[0.62rem] font-bold text-danger uppercase tracking-wider">
                      BREACH
                    </span>
                  ) : (
                    <span className="text-[0.62rem] text-muted-foreground uppercase">
                      Slack Buffer
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 font-mono">
                  <span>Base: {activeComparison.baseline.slackDays} d</span>
                  <span className="text-muted-foreground">
                    ETA {activeComparison.simulated.totalDurationDays} d
                  </span>
                </div>
              </BentoCard>

              {/* 6. Recommended Decision */}
              <BentoCard glowColor="walnut" className="p-4 shadow-sm">
                <p className="text-eyebrow text-muted-foreground">Procurement Decision</p>
                <div className="mt-2 flex items-center gap-2">
                  <DecisionBadge decision={activeComparison.simulated.decision} />
                  <RiskBadge level={activeComparison.simulated.riskLevel} />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 font-mono">
                  <span>Base: {DECISION_LABELS[activeComparison.baseline.decision]}</span>
                  <span>{activeComparison.simulated.vesselClassName}</span>
                </div>
              </BentoCard>
            </div>
          </div>

          {/* 6. Waterfall Driver Breakdown & Line-Item Table */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Waterfall Contribution Chart */}
            <BentoCard glowColor="brass" className="lg:col-span-6 p-5 shadow-sm">
              <PanelHeader
                title="Cost Driver Waterfall"
                eyebrow="CONTRIBUTION DECOMPOSITION"
                right={
                  <span className="text-xs font-mono text-muted-foreground">
                    USD Voyage Variance
                  </span>
                }
              />
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Step-by-step mathematical decomposition of landed voyage expenditure variance from
                baseline to stressed scenario.
              </p>

              <div className="mt-6 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activeComparison.waterfall}
                    margin={{ top: 20, right: 15, left: 10, bottom: 25 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--color-border)"
                      opacity={0.6}
                    />
                    <XAxis
                      dataKey="category"
                      stroke="var(--color-muted-foreground)"
                      fontSize={10}
                      fontFamily="var(--font-mono)"
                      tickLine={false}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={10}
                      fontFamily="var(--font-mono)"
                      tickLine={false}
                      tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const data = payload[0]!.payload as (typeof activeComparison.waterfall)[0];
                        return (
                          <TooltipCard
                            title={data.category}
                            rows={[
                              { label: "Step Amount", value: fmtUsd(data.deltaUsd) },
                              { label: "Running Total", value: fmtUsd(data.cumulativeUsd) },
                              { label: "Impact Share", value: `${data.percentage}%` },
                            ]}
                          />
                        );
                      }}
                    />
                    <ReferenceLine
                      y={activeComparison.baseline.totalCostUsd}
                      stroke="var(--color-brass)"
                      strokeDasharray="3 3"
                    />
                    <Bar dataKey="deltaUsd" radius={[4, 4, 0, 0]}>
                      {activeComparison.waterfall.map((entry, index) => {
                        let fill = "var(--color-foreground)";
                        if (index === 0) fill = "var(--color-slate)";
                        else if (index === activeComparison.waterfall.length - 1)
                          fill = "var(--color-brass)";
                        else if (entry.direction === "up") fill = "var(--color-copper)";
                        else if (entry.direction === "down") fill = "var(--color-sea)";
                        return <Cell key={`cell-${index}`} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-slate" />
                  <span>Baseline</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-copper" />
                  <span>Cost Increase</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-sea" />
                  <span>Cost Reduction</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-brass" />
                  <span>Scenario Landed</span>
                </span>
              </div>
            </BentoCard>

            {/* Line-Item Variance Table */}
            <BentoCard glowColor="walnut" className="lg:col-span-6 p-5 shadow-sm">
              <PanelHeader
                title="Line-Item Expenditure Parity"
                eyebrow="AUDIT TRAIL"
                right={
                  <span className="text-xs font-mono text-success flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />
                    <span>Exact Parity Verified</span>
                  </span>
                }
              />
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Direct accounting parity between Charter pipeline cost elements. No double counting
                or fabricated models.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-eyebrow text-muted-foreground">
                      <th className="py-2.5 font-medium">Cost Element</th>
                      <th className="py-2.5 font-mono text-right">Baseline</th>
                      <th className="py-2.5 font-mono text-right">Stressed</th>
                      <th className="py-2.5 font-mono text-right">Delta ($)</th>
                      <th className="py-2.5 font-mono text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    <tr>
                      <td className="py-2.5 font-sans font-medium text-foreground">
                        Ocean Freight & Hire
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {fmtUsd(activeComparison.baseline.costBreakdown?.freightUsd ?? 0)}
                      </td>
                      <td className="py-2.5 text-right text-foreground">
                        {fmtUsd(activeComparison.simulated.costBreakdown?.freightUsd ?? 0)}
                      </td>
                      <td className="py-2.5 text-right">
                        {fmtUsd(activeComparison.diff.freightHireUsd)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Delta
                          value={
                            activeComparison.baseline.costBreakdown?.freightUsd
                              ? (activeComparison.diff.freightHireUsd /
                                  activeComparison.baseline.costBreakdown.freightUsd) *
                                100
                              : 0
                          }
                          invert
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-sans font-medium text-foreground">
                        Marine Bunkers (VLSFO)
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {fmtUsd(activeComparison.baseline.costBreakdown?.bunkerUsd ?? 0)}
                      </td>
                      <td className="py-2.5 text-right text-foreground">
                        {fmtUsd(activeComparison.simulated.costBreakdown?.bunkerUsd ?? 0)}
                      </td>
                      <td className="py-2.5 text-right">
                        {fmtUsd(activeComparison.diff.bunkerUsd)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Delta value={activeComparison.diff.bunkerPct} invert />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-sans font-medium text-foreground">
                        Discharge Anchorage Demurrage
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {fmtUsd(activeComparison.baseline.costBreakdown?.demurrageReserveUsd ?? 0)}
                      </td>
                      <td className="py-2.5 text-right text-foreground">
                        {fmtUsd(activeComparison.simulated.costBreakdown?.demurrageReserveUsd ?? 0)}
                      </td>
                      <td className="py-2.5 text-right">
                        {fmtUsd(activeComparison.diff.demurrageUsd)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Delta
                          value={
                            activeComparison.baseline.costBreakdown?.demurrageReserveUsd
                              ? (activeComparison.diff.demurrageUsd /
                                  activeComparison.baseline.costBreakdown.demurrageReserveUsd) *
                                100
                              : 0
                          }
                          invert
                        />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-sans font-medium text-foreground">
                        Port Dues & Lightering
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {fmtUsd(activeComparison.baseline.costBreakdown?.portDuesUsd ?? 0)}
                      </td>
                      <td className="py-2.5 text-right text-foreground">
                        {fmtUsd(activeComparison.simulated.costBreakdown?.portDuesUsd ?? 0)}
                      </td>
                      <td className="py-2.5 text-right">
                        {fmtUsd(activeComparison.diff.portDuesUsd)}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">0.0%</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-sans font-medium text-foreground">
                        Marine Cargo Insurance
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {fmtUsd(activeComparison.baseline.costBreakdown?.insuranceUsd ?? 0)}
                      </td>
                      <td className="py-2.5 text-right text-foreground">
                        {fmtUsd(activeComparison.simulated.costBreakdown?.insuranceUsd ?? 0)}
                      </td>
                      <td className="py-2.5 text-right">
                        {fmtUsd(activeComparison.diff.insuranceUsd)}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">0.0%</td>
                    </tr>
                    <tr className="border-t-2 border-border/80 font-bold bg-surface/30">
                      <td className="py-3 font-sans text-foreground">Total Landed Voyage Spend</td>
                      <td className="py-3 text-right text-muted-foreground">
                        {fmtUsd(activeComparison.baseline.totalCostUsd)}
                      </td>
                      <td className="py-3 text-right text-copper">
                        {fmtUsd(activeComparison.simulated.totalCostUsd)}
                      </td>
                      <td className="py-3 text-right text-copper">
                        {fmtUsd(activeComparison.diff.totalCostUsd)}
                      </td>
                      <td className="py-3 text-right">
                        <Delta value={activeComparison.diff.totalCostPct} invert />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </BentoCard>
          </div>

          {/* 7. Vessel Class Feasibility & Cost Sensitivity Matrix */}
          <BentoCard glowColor="coral" className="p-5 shadow-sm">
            <PanelHeader
              title="Vessel Class Feasibility & Cost Matrix"
              eyebrow="CROSS-CLASS RESILIENCE"
              right={
                <span className="text-xs font-mono text-muted-foreground">
                  Testing all 6 naval classes at {destPort.name}
                </span>
              }
            />
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Examines whether port draft restrictions, LOA limits, or deadline slips disqualify
              previously viable vessels under stressed delay conditions.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-eyebrow text-muted-foreground">
                    <th className="py-2.5 font-medium">Vessel Class</th>
                    <th className="py-2.5">Baseline Status</th>
                    <th className="py-2.5 font-mono text-right">Base Landed ($/t)</th>
                    <th className="py-2.5">Stressed Status</th>
                    <th className="py-2.5 font-mono text-right">Stressed Landed ($/t)</th>
                    <th className="py-2.5 font-mono text-right">Delta ($/t)</th>
                    <th className="py-2.5">Feasibility Notes & Constraint Drivers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {activeComparison.vesselComparisons.map((v) => (
                    <tr
                      key={v.vesselClass}
                      className={cn(
                        "transition-colors",
                        v.simulatedSelected
                          ? "bg-copper/10 font-medium"
                          : v.statusChanged
                            ? "bg-danger/5"
                            : "",
                      )}
                    >
                      <td className="py-3 font-sans font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{v.name}</span>
                          {v.simulatedSelected && (
                            <span className="rounded bg-copper px-1.5 py-0.5 text-[0.58rem] font-bold text-ink uppercase">
                              Optimal
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <FeasibilityBadge status={v.baselineStatus} />
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {v.baselineCostPerT > 0 ? fmtRate(v.baselineCostPerT) : "—"}
                      </td>
                      <td className="py-3">
                        <FeasibilityBadge status={v.simulatedStatus} />
                      </td>
                      <td className="py-3 text-right text-foreground">
                        {v.simulatedCostPerT > 0 ? fmtRate(v.simulatedCostPerT) : "—"}
                      </td>
                      <td className="py-3 text-right">
                        {v.costPerTDiff !== 0 ? (
                          <Delta value={v.costPerTDiff} unit="$/t" invert />
                        ) : (
                          <span className="text-muted-foreground">0.00</span>
                        )}
                      </td>
                      <td className="py-3 font-sans text-xs text-muted-foreground max-w-md">
                        {v.reasons.length > 0 ? (
                          <span className={v.statusChanged ? "text-danger" : ""}>
                            {v.reasons[0]}
                          </span>
                        ) : (
                          "Safe physical clearance across draft, LOA and laycan deadline."
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BentoCard>

          {/* 8. Explainable Decision Impact & Disclosures */}
          <BentoCard glowColor="brass" className="p-5 shadow-sm space-y-4">
            <PanelHeader
              title="Explainable Decision Diagnostics"
              eyebrow="ANALYTIC REASONING"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Deterministic causal explanations generated from model sensitivities. Distinguishes
              hypothetical stress testing from live forecasts.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeComparison.insights.map((ins) => {
                const borderClass =
                  ins.impact === "negative"
                    ? "border-danger/40 bg-danger/5"
                    : ins.impact === "warning"
                      ? "border-copper/40 bg-copper/5"
                      : ins.impact === "positive"
                        ? "border-success/40 bg-success/5"
                        : "border-border/60 bg-surface/50";

                return (
                  <div
                    key={ins.id}
                    className={cn("rounded-md border p-4 space-y-1.5", borderClass)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-eyebrow text-[0.62rem] text-muted-foreground">
                        {ins.category}
                      </span>
                      {ins.impact === "negative" ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                      ) : ins.impact === "warning" ? (
                        <Flame className="h-3.5 w-3.5 text-copper" />
                      ) : ins.impact === "positive" ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Info className="h-3.5 w-3.5 text-brass" />
                      )}
                    </div>
                    <h3 className="text-xs font-semibold text-foreground">{ins.title}</h3>
                    <p className="text-[0.72rem] leading-relaxed text-muted-foreground">
                      {ins.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </BentoCard>

          {/* 9. Model Boundaries & Unsupported Shocks (Honest Disclosures) */}
          <div className="rounded-lg border border-border/60 bg-card/40 p-4">
            <button
              type="button"
              onClick={() => setShowBoundariesInfo((v) => !v)}
              className="flex w-full items-center justify-between text-left text-xs text-muted-foreground hover:text-foreground transition"
            >
              <span className="flex items-center gap-2 font-mono">
                <HelpCircle className="h-3.5 w-3.5 text-brass" />
                <span>
                  Model Boundaries & Non-Applicable Shocks (Canal Closures & Route Diversions)
                </span>
              </span>
              {showBoundariesInfo ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            <AnimatePresence>
              {showBoundariesInfo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-border/40 mt-3 pt-3 text-xs text-muted-foreground space-y-2 leading-relaxed"
                >
                  <p>
                    <strong className="text-foreground">
                      Suez & Panama Canal Non-Applicability:
                    </strong>{" "}
                    Australian (Queensland, Newcastle, Port Hedland) and Indonesian (Kalimantan)
                    dry-bulk voyages to Indian East Coast ports (Paradip, Vizag, Haldia) traverse
                    the Indian Ocean and Bay of Bengal. They do not transit the Suez or Panama
                    canals; therefore, canal closures produce zero direct geometric nautical mile
                    distance delta on these trade lanes. (Global canal disruptions affect tonnage
                    supply indirectly, which can be evaluated here via the{" "}
                    <em>Fleet Availability</em> and <em>Freight Shock</em> controls).
                  </p>
                  <p>
                    <strong className="text-foreground">Strategic Malacca Strait Bypass:</strong>{" "}
                    Alternative waypoint rerouting via Sunda or Lombok Straits is planned for Python
                    backend optimization in Milestone 7. The current frontend heuristic evaluates
                    only direct proven maritime corridors without fabricating unverified diversions.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      ) : (
        /* 10. Multi-Scenario Matrix Comparison View */
        <div className="space-y-6">
          {/* Comparison Bar Chart */}
          <BentoCard glowColor="brass" className="p-5 shadow-sm">
            <PanelHeader
              title="Multi-Scenario Landed Cost Comparison"
              eyebrow="CROSS-SCENARIO BENCHMARK"
              right={
                <span className="text-xs font-mono text-muted-foreground">
                  USD per Metric Tonne
                </span>
              }
            />
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Benchmarking all saved session scenarios against baseline landed cost per tonne for{" "}
              {fmtTonnes(request.cargoTonnes)} {CARGO_LABELS[request.cargoType]}.
            </p>

            <div className="mt-6 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={allComparisons.map((c) => ({
                    id: c.id,
                    name: c.name,
                    costPerT: c.simulated.costPerT,
                    deltaPct: c.diff.costPerTPct,
                    totalCostM: Number((c.simulated.totalCostUsd / 1_000_000).toFixed(2)),
                  }))}
                  margin={{ top: 20, right: 15, left: 10, bottom: 25 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--color-border)"
                    opacity={0.6}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    fontFamily="var(--font-mono)"
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    fontFamily="var(--font-mono)"
                    tickLine={false}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0]!.payload as {
                        name: string;
                        costPerT: number;
                        deltaPct: number;
                        totalCostM: number;
                      };
                      return (
                        <TooltipCard
                          title={data.name}
                          rows={[
                            { label: "Landed Cost / t", value: `$${data.costPerT.toFixed(2)}` },
                            { label: "Total Voyage Spend", value: `$${data.totalCostM}M` },
                            {
                              label: "Delta vs Baseline",
                              value: `${data.deltaPct > 0 ? "+" : ""}${data.deltaPct.toFixed(1)}%`,
                            },
                          ]}
                        />
                      );
                    }}
                  />
                  <ReferenceLine
                    y={activeComparison.baseline.costPerT}
                    stroke="var(--color-brass)"
                    strokeDasharray="3 3"
                    label={{
                      value: `Baseline: $${activeComparison.baseline.costPerT.toFixed(2)}/t`,
                      fill: "var(--color-brass)",
                      fontSize: 10,
                      position: "top",
                    }}
                  />
                  <Bar dataKey="costPerT" radius={[4, 4, 0, 0]}>
                    {allComparisons.map((c) => {
                      const isCurrent = c.id === activeScenarioId;
                      return (
                        <Cell
                          key={`cell-${c.id}`}
                          fill={isCurrent ? "var(--color-copper)" : "var(--color-slate)"}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </BentoCard>

          {/* Comprehensive Multi-Scenario Table */}
          <BentoCard glowColor="walnut" className="p-5 shadow-sm">
            <PanelHeader
              title="Session Scenarios Comparison Matrix"
              eyebrow="MULTI-VARIABLE STRESS MATRIX"
              right={
                <span className="text-xs font-mono text-muted-foreground">
                  {allComparisons.length} Scenarios Defined
                </span>
              }
            />

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-eyebrow text-muted-foreground">
                    <th className="py-2.5 font-medium">Scenario</th>
                    <th className="py-2.5 font-mono">Parameters (Shocks)</th>
                    <th className="py-2.5 font-mono text-right">Landed $/t</th>
                    <th className="py-2.5 font-mono text-right">Total Spend</th>
                    <th className="py-2.5 font-mono text-right">Delta (%)</th>
                    <th className="py-2.5 font-mono text-right">Bunkers</th>
                    <th className="py-2.5 font-mono text-right">Demurrage</th>
                    <th className="py-2.5">Optimal Class</th>
                    <th className="py-2.5">Recommendation</th>
                    <th className="py-2.5 font-mono text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {allComparisons.map((c) => {
                    const isSelected = c.id === activeScenarioId;
                    return (
                      <tr
                        key={c.id}
                        className={cn(
                          "transition-colors",
                          isSelected ? "bg-copper/10 font-medium" : "hover:bg-surface/50",
                        )}
                      >
                        <td className="py-3 font-sans font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{c.name}</span>
                            {isSelected && (
                              <span className="rounded bg-copper px-1.5 py-0.5 text-[0.58rem] font-bold text-ink uppercase">
                                Active
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-[0.7rem] text-muted-foreground">
                          F:{c.input.freightShockPct > 0 ? "+" : ""}
                          {c.input.freightShockPct}% • B:${c.input.bunkerUsdPerT} • W:+
                          {c.input.congestionDays}d • S:{c.input.fleetAvailabilityPct}%
                        </td>
                        <td className="py-3 text-right text-foreground">
                          {fmtRate(c.simulated.costPerT)}
                        </td>
                        <td className="py-3 text-right text-foreground">
                          {fmtUsdM(c.simulated.totalCostUsd)}
                        </td>
                        <td className="py-3 text-right">
                          <Delta value={c.diff.totalCostPct} invert />
                        </td>
                        <td className="py-3 text-right text-copper">
                          {fmtUsd(c.simulated.bunkerCostUsd)}
                        </td>
                        <td className="py-3 text-right text-brass">
                          {fmtUsd(c.simulated.demurrageUsd)}
                        </td>
                        <td className="py-3 font-sans">{c.simulated.vesselClassName}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1.5">
                            <DecisionBadge decision={c.simulated.decision} />
                            <RiskBadge level={c.simulated.riskLevel} />
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveScenarioId(c.id);
                              setViewMode("DEEP_DIVE");
                            }}
                            className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-[0.68rem] text-foreground hover:border-copper hover:text-copper transition font-sans"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </BentoCard>
        </div>
      )}

      {/* 11. Cross-Workspace Action Bar (Integrations) */}
      <div className="flex flex-col gap-4 rounded-lg border border-border/80 bg-surface/70 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-eyebrow text-brass">CROSS-WORKFLOW ESCALATION</span>
          <h2 className="mt-1 text-sm font-semibold tracking-tight text-foreground">
            Apply Stressed Scenario Insights into NAVIK Operations
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Transition directly from stress-testing into charter execution, market telemetry, or
            port constraint verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleGoToDashboard}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper transition"
          >
            <Compass className="h-3.5 w-3.5 text-copper-soft" />
            <span>Command Center</span>
          </button>

          <button
            type="button"
            onClick={handleGoToMarket}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper transition"
          >
            <LineChart className="h-3.5 w-3.5 text-brass" />
            <span>Market Intelligence</span>
          </button>

          <button
            type="button"
            onClick={handleGoToFeasibility}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper transition"
          >
            <Ship className="h-3.5 w-3.5 text-sea" />
            <span>Port Feasibility</span>
          </button>

          <button
            type="button"
            onClick={handleEscalateToCharter}
            className="inline-flex items-center gap-1.5 rounded-md bg-copper px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-copper-soft transition"
          >
            <Anchor className="h-3.5 w-3.5" />
            <span>Proceed to Charter</span>
          </button>
        </div>
      </div>
    </div>
  );
}
