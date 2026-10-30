/**
 * NAVIK Portfolio & Repositioning Strategy Workspace.
 *
 * Strategic procurement and fleet-planning terminal for SAIL bulk cargo inflows.
 * Evaluates multi-origin sourcing allocations, East Coast port gateways,
 * vessel class trade-offs, supply concentration risks (HHI), port feasibility,
 * and ballast repositioning offsets.
 */
import { useCallback, useId, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
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
  Filter,
  Flame,
  Fuel,
  Gauge,
  HelpCircle,
  Info,
  Layers,
  LineChart,
  Navigation,
  Package,
  PieChart,
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
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
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
  Allocation,
  CargoType,
  ContractPreference,
  CostBreakdown,
  FeasibilityStatus,
  OpportunityLane,
  OriginRegion,
  PortfolioRecommendation,
  PortfolioSensitivityPoint,
  PortfolioStrategy,
  PortCode,
  ProcurementObjective,
  RiskPreference,
  SourcingStem,
  VesselClassId,
} from "@/lib/api/types";
import {
  OPPORTUNITY_LANES,
  PRESET_ALLOCATIONS,
  buildCandidatePortfolios,
  cloneStrategyAsCustom,
  computeHHI,
  computePortfolioStrategy,
  evaluatePortfolioSensitivities,
  evaluateSourcingStem,
  generatePortfolioRecommendation,
  rebalanceStemsToDemand,
} from "@/lib/sim/portfolio";
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
import { BackendInsightsCard } from "./BackendInsightsCard";

/* ═══════════════════════════════════════════════
   Objective Constants & Presets
   ═══════════════════════════════════════════════ */

const OBJECTIVE_OPTIONS: {
  id: ProcurementObjective;
  label: string;
  badge: string;
  desc: string;
}[] = [
  {
    id: "LOWEST_COST",
    label: "Cost-Optimized Scale",
    badge: "Lowest $/t",
    desc: "Maximizes large bulkers (Capesize/Kamsarmax) into deep-water Gangavaram and Paradip.",
  },
  {
    id: "BALANCED_RESILIENCE",
    label: "Resilient Sourcing Mix",
    badge: "Recommended",
    desc: "Multi-origin diversification across Queensland, NSW, and Kalimantan to mitigate single-corridor disruption.",
  },
  {
    id: "SCHEDULE_RELIABILITY",
    label: "Congestion-Hedged Flow",
    badge: "Fast Turnaround",
    desc: "Bypasses high-queue anchorages in favor of Gangavaram and Dhamra deep private berths.",
  },
  {
    id: "MINIMIZE_CONGESTION",
    label: "Anchor-Queue Hedged",
    badge: "Low Demurrage",
    desc: "Balances discharge across 3 East Coast ports to keep average waiting times below 1.8 days.",
  },
  {
    id: "CUSTOM",
    label: "Custom Sourcing Plan",
    badge: "Interactive",
    desc: "Interactive stem-level allocation tailored to specific steel plant demands and constraints.",
  },
];

const DEMAND_PRESETS = [1_200_000, 1_600_000, 2_400_000, 3_200_000];

export function PortfolioWorkspace() {
  const navigate = useNavigate();

  // Procurement demand configuration
  const [totalDemandT, setTotalDemandT] = useState<number>(1_600_000);
  const [cargoType, setCargoType] = useState<CargoType>("COKING_COAL");
  const [deliveryDeadline, setDeliveryDeadline] = useState<string>("2026-12-31");
  const [targetBudgetUsdPerT, setTargetBudgetUsdPerT] = useState<number>(18.5);
  const [creditRepositioning, setCreditRepositioning] = useState<boolean>(true);
  const [repositioningParticipationPct, setRepositioningParticipationPct] = useState<number>(100);

  // Filter toggles
  const [showFilterDrawer, setShowFilterDrawer] = useState<boolean>(false);
  const [allowedOrigins, setAllowedOrigins] = useState<OriginRegion[]>([
    "AUS_QLD",
    "AUS_NSW",
    "AUS_WA",
    "IDN_KAL",
  ]);
  const [allowedPorts, setAllowedPorts] = useState<PortCode[]>([
    "PRDP",
    "GGVM",
    "DHMR",
    "VIZG",
    "HLDA",
  ]);
  const [allowedVessels, setAllowedVessels] = useState<VesselClassId[]>([
    "CAPESIZE",
    "NEWCASTLEMAX",
    "KAMSARMAX",
    "PANAMAX",
    "ULTRAMAX",
    "SUPRAMAX",
  ]);

  // Strategy & tab state
  const [activeObjective, setActiveObjective] =
    useState<ProcurementObjective>("BALANCED_RESILIENCE");
  const [activeTab, setActiveTab] = useState<
    "ALLOCATIONS" | "STRATEGIES" | "REPOSITIONING" | "SENSITIVITIES"
  >("ALLOCATIONS");

  // Custom stems state (editable)
  const [customStems, setCustomStems] = useState<SourcingStem[] | null>(null);

  // Drill-down inspection modals
  const [inspectedStrategy, setInspectedStrategy] = useState<PortfolioStrategy | null>(null);
  const [inspectedStem, setInspectedStem] = useState<SourcingStem | null>(null);

  // Reference date
  const now = useMemo(() => new Date("2026-10-25T06:00:00Z"), []);

  // Days to laycan deadline
  const daysToDeadline = useMemo(() => {
    const to = new Date(`${deliveryDeadline}T00:00:00Z`).getTime();
    return Math.max(0, Math.round((to - now.getTime()) / (1000 * 60 * 60 * 24)));
  }, [deliveryDeadline, now]);

  // Candidate strategies built dynamically from total demand and active filters
  const candidatePortfolios = useMemo(() => {
    return buildCandidatePortfolios(totalDemandT, {
      cargoType,
      deliveryDeadline,
      now,
      allowedOrigins,
      allowedPorts,
      allowedVesselClasses: allowedVessels,
    });
  }, [
    totalDemandT,
    cargoType,
    deliveryDeadline,
    now,
    allowedOrigins,
    allowedPorts,
    allowedVessels,
  ]);

  // Initial custom stems setup
  const effectiveCustomStems = useMemo(() => {
    return customStems ?? candidatePortfolios.BALANCED_RESILIENCE.stems;
  }, [customStems, candidatePortfolios.BALANCED_RESILIENCE.stems]);

  // Active strategy
  const activeStrategy: PortfolioStrategy = useMemo(() => {
    if (activeObjective === "CUSTOM") {
      return computePortfolioStrategy({
        id: "strat-custom",
        name: "Custom Sourcing Plan",
        objective: "CUSTOM",
        description:
          "User-configured stem allocation across origins, ports, vessel classes, and contract commitments.",
        totalDemandT,
        stems: effectiveCustomStems,
        riskPreference: "BALANCED",
      });
    }
    return candidatePortfolios[activeObjective];
  }, [activeObjective, candidatePortfolios, totalDemandT, effectiveCustomStems]);

  // Candidate strategies array for comparison
  const allStrategies: PortfolioStrategy[] = useMemo(() => {
    return [
      candidatePortfolios.LOWEST_COST,
      candidatePortfolios.BALANCED_RESILIENCE,
      candidatePortfolios.SCHEDULE_RELIABILITY,
      candidatePortfolios.MINIMIZE_CONGESTION,
      ...(activeObjective === "CUSTOM"
        ? [
            computePortfolioStrategy({
              id: "strat-custom",
              name: "Custom Sourcing Plan",
              objective: "CUSTOM",
              description:
                "User-configured stem allocation across origins, ports, vessel classes, and contract commitments.",
              totalDemandT,
              stems: effectiveCustomStems,
              riskPreference: "BALANCED",
            }),
          ]
        : []),
    ];
  }, [candidatePortfolios, activeObjective, totalDemandT, effectiveCustomStems]);

  // Explainable recommendation
  const recommendation: PortfolioRecommendation = useMemo(() => {
    return generatePortfolioRecommendation(allStrategies, activeObjective);
  }, [allStrategies, activeObjective]);

  // Sensitivity analysis under scenario shocks
  const sensitivities: PortfolioSensitivityPoint[] = useMemo(() => {
    return evaluatePortfolioSensitivities(activeStrategy, cargoType, deliveryDeadline, now);
  }, [activeStrategy, cargoType, deliveryDeadline, now]);

  // Effective cost per tonne reflecting repositioning setting
  const effectiveUnitCost = useMemo(() => {
    if (creditRepositioning) {
      const scaledSavings =
        activeStrategy.totalRepositioningSavingsUsd * (repositioningParticipationPct / 100);
      return activeStrategy.allocatedT > 0
        ? Math.round(
            ((activeStrategy.totalSpendUsd - scaledSavings) / activeStrategy.allocatedT) * 100,
          ) / 100
        : activeStrategy.weightedCostPerT;
    }
    return activeStrategy.weightedCostPerT;
  }, [creditRepositioning, repositioningParticipationPct, activeStrategy]);

  // Budget comparison
  const budgetVarianceUsdPerT = useMemo(() => {
    return Math.round((effectiveUnitCost - targetBudgetUsdPerT) * 100) / 100;
  }, [effectiveUnitCost, targetBudgetUsdPerT]);

  // Custom stem handlers
  const handleUpdateStemTonnage = useCallback(
    (stemId: string, newTonnes: number) => {
      setCustomStems((prev) => {
        const list = prev ?? candidatePortfolios.BALANCED_RESILIENCE.stems;
        return list.map((s) => {
          if (s.id !== stemId) return s;
          return evaluateSourcingStem({
            id: s.id,
            origin: s.origin,
            destination: s.destination,
            tonnes: Math.max(10_000, newTonnes),
            vesselClass: s.vesselClass,
            contractPreference: s.contractPreference,
            cargoType,
            deliveryDeadline,
            now,
          });
        });
      });
    },
    [candidatePortfolios.BALANCED_RESILIENCE.stems, cargoType, deliveryDeadline, now],
  );

  const handleUpdateStemVessel = useCallback(
    (stemId: string, newVessel: VesselClassId) => {
      setCustomStems((prev) => {
        const list = prev ?? candidatePortfolios.BALANCED_RESILIENCE.stems;
        return list.map((s) => {
          if (s.id !== stemId) return s;
          return evaluateSourcingStem({
            id: s.id,
            origin: s.origin,
            destination: s.destination,
            tonnes: s.tonnes,
            vesselClass: newVessel,
            contractPreference: s.contractPreference,
            cargoType,
            deliveryDeadline,
            now,
          });
        });
      });
    },
    [candidatePortfolios.BALANCED_RESILIENCE.stems, cargoType, deliveryDeadline, now],
  );

  const handleUpdateStemOrigin = useCallback(
    (stemId: string, newOrigin: OriginRegion) => {
      setCustomStems((prev) => {
        const list = prev ?? candidatePortfolios.BALANCED_RESILIENCE.stems;
        return list.map((s) => {
          if (s.id !== stemId) return s;
          return evaluateSourcingStem({
            id: s.id,
            origin: newOrigin,
            destination: s.destination,
            tonnes: s.tonnes,
            vesselClass: s.vesselClass,
            contractPreference: s.contractPreference,
            cargoType,
            deliveryDeadline,
            now,
          });
        });
      });
    },
    [candidatePortfolios.BALANCED_RESILIENCE.stems, cargoType, deliveryDeadline, now],
  );

  const handleUpdateStemDestination = useCallback(
    (stemId: string, newDest: PortCode) => {
      setCustomStems((prev) => {
        const list = prev ?? candidatePortfolios.BALANCED_RESILIENCE.stems;
        return list.map((s) => {
          if (s.id !== stemId) return s;
          return evaluateSourcingStem({
            id: s.id,
            origin: s.origin,
            destination: newDest,
            tonnes: s.tonnes,
            vesselClass: s.vesselClass,
            contractPreference: s.contractPreference,
            cargoType,
            deliveryDeadline,
            now,
          });
        });
      });
    },
    [candidatePortfolios.BALANCED_RESILIENCE.stems, cargoType, deliveryDeadline, now],
  );

  const handleAddCustomStem = useCallback(() => {
    const newId = `stem-custom-${Date.now()}`;
    const newStem = evaluateSourcingStem({
      id: newId,
      origin: allowedOrigins[0] ?? "AUS_QLD",
      destination: allowedPorts[0] ?? "PRDP",
      tonnes: 160_000,
      vesselClass: allowedVessels[0] ?? "KAMSARMAX",
      contractPreference: "SHORT_TERM",
      cargoType,
      deliveryDeadline,
      now,
    });
    setCustomStems((prev) => [...(prev ?? candidatePortfolios.BALANCED_RESILIENCE.stems), newStem]);
  }, [
    allowedOrigins,
    allowedPorts,
    allowedVessels,
    candidatePortfolios.BALANCED_RESILIENCE.stems,
    cargoType,
    deliveryDeadline,
    now,
  ]);

  const handleRemoveCustomStem = useCallback(
    (stemId: string) => {
      setCustomStems((prev) => {
        const list = prev ?? candidatePortfolios.BALANCED_RESILIENCE.stems;
        if (list.length <= 1) return list;
        return list.filter((s) => s.id !== stemId);
      });
    },
    [candidatePortfolios.BALANCED_RESILIENCE.stems],
  );

  const handleRebalanceTonnage = useCallback(() => {
    const list = customStems ?? candidatePortfolios.BALANCED_RESILIENCE.stems;
    const rebalanced = rebalanceStemsToDemand(list, totalDemandT, cargoType, deliveryDeadline, now);
    setCustomStems(rebalanced);
  }, [
    customStems,
    candidatePortfolios.BALANCED_RESILIENCE.stems,
    totalDemandT,
    cargoType,
    deliveryDeadline,
    now,
  ]);

  const handleClonePreset = useCallback(
    (obj: ProcurementObjective) => {
      const sourceStrat = candidatePortfolios[obj];
      const cloned = cloneStrategyAsCustom(
        sourceStrat,
        totalDemandT,
        cargoType,
        deliveryDeadline,
        now,
      );
      setCustomStems(cloned);
      setActiveObjective("CUSTOM");
    },
    [candidatePortfolios, totalDemandT, cargoType, deliveryDeadline, now],
  );

  // Filter toggling helpers
  const toggleOrigin = (orig: OriginRegion) => {
    setAllowedOrigins((prev) => {
      if (prev.includes(orig)) {
        if (prev.length <= 1) return prev;
        return prev.filter((o) => o !== orig);
      }
      return [...prev, orig];
    });
  };

  const togglePort = (port: PortCode) => {
    setAllowedPorts((prev) => {
      if (prev.includes(port)) {
        if (prev.length <= 1) return prev;
        return prev.filter((p) => p !== port);
      }
      return [...prev, port];
    });
  };

  const toggleVessel = (vessel: VesselClassId) => {
    setAllowedVessels((prev) => {
      if (prev.includes(vessel)) {
        if (prev.length <= 1) return prev;
        return prev.filter((v) => v !== vessel);
      }
      return [...prev, vessel];
    });
  };

  // Cross-workspace navigation
  const handleGoToCharter = (origin?: OriginRegion, dest?: PortCode, vessel?: VesselClassId) => {
    navigate({ to: "/charter" });
  };
  const handleGoToMarket = (origin?: OriginRegion) => {
    navigate({ to: "/market" });
  };
  const handleGoToFeasibility = (port?: PortCode, vessel?: VesselClassId) => {
    navigate({ to: "/feasibility" });
  };
  const handleGoToScenarios = () => {
    navigate({ to: "/scenarios" });
  };
  const handleGoToDashboard = () => {
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header & Terminal Controls */}
      <PageHeader
        eyebrow="WORKSPACE 06 / PORTFOLIO & REPOSITIONING"
        title="Portfolio Strategy"
        accent="& Fleet Repositioning"
        description="Strategic bulk-cargo procurement and sourcing optimization for India's East Coast steelmaking supply chain. Evaluates multi-origin allocations, discharge port constraints, contract duration mix, and ballast repositioning offsets."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGoToScenarios}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper transition"
            >
              <Sliders className="h-3.5 w-3.5 text-brass" />
              <span>Stress in Scenario Lab</span>
            </button>

            <button
              type="button"
              onClick={() => handleGoToCharter()}
              className="inline-flex items-center gap-1.5 rounded-md bg-copper px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-copper-soft transition"
            >
              <Anchor className="h-3.5 w-3.5" />
              <span>Fix in Charter</span>
            </button>
          </div>
        }
      />

      {/* 2. Procurement Programme Configuration Bar */}
      <BentoCard glowColor="brass" className="p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Total Demand Input */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="target-demand" className="text-eyebrow text-muted-foreground">
                Total Programme Demand
              </label>
            </div>
            <div className="relative">
              <input
                id="target-demand"
                type="number"
                step={50_000}
                min={100_000}
                max={5_000_000}
                value={totalDemandT}
                onChange={(e) =>
                  setTotalDemandT(Math.max(100_000, Number(e.target.value) || 1_600_000))
                }
                className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-copper focus:outline-none"
              />
              <span className="absolute right-3 top-2 text-xs font-mono text-muted-foreground">
                MT
              </span>
            </div>
            {/* Demand presets */}
            <div className="mt-1.5 flex items-center gap-1">
              {DEMAND_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTotalDemandT(p)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[0.62rem] font-mono transition",
                    totalDemandT === p
                      ? "bg-copper/20 text-copper font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {(p / 1_000_000).toFixed(1)}M
                </button>
              ))}
            </div>
          </div>

          {/* Commodity Selector */}
          <div>
            <label
              htmlFor="commodity-type"
              className="text-eyebrow text-muted-foreground block mb-1.5"
            >
              Commodity
            </label>
            <select
              id="commodity-type"
              value={cargoType}
              onChange={(e) => setCargoType(e.target.value as CargoType)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-copper focus:outline-none"
            >
              <option value="COKING_COAL">Coking Coal (Metallurgical — Core)</option>
              <option value="THERMAL_COAL">Thermal Coal</option>
              <option value="IRON_ORE">Iron Ore</option>
              <option value="LIMESTONE">Limestone / Flux</option>
            </select>
            <span className="text-[0.65rem] text-muted-foreground mt-1 block">
              SAIL East Coast Blast Furnace intake
            </span>
          </div>

          {/* Delivery Window */}
          <div>
            <label
              htmlFor="laycan-deadline"
              className="text-eyebrow text-muted-foreground block mb-1.5"
            >
              Delivery Programme Window
            </label>
            <input
              id="laycan-deadline"
              type="date"
              value={deliveryDeadline}
              onChange={(e) => setDeliveryDeadline(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-copper focus:outline-none"
            />
            <span className="text-[0.65rem] text-brass mt-1 block font-mono">
              ~{daysToDeadline} days to laycan completion
            </span>
          </div>

          {/* Target Landed Cost Budget */}
          <div>
            <label
              htmlFor="target-budget"
              className="text-eyebrow text-muted-foreground block mb-1.5"
            >
              Target Landed Cost ($/t)
            </label>
            <div className="relative">
              <input
                id="target-budget"
                type="number"
                step={0.25}
                min={10}
                max={40}
                value={targetBudgetUsdPerT}
                onChange={(e) => setTargetBudgetUsdPerT(Number(e.target.value) || 18.5)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground focus:border-copper focus:outline-none"
              />
              <span className="absolute right-3 top-2 text-xs font-mono text-muted-foreground">
                CIF
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[0.65rem] font-mono">
              <span className="text-muted-foreground">Variance:</span>
              <span
                className={
                  budgetVarianceUsdPerT <= 0
                    ? "text-success font-semibold"
                    : "text-copper font-semibold"
                }
              >
                {budgetVarianceUsdPerT <= 0
                  ? `-$${Math.abs(budgetVarianceUsdPerT).toFixed(2)} Under`
                  : `+$${budgetVarianceUsdPerT.toFixed(2)} Over`}
              </span>
            </div>
          </div>

          {/* Constraints & Toggles Button */}
          <div className="flex flex-col justify-between">
            <label className="text-eyebrow text-muted-foreground block mb-1.5">
              Portfolio Controls
            </label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowFilterDrawer((prev) => !prev)}
                className={cn(
                  "inline-flex items-center justify-between rounded-md border px-3 py-1.5 text-xs font-medium transition",
                  showFilterDrawer
                    ? "border-copper bg-copper/10 text-copper"
                    : "border-border bg-surface text-foreground hover:bg-surface/80",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Nautical Constraints</span>
                </div>
                <span className="text-[0.62rem] font-mono text-muted-foreground">
                  {allowedOrigins.length} orig / {allowedPorts.length} ports
                </span>
              </button>

              <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={creditRepositioning}
                  onChange={(e) => setCreditRepositioning(e.target.checked)}
                  className="rounded border-border accent-copper h-3.5 w-3.5"
                />
                <span className="text-[0.68rem]">Credit Repositioning Savings</span>
              </label>
            </div>
          </div>
        </div>

        {/* Collapsible Filter & Constraint Strip */}
        <AnimatePresence>
          {showFilterDrawer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border/50 pt-3"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 bg-surface/40 p-3 rounded-md border border-border/60">
                {/* Allowed Origins */}
                <div>
                  <span className="text-eyebrow text-muted-foreground block mb-1.5">
                    Permissible Sourcing Origins ({allowedOrigins.length}/{ORIGINS.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {ORIGINS.map((orig) => {
                      const isAllowed = allowedOrigins.includes(orig.id);
                      return (
                        <button
                          key={orig.id}
                          type="button"
                          onClick={() => toggleOrigin(orig.id)}
                          className={cn(
                            "rounded px-2 py-0.5 text-[0.68rem] font-medium transition border",
                            isAllowed
                              ? "border-copper/60 bg-copper/15 text-foreground"
                              : "border-border/60 bg-surface/50 text-muted-foreground line-through opacity-60",
                          )}
                        >
                          {orig.shortName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Allowed Discharge Gateways */}
                <div>
                  <span className="text-eyebrow text-muted-foreground block mb-1.5">
                    Permissible Discharge Gateways ({allowedPorts.length}/{PORTS.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PORTS.map((port) => {
                      const isAllowed = allowedPorts.includes(port.code);
                      return (
                        <button
                          key={port.code}
                          type="button"
                          onClick={() => togglePort(port.code)}
                          className={cn(
                            "rounded px-2 py-0.5 text-[0.68rem] font-medium transition border",
                            isAllowed
                              ? "border-sea/60 bg-sea/15 text-foreground"
                              : "border-border/60 bg-surface/50 text-muted-foreground line-through opacity-60",
                          )}
                        >
                          {port.name} ({port.maxDraftM}m)
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Allowed Vessel Classes */}
                <div>
                  <span className="text-eyebrow text-muted-foreground block mb-1.5">
                    Permissible Vessel Classes ({allowedVessels.length}/{VESSEL_CLASSES.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {VESSEL_CLASSES.map((v) => {
                      const isAllowed = allowedVessels.includes(v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => toggleVessel(v.id)}
                          className={cn(
                            "rounded px-2 py-0.5 text-[0.68rem] font-medium transition border",
                            isAllowed
                              ? "border-brass/60 bg-brass/15 text-foreground"
                              : "border-border/60 bg-surface/50 text-muted-foreground line-through opacity-60",
                          )}
                        >
                          {v.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Objective Strategy Switcher */}
        <div className="border-t border-border/50 pt-4">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-eyebrow text-brass flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-brass" />
                <span>PROCUREMENT STRATEGY OBJECTIVE</span>
              </span>
              <span className="text-[0.68rem] text-muted-foreground">
                Evaluates candidate sourcing trade-offs against cost, draft feasibility, and
                concentration HHI
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {OBJECTIVE_OPTIONS.map((opt) => {
                const isSelected = activeObjective === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setActiveObjective(opt.id)}
                    className={cn(
                      "flex flex-col text-left rounded-md border p-3 transition-all",
                      isSelected
                        ? "border-copper bg-copper/10 shadow-sm ring-1 ring-copper/40"
                        : "border-border/70 bg-surface/40 hover:border-border hover:bg-surface/80",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                      <span
                        className={cn(
                          "text-[0.6rem] font-bold px-1.5 py-0.5 rounded",
                          isSelected
                            ? "bg-copper text-ink"
                            : "bg-surface border border-border text-muted-foreground",
                        )}
                      >
                        {opt.badge}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[0.68rem] text-muted-foreground leading-snug">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </BentoCard>

      {/* 3. Executive KPI Dashboard Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* Total Landed Spend */}
        <BentoCard glowColor="brass" className="p-4 shadow-sm">
          <p className="text-eyebrow text-muted-foreground">Total Landed Spend</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
              {fmtUsdM(
                creditRepositioning
                  ? activeStrategy.totalSpendUsd - activeStrategy.totalRepositioningSavingsUsd
                  : activeStrategy.totalSpendUsd,
              )}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {fmtTonnes(activeStrategy.allocatedT)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 font-mono">
            <span>Target: {fmtTonnes(totalDemandT)}</span>
            <span
              className={
                activeStrategy.coveragePct === 100
                  ? "text-success font-semibold"
                  : "text-copper font-semibold"
              }
            >
              {activeStrategy.coveragePct}% Coverage
            </span>
          </div>
        </BentoCard>

        {/* Weighted Cost per Tonne */}
        <BentoCard glowColor="coral" className="p-4 shadow-sm">
          <p className="text-eyebrow text-muted-foreground">Weighted Cost / Tonne</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold tracking-tight text-copper">
              ${effectiveUnitCost.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {creditRepositioning ? "net offset" : "gross CIF"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 font-mono">
            <span>StdDev: ±${activeStrategy.contractRisk.stdDevUsdPerT.toFixed(2)}</span>
            <span className="text-brass font-semibold">
              Score {activeStrategy.recommendationScore}/100
            </span>
          </div>
        </BentoCard>

        {/* Origin Concentration HHI */}
        <BentoCard glowColor="walnut" className="p-4 shadow-sm">
          <p className="text-eyebrow text-muted-foreground">Origin Concentration</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={cn(
                "font-mono text-2xl font-semibold tracking-tight",
                activeStrategy.originHHI > 4000 ? "text-copper" : "text-success",
              )}
            >
              {activeStrategy.originHHI}
            </span>
            <span className="text-[0.62rem] font-bold uppercase tracking-wider text-muted-foreground">
              {activeStrategy.originHHI < 3000
                ? "Diversified"
                : activeStrategy.originHHI < 5000
                  ? "Moderate"
                  : "Concentrated"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 font-mono">
            <span>Primary: {activeStrategy.originShares[0]?.shortName ?? "None"}</span>
            <span>{activeStrategy.originShares[0]?.sharePct ?? 0}% Share</span>
          </div>
        </BentoCard>

        {/* Port Concentration HHI */}
        <BentoCard glowColor="rose" className="p-4 shadow-sm">
          <p className="text-eyebrow text-muted-foreground">Port Concentration</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={cn(
                "font-mono text-2xl font-semibold tracking-tight",
                activeStrategy.portHHI > 4000 ? "text-copper" : "text-sea",
              )}
            >
              {activeStrategy.portHHI}
            </span>
            <span className="text-[0.62rem] font-bold uppercase tracking-wider text-muted-foreground">
              {activeStrategy.portShares.length} Gateways
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 font-mono">
            <span>Top: {activeStrategy.portShares[0]?.name ?? "None"}</span>
            <span>{activeStrategy.portShares[0]?.sharePct ?? 0}%</span>
          </div>
        </BentoCard>

        {/* Voyages & Schedule */}
        <BentoCard glowColor="brass" className="p-4 shadow-sm">
          <p className="text-eyebrow text-muted-foreground">Voyages & Schedule</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
              {activeStrategy.totalVoyages}
            </span>
            <span className="text-xs text-muted-foreground font-mono">liftings</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 font-mono">
            <span>Avg Sea: {activeStrategy.avgTransitDays}d</span>
            <span className="text-success">
              {activeStrategy.feasibilitySummary.feasiblePct}% Clean
            </span>
          </div>
        </BentoCard>

        {/* Repositioning Offset */}
        <BentoCard glowColor="coral" className="p-4 shadow-sm">
          <p className="text-eyebrow text-muted-foreground">Repositioning Offset</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold tracking-tight text-brass">
              -${(activeStrategy.totalRepositioningSavingsUsd / 1_000).toFixed(0)}k
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              -$
              {(
                activeStrategy.weightedCostPerT - activeStrategy.effectiveCostPerTWithRepositioning
              ).toFixed(2)}
              /t
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2 font-mono">
            <span>Net: ${activeStrategy.effectiveCostPerTWithRepositioning.toFixed(2)}/t</span>
            <span className="text-brass">
              {activeStrategy.repositioningOpportunities.length} Lanes
            </span>
          </div>
        </BentoCard>
      </div>

      {/* 4. Tab Navigation Strip */}
      <div className="flex border-b border-border/60">
        <button
          type="button"
          onClick={() => setActiveTab("ALLOCATIONS")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition",
            activeTab === "ALLOCATIONS"
              ? "border-copper text-copper"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Sourcing & Destination Allocations ({activeStrategy.stems.length} Stems)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("STRATEGIES")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition",
            activeTab === "STRATEGIES"
              ? "border-copper text-copper"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Candidate Portfolios Benchmark</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("REPOSITIONING")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition",
            activeTab === "REPOSITIONING"
              ? "border-copper text-copper"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Navigation className="h-3.5 w-3.5" />
          <span>Ballast Repositioning & Opportunity Lanes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("SENSITIVITIES")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition",
            activeTab === "SENSITIVITIES"
              ? "border-copper text-copper"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Sliders className="h-3.5 w-3.5" />
          <span>Downside Market Sensitivities</span>
        </button>
      </div>

      {/* Tab 1: Allocations & Stem Matrix */}
      {activeTab === "ALLOCATIONS" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border/80 bg-card/70 p-5 shadow-sm space-y-4">
            <PanelHeader
              title="Sourcing Stems & Shipment Allocation Schedule"
              eyebrow="STEM-LEVEL INTAKE"
              right={
                <div className="flex flex-wrap items-center gap-2">
                  {activeObjective === "CUSTOM" && (
                    <>
                      <button
                        type="button"
                        onClick={handleAddCustomStem}
                        className="inline-flex items-center gap-1 rounded bg-copper px-2.5 py-1 text-xs font-semibold text-ink hover:bg-copper-soft transition"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add Stem</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRebalanceTonnage}
                        className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:border-copper hover:text-copper transition font-mono"
                        title="Proportionally scale stems so sum exactly equals total demand"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Rebalance to Demand</span>
                      </button>

                      <div className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                        <span>Clone:</span>
                        <button
                          type="button"
                          onClick={() => handleClonePreset("LOWEST_COST")}
                          className="hover:text-copper underline"
                        >
                          Cost
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => handleClonePreset("BALANCED_RESILIENCE")}
                          className="hover:text-copper underline"
                        >
                          Balanced
                        </button>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => handleClonePreset("SCHEDULE_RELIABILITY")}
                          className="hover:text-copper underline"
                        >
                          Schedule
                        </button>
                      </div>
                    </>
                  )}
                  <span className="text-xs font-mono text-muted-foreground">
                    Allocated: {fmtTonnes(activeStrategy.allocatedT)} / {fmtTonnes(totalDemandT)}
                  </span>
                </div>
              }
            />

            {/* Reconciliation alert if over- or under-allocated */}
            {activeStrategy.allocatedT !== totalDemandT ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md border border-copper/40 bg-copper/10 px-4 py-2.5 text-xs gap-2">
                <span className="flex items-center gap-2 text-copper font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Allocation mismatch:{" "}
                    {fmtTonnes(Math.abs(activeStrategy.allocatedT - totalDemandT))}{" "}
                    {activeStrategy.allocatedT > totalDemandT ? "overallocated" : "unallocated"}.
                    Demand is {fmtTonnes(totalDemandT)}.
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-muted-foreground">
                    Coverage: {activeStrategy.coveragePct}%
                  </span>
                  {activeObjective === "CUSTOM" && (
                    <button
                      type="button"
                      onClick={handleRebalanceTonnage}
                      className="rounded bg-copper px-2 py-0.5 text-xs font-semibold text-ink hover:bg-copper-soft transition"
                    >
                      Auto-Rebalance
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-md border border-success/30 bg-success/5 px-4 py-2 text-xs">
                <span className="flex items-center gap-2 text-success font-medium">
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    Fully Reconciled: 100% of demand ({fmtTonnes(totalDemandT)}) allocated across{" "}
                    {activeStrategy.stems.length} stems.
                  </span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">Exact Match</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-eyebrow text-muted-foreground">
                    <th className="py-2.5 font-medium">Route Corridor</th>
                    <th className="py-2.5 font-mono text-right">Volume (Tonnes)</th>
                    <th className="py-2.5 font-mono text-right">Share (%)</th>
                    <th className="py-2.5">Vessel Class</th>
                    <th className="py-2.5 font-mono text-right">Liftings</th>
                    <th className="py-2.5">Contract</th>
                    <th className="py-2.5 font-mono text-right">Freight ($/t)</th>
                    <th className="py-2.5 font-mono text-right">Landed ($/t)</th>
                    <th className="py-2.5 font-mono text-right">Total Spend</th>
                    <th className="py-2.5">Feasibility Status</th>
                    <th className="py-2.5 font-mono text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {activeStrategy.stems.map((stem) => {
                    const orig = originById(stem.origin);
                    const dest = portByCode(stem.destination);
                    const vClass = vesselById(stem.vesselClass);

                    return (
                      <tr key={stem.id} className="hover:bg-surface/40 transition-colors">
                        <td className="py-3 font-sans font-medium text-foreground">
                          {activeObjective === "CUSTOM" ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <select
                                  value={stem.origin}
                                  onChange={(e) =>
                                    handleUpdateStemOrigin(stem.id, e.target.value as OriginRegion)
                                  }
                                  className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground focus:border-copper focus:outline-none"
                                >
                                  {ORIGINS.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.shortName}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-muted-foreground">→</span>
                                <select
                                  value={stem.destination}
                                  onChange={(e) =>
                                    handleUpdateStemDestination(stem.id, e.target.value as PortCode)
                                  }
                                  className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground focus:border-copper focus:outline-none"
                                >
                                  {PORTS.map((p) => (
                                    <option key={p.code} value={p.code}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <span className="text-[0.65rem] text-muted-foreground font-mono">
                                {DISTANCES_NM[stem.origin]?.[stem.destination] ?? 4000} nm • ~
                                {stem.transitDays}d sea
                              </span>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-1.5 font-semibold">
                                <span>{orig.shortName}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-copper">{dest.name}</span>
                              </div>
                              <span className="text-[0.68rem] text-muted-foreground font-mono">
                                {orig.loadPort} •{" "}
                                {DISTANCES_NM[stem.origin]?.[stem.destination] ?? 4000} nm • ~
                                {stem.transitDays}d sea
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3 text-right text-foreground">
                          {activeObjective === "CUSTOM" ? (
                            <input
                              type="number"
                              step={10_000}
                              min={10_000}
                              value={stem.tonnes}
                              onChange={(e) =>
                                handleUpdateStemTonnage(stem.id, Number(e.target.value))
                              }
                              className="w-24 rounded border border-border bg-surface px-1.5 py-0.5 text-right font-mono text-xs focus:border-copper focus:outline-none"
                            />
                          ) : (
                            fmtTonnes(stem.tonnes)
                          )}
                        </td>

                        <td className="py-3 text-right text-muted-foreground">
                          {activeStrategy.allocatedT > 0
                            ? ((stem.tonnes / activeStrategy.allocatedT) * 100).toFixed(1)
                            : 0}
                          %
                        </td>

                        <td className="py-3 font-sans">
                          {activeObjective === "CUSTOM" ? (
                            <select
                              value={stem.vesselClass}
                              onChange={(e) =>
                                handleUpdateStemVessel(stem.id, e.target.value as VesselClassId)
                              }
                              className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground focus:border-copper focus:outline-none"
                            >
                              {VESSEL_CLASSES.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name} ({Math.round(v.dwtMax / 1000)}k t)
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-foreground">{vClass.name}</span>
                          )}
                        </td>

                        <td className="py-3 text-right text-muted-foreground">
                          {stem.voyages} voy
                        </td>

                        <td className="py-3 font-sans">
                          <span className="rounded bg-surface border border-border/80 px-1.5 py-0.5 text-[0.62rem] font-medium text-muted-foreground">
                            {CONTRACT_LABELS[stem.contractPreference]}
                          </span>
                        </td>

                        <td className="py-3 text-right text-muted-foreground">
                          ${stem.freightUsdPerT.toFixed(2)}
                        </td>

                        <td className="py-3 text-right text-copper font-medium">
                          ${stem.landedCostPerT.toFixed(2)}
                        </td>

                        <td className="py-3 text-right text-foreground">
                          {fmtUsdM(stem.totalCostUsd)}
                        </td>

                        <td className="py-3">
                          <div className="flex flex-col gap-0.5">
                            <FeasibilityBadge status={stem.feasibilityStatus} />
                            {stem.feasibilityReasons.length > 0 && (
                              <span
                                className="text-[0.65rem] text-muted-foreground font-sans max-w-xs truncate"
                                title={stem.feasibilityReasons[0]}
                              >
                                {stem.feasibilityReasons[0]}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1 font-sans">
                            <button
                              type="button"
                              onClick={() => setInspectedStem(stem)}
                              className="rounded border border-border bg-surface px-1.5 py-0.5 text-[0.65rem] text-muted-foreground hover:text-brass transition"
                              title="Inspect cost breakdown"
                            >
                              Cost
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleGoToCharter(stem.origin, stem.destination, stem.vesselClass)
                              }
                              className="rounded border border-border bg-surface px-1.5 py-0.5 text-[0.65rem] text-muted-foreground hover:text-copper transition"
                              title="Fix stem in Charter Workspace"
                            >
                              Charter
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleGoToFeasibility(stem.destination, stem.vesselClass)
                              }
                              className="rounded border border-border bg-surface px-1.5 py-0.5 text-[0.65rem] text-muted-foreground hover:text-sea transition"
                              title="Inspect port draft & nautical feasibility"
                            >
                              Port
                            </button>

                            {activeObjective === "CUSTOM" && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomStem(stem.id)}
                                className="p-1 text-muted-foreground hover:text-danger"
                                title="Remove stem"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sourcing Origin & Port Gateway Breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Origin Diversification */}
            <div className="rounded-lg border border-border/80 bg-card/70 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-eyebrow text-brass">SOURCING DIVERSIFICATION</p>
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    Cargo Origin Allocation
                  </h3>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  HHI:{" "}
                  <strong
                    className={activeStrategy.originHHI > 4000 ? "text-copper" : "text-success"}
                  >
                    {activeStrategy.originHHI}
                  </strong>
                </span>
              </div>

              <div className="space-y-3">
                {activeStrategy.originShares.map((os) => (
                  <div key={os.origin} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-sans font-medium text-foreground">
                        {os.name} ({os.shortName})
                      </span>
                      <span className="text-muted-foreground">
                        {fmtTonnes(os.tonnes)} •{" "}
                        <strong className="text-foreground">{os.sharePct}%</strong>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-full bg-copper transition-all"
                        style={{ width: `${os.sharePct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Destination Port Gateway Breakdown */}
            <div className="rounded-lg border border-border/80 bg-card/70 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-eyebrow text-brass">DISCHARGE GATEWAYS</p>
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    East Coast Port Allocation
                  </h3>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  HHI:{" "}
                  <strong className={activeStrategy.portHHI > 4000 ? "text-copper" : "text-sea"}>
                    {activeStrategy.portHHI}
                  </strong>
                </span>
              </div>

              <div className="space-y-3">
                {activeStrategy.portShares.map((ps) => (
                  <div key={ps.port} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-sans font-medium text-foreground">
                        {ps.name} Gateway
                      </span>
                      <span className="text-muted-foreground">
                        {fmtTonnes(ps.tonnes)} •{" "}
                        <strong className="text-foreground">{ps.sharePct}%</strong>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sea transition-all"
                        style={{ width: `${ps.sharePct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vessel Class Fleet Distribution */}
            <div className="rounded-lg border border-border/80 bg-card/70 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-eyebrow text-brass">FLEET DEPLOYMENT</p>
                  <h3 className="text-sm font-semibold tracking-tight text-foreground">
                    Vessel Class Intake
                  </h3>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {activeStrategy.totalVoyages} Voyages
                </span>
              </div>

              <div className="space-y-3">
                {activeStrategy.vesselClassShares.map((vs) => (
                  <div key={vs.vesselClass} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-sans font-medium text-foreground">{vs.name}</span>
                      <span className="text-muted-foreground">
                        {vs.voyages} voy •{" "}
                        <strong className="text-foreground">{vs.sharePct}%</strong>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brass transition-all"
                        style={{ width: `${vs.sharePct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Candidate Portfolios Benchmark */}
      {activeTab === "STRATEGIES" && (
        <div className="space-y-6">
          {/* Comparative Bar Chart */}
          <div className="rounded-lg border border-border/80 bg-card/70 p-5 shadow-sm">
            <PanelHeader
              title="Candidate Strategies Cost Benchmark"
              eyebrow="MULTI-OBJECTIVE COMPARISON"
              right={
                <span className="text-xs font-mono text-muted-foreground">
                  Weighted USD per Tonne
                </span>
              }
            />
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Compares weighted landed expenditure per metric tonne across all evaluated candidate
              procurement strategies for {fmtTonnes(totalDemandT)} {CARGO_LABELS[cargoType]}.
            </p>

            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={allStrategies.map((s) => ({
                    id: s.id,
                    name: s.name,
                    weightedCost: s.weightedCostPerT,
                    spendM: Number((s.totalSpendUsd / 1_000_000).toFixed(2)),
                    originHHI: s.originHHI,
                    score: s.recommendationScore,
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
                    domain={["dataMin - 1", "dataMax + 1"]}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0]!.payload as {
                        name: string;
                        weightedCost: number;
                        spendM: number;
                        originHHI: number;
                        score: number;
                      };
                      return (
                        <TooltipCard
                          title={data.name}
                          rows={[
                            {
                              label: "Weighted Landed Cost",
                              value: `$${data.weightedCost.toFixed(2)}/t`,
                            },
                            { label: "Total Programme Spend", value: `$${data.spendM}M` },
                            { label: "Origin HHI", value: data.originHHI },
                            { label: "Strategy Score", value: `${data.score}/100` },
                          ]}
                        />
                      );
                    }}
                  />
                  <ReferenceLine
                    y={candidatePortfolios.LOWEST_COST.weightedCostPerT}
                    stroke="var(--color-brass)"
                    strokeDasharray="3 3"
                    label={{
                      value: `Lowest: $${candidatePortfolios.LOWEST_COST.weightedCostPerT.toFixed(2)}/t`,
                      fill: "var(--color-brass)",
                      fontSize: 10,
                      position: "top",
                    }}
                  />
                  <Bar dataKey="weightedCost" radius={[4, 4, 0, 0]}>
                    {allStrategies.map((s) => {
                      const isCurrent = s.objective === activeObjective;
                      return (
                        <Cell
                          key={`cell-${s.id}`}
                          fill={isCurrent ? "var(--color-copper)" : "var(--color-slate)"}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Strategy Comparison Table */}
          <div className="rounded-lg border border-border/80 bg-card/70 p-5 shadow-sm">
            <PanelHeader
              title="Candidate Strategy Trade-off Matrix"
              eyebrow="EVALUATION REGISTER"
              right={
                <span className="text-xs font-mono text-muted-foreground">
                  {allStrategies.length} Evaluated Options
                </span>
              }
            />

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-eyebrow text-muted-foreground">
                    <th className="py-2.5 font-medium">Candidate Strategy</th>
                    <th className="py-2.5 font-mono text-right">Landed ($/t)</th>
                    <th className="py-2.5 font-mono text-right">Total Spend</th>
                    <th className="py-2.5 font-mono text-right">Delta ($/t)</th>
                    <th className="py-2.5 font-mono text-right">Origin HHI</th>
                    <th className="py-2.5 font-mono text-right">Port HHI</th>
                    <th className="py-2.5 font-mono text-right">Clean Draft (%)</th>
                    <th className="py-2.5">Contract Mix</th>
                    <th className="py-2.5 font-mono text-right">Score</th>
                    <th className="py-2.5 font-mono text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {allStrategies.map((strat) => {
                    const isSelected = strat.objective === activeObjective;
                    const deltaCost =
                      strat.weightedCostPerT - candidatePortfolios.LOWEST_COST.weightedCostPerT;

                    return (
                      <tr
                        key={strat.id}
                        className={cn(
                          "transition-colors",
                          isSelected ? "bg-copper/10 font-medium" : "hover:bg-surface/50",
                        )}
                      >
                        <td className="py-3 font-sans font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <span>{strat.name}</span>
                            {isSelected && (
                              <span className="rounded bg-copper px-1.5 py-0.5 text-[0.58rem] font-bold text-ink uppercase">
                                Active
                              </span>
                            )}
                          </div>
                          <span className="text-[0.65rem] text-muted-foreground font-sans line-clamp-1 max-w-xs">
                            {strat.description}
                          </span>
                        </td>

                        <td className="py-3 text-right text-copper font-medium">
                          ${strat.weightedCostPerT.toFixed(2)}
                        </td>

                        <td className="py-3 text-right text-foreground">
                          {fmtUsdM(strat.totalSpendUsd)}
                        </td>

                        <td className="py-3 text-right">
                          {deltaCost === 0 ? (
                            <span className="text-success">Lowest</span>
                          ) : (
                            <span className="text-copper">+{deltaCost.toFixed(2)}</span>
                          )}
                        </td>

                        <td className="py-3 text-right">
                          <span className={strat.originHHI > 4000 ? "text-copper" : "text-success"}>
                            {strat.originHHI}
                          </span>
                        </td>

                        <td className="py-3 text-right">
                          <span className={strat.portHHI > 4000 ? "text-copper" : "text-sea"}>
                            {strat.portHHI}
                          </span>
                        </td>

                        <td className="py-3 text-right text-foreground">
                          {strat.feasibilitySummary.feasiblePct}%
                        </td>

                        <td className="py-3 font-sans text-[0.68rem] text-muted-foreground">
                          {strat.contractMix.spot}% Spot • {strat.contractMix.shortTerm}% Short •{" "}
                          {strat.contractMix.mediumTerm}% COA
                        </td>

                        <td className="py-3 text-right font-bold text-brass">
                          {strat.recommendationScore}/100
                        </td>

                        <td className="py-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectedStrategy(strat)}
                              className="rounded border border-border bg-surface px-2 py-1 text-[0.68rem] text-muted-foreground hover:text-brass transition"
                              title="Inspect calculations and cost components"
                            >
                              Inspect
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveObjective(strat.objective);
                                setActiveTab("ALLOCATIONS");
                              }}
                              className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-[0.68rem] text-foreground hover:border-copper hover:text-copper transition"
                            >
                              <span>Adopt</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Ballast Repositioning & Opportunity Lanes */}
      {activeTab === "REPOSITIONING" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border/80 bg-card/70 p-5 shadow-sm space-y-4">
            <PanelHeader
              title="Ballast Repositioning & Backhaul Optimization"
              eyebrow="FLEET UTILIZATION RECOVERY"
              right={
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-brass">
                    Total Realized Offset: -$
                    {Math.round(
                      activeStrategy.totalRepositioningSavingsUsd *
                        (repositioningParticipationPct / 100),
                    ).toLocaleString()}
                  </span>
                </div>
              }
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Identifies verified triangulation and backhaul repositioning opportunities for
              dry-bulk vessels completing discharge at Indian East Coast terminals. Reduces
              non-revenue ballast legs and trims landed procurement spend.
            </p>

            {/* Repositioning Participation Controls */}
            <div className="rounded-md border border-border/60 bg-surface/40 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-foreground font-sans font-medium">
                  Repositioning Participation Rate:
                </span>
                <span className="text-brass font-bold">{repositioningParticipationPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={repositioningParticipationPct}
                onChange={(e) => setRepositioningParticipationPct(Number(e.target.value))}
                className="w-full accent-brass cursor-pointer"
              />
              <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground font-mono">
                <span>0% (No triangulation)</span>
                <span>50% (Partial fleet capture)</span>
                <span>100% (Full fixture optimization)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {OPPORTUNITY_LANES.map((lane) => {
                const match = activeStrategy.repositioningOpportunities.find(
                  (ro) => ro.lane.id === lane.id,
                );
                const hasMatch = Boolean(match);
                const ballastDays = (lane.ballastNm / (12.5 * 24)).toFixed(1);

                return (
                  <div
                    key={lane.id}
                    className={cn(
                      "rounded-md border p-4 transition-all space-y-3",
                      hasMatch
                        ? "border-brass/40 bg-brass/5"
                        : "border-border/60 bg-surface/40 opacity-70",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-surface border border-border px-1.5 py-0.5 font-mono text-[0.65rem] text-brass font-bold">
                          {lane.id}
                        </span>
                        <h4 className="text-xs font-semibold text-foreground">
                          {lane.from} → {lane.to}
                        </h4>
                      </div>
                      {hasMatch ? (
                        <span className="text-[0.62rem] font-bold text-success uppercase">
                          Applicable ({match?.applicableVoyages} voy)
                        </span>
                      ) : (
                        <span className="text-[0.62rem] text-muted-foreground uppercase">
                          No Active Discharges
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-snug">{lane.cargo}</p>

                    <div className="grid grid-cols-3 gap-2 border-t border-border/40 pt-3 text-xs font-mono">
                      <div>
                        <span className="text-muted-foreground text-[0.65rem] block">
                          Ballast Leg
                        </span>
                        <span className="text-foreground">
                          {fmtInt(lane.ballastNm)} nm (~{ballastDays}d)
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[0.65rem] block">
                          Idle Days Saved
                        </span>
                        <span className="text-foreground">{lane.idleDaysSaved} d</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[0.65rem] block">
                          Gross Offset
                        </span>
                        <span className="text-brass">${fmtInt(lane.revenueOffsetUsd)}</span>
                      </div>
                    </div>

                    {hasMatch && match && (
                      <div className="rounded bg-surface/80 p-2.5 border border-border/50 flex items-center justify-between text-xs font-mono">
                        <span className="text-muted-foreground">Portfolio Realized Benefit:</span>
                        <span className="text-success font-semibold">
                          -$
                          {fmtInt(
                            Math.round(
                              match.potentialSavingsUsd * (repositioningParticipationPct / 100),
                            ),
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Repositioning Assumptions Callout */}
            <div className="rounded-md border border-border/60 bg-surface/30 p-4 space-y-2 text-xs">
              <span className="text-eyebrow text-muted-foreground block">
                CALCULATION ASSUMPTIONS & METHODOLOGY
              </span>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[0.72rem] leading-relaxed">
                <li>
                  Ballast sailing duration computed at 12.5 knots standard eco-ballast speed from
                  Indian East Coast discharge ports.
                </li>
                <li>
                  Gross revenue offset represents charterparty demurrage mitigation and voyage
                  triangulation earnings.
                </li>
                <li>
                  Charterer net credit reflects ~45% contractual revenue-sharing discount negotiated
                  in voyage fixture terms.
                </li>
                <li>
                  Illustrative heuristic for strategic procurement planning; live positioning
                  requires AIS telemetry and broker fixtures.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Downside Market Sensitivities */}
      {activeTab === "SENSITIVITIES" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border/80 bg-card/70 p-5 shadow-sm space-y-4">
            <PanelHeader
              title="Scenario Stress Testing Matrix"
              eyebrow="RISK EXPOSURE & SENSITIVITIES"
              right={
                <span className="text-xs font-mono text-muted-foreground">
                  Grounded in Scenario Lab Heuristic
                </span>
              }
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Measures how the active strategy ({activeStrategy.name}) responds to market spot
              tightening, bunker price surges, and monsoon anchorage delays.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/80 text-eyebrow text-muted-foreground">
                    <th className="py-2.5 font-medium">Stress Shock Scenario</th>
                    <th className="py-2.5 font-mono text-right">Freight Shock</th>
                    <th className="py-2.5 font-mono text-right">VLSFO Bunker</th>
                    <th className="py-2.5 font-mono text-right">Port Delay</th>
                    <th className="py-2.5 font-mono text-right">Stressed Landed ($/t)</th>
                    <th className="py-2.5 font-mono text-right">Total Spend</th>
                    <th className="py-2.5 font-mono text-right">Variance ($/t)</th>
                    <th className="py-2.5 font-mono text-right">Spend Drawdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {sensitivities.map((s, idx) => (
                    <tr
                      key={s.shockLabel}
                      className={idx === 0 ? "bg-surface/30 font-semibold" : "hover:bg-surface/40"}
                    >
                      <td className="py-3 font-sans text-foreground">
                        <div>
                          <span>{s.shockLabel}</span>
                          <span className="text-[0.65rem] text-muted-foreground block font-mono">
                            {s.shockDescription}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {s.freightShockPct > 0 ? `+${s.freightShockPct}%` : "0%"}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        ${s.bunkerUsdPerT}/t
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        +{s.congestionDays}d
                      </td>
                      <td className="py-3 text-right text-copper font-medium">
                        ${s.weightedCostPerT.toFixed(2)}
                      </td>
                      <td className="py-3 text-right text-foreground">
                        {fmtUsdM(s.totalSpendUsd)}
                      </td>
                      <td className="py-3 text-right">
                        {s.costDeltaUsdPerT === 0 ? (
                          <span className="text-muted-foreground">Baseline</span>
                        ) : (
                          <Delta value={s.costDeltaUsdPerT} unit="$/t" invert />
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {s.costDeltaPct === 0 ? (
                          <span className="text-muted-foreground">0.0%</span>
                        ) : (
                          <Delta value={s.costDeltaPct} invert />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. Explainable Recommendation Briefing */}
      <div className="rounded-lg border border-border/80 bg-card/70 p-5 shadow-sm space-y-4">
        <PanelHeader
          title="Procurement Committee Briefing & Trade-off Diagnostics"
          eyebrow="EXPLAINABLE RECOMMENDATIONS"
          right={
            <span className="text-xs font-mono text-copper flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Recommended: {recommendation.preferredStrategyName}</span>
            </span>
          }
        />

        <div className="rounded-md border border-border/50 bg-surface/30 p-4">
          <p className="text-sm font-semibold text-foreground tracking-tight">
            {recommendation.headline}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-md border border-border/60 bg-surface/50 p-4 space-y-1.5">
            <span className="text-eyebrow text-[0.62rem] text-muted-foreground">
              PRIMARY ADVANTAGE
            </span>
            <h4 className="text-xs font-semibold text-foreground">Cost & Capacity Economics</h4>
            <p className="text-[0.72rem] leading-relaxed text-muted-foreground">
              {recommendation.primaryAdvantage}
            </p>
          </div>

          <div className="rounded-md border border-border/60 bg-surface/50 p-4 space-y-1.5">
            <span className="text-eyebrow text-[0.62rem] text-muted-foreground">
              STRATEGIC TRADE-OFF
            </span>
            <h4 className="text-xs font-semibold text-foreground">Operational Compromise</h4>
            <p className="text-[0.72rem] leading-relaxed text-muted-foreground">
              {recommendation.keyTradeoff}
            </p>
          </div>

          <div className="rounded-md border border-border/60 bg-surface/50 p-4 space-y-1.5">
            <span className="text-eyebrow text-[0.62rem] text-muted-foreground">
              MARKET SENSITIVITY
            </span>
            <h4 className="text-xs font-semibold text-foreground">Downside Protection</h4>
            <p className="text-[0.72rem] leading-relaxed text-muted-foreground">
              {recommendation.sensitivityNote}
            </p>
          </div>
        </div>

        {recommendation.decisionCriteria && (
          <div className="rounded-md border border-border/40 bg-surface/20 p-3 text-xs flex items-start gap-2">
            <Compass className="h-4 w-4 text-brass shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-eyebrow text-[0.62rem] text-brass block">
                SELECTION CRITERIA
              </span>
              <p className="text-muted-foreground text-[0.72rem]">
                {recommendation.decisionCriteria}
              </p>
            </div>
          </div>
        )}

        {recommendation.assumptionsThatCouldChangeRecommendation && (
          <div className="rounded-md border border-border/40 bg-surface/20 p-3 text-xs flex items-start gap-2">
            <Sliders className="h-4 w-4 text-sea shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-eyebrow text-[0.62rem] text-sea block">
                TRIGGER CONDITIONS THAT COULD ALTER RECOMMENDATION
              </span>
              <p className="text-muted-foreground text-[0.72rem]">
                {recommendation.assumptionsThatCouldChangeRecommendation}
              </p>
            </div>
          </div>
        )}

        {recommendation.concentrationWarning && (
          <div className="rounded-md border border-copper/40 bg-copper/10 p-3 text-xs flex items-center gap-2 text-copper">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{recommendation.concentrationWarning}</span>
          </div>
        )}

        {recommendation.feasibilityAlert && (
          <div className="rounded-md border border-brass/40 bg-brass/10 p-3 text-xs flex items-center gap-2 text-brass">
            <Info className="h-4 w-4 shrink-0" />
            <span>{recommendation.feasibilityAlert}</span>
          </div>
        )}
      </div>

      {/* 6. Cross-Workspace Navigation Bar */}
      <div className="flex flex-col gap-4 rounded-lg border border-border/80 bg-surface/70 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-eyebrow text-brass">CROSS-WORKFLOW INTEGRATION</span>
          <h2 className="mt-1 text-sm font-semibold tracking-tight text-foreground">
            Execute Strategy into Live Charter & Market Pipelines
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Seamlessly bridge high-level sourcing portfolios into stem fixture analysis, draft
            verification, or scenario testing.
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
            onClick={() => handleGoToMarket()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper transition"
          >
            <LineChart className="h-3.5 w-3.5 text-brass" />
            <span>Market Intelligence</span>
          </button>

          <button
            type="button"
            onClick={() => handleGoToFeasibility()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper transition"
          >
            <Ship className="h-3.5 w-3.5 text-sea" />
            <span>Port Feasibility</span>
          </button>

          <button
            type="button"
            onClick={handleGoToScenarios}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper transition"
          >
            <Sliders className="h-3.5 w-3.5 text-brass" />
            <span>Scenario Lab</span>
          </button>

          <button
            type="button"
            onClick={() => handleGoToCharter()}
            className="inline-flex items-center gap-1.5 rounded-md bg-copper px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-copper-soft transition"
          >
            <Anchor className="h-3.5 w-3.5" />
            <span>Fix in Charter</span>
          </button>
        </div>
      </div>

      {/* 7. Modal: Strategy Calculations & Stem Schedule Inspection */}
      <AnimatePresence>
        {inspectedStrategy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <span className="text-eyebrow text-brass">CALCULATION INSPECTION</span>
                  <h3 className="text-base font-semibold text-foreground">
                    {inspectedStrategy.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{inspectedStrategy.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedStrategy(null)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Strategy Totals */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-xs">
                <div className="rounded border border-border/60 bg-surface/50 p-2.5">
                  <span className="text-muted-foreground block text-[0.65rem]">Landed Spend</span>
                  <span className="text-foreground font-semibold text-sm">
                    {fmtUsdM(inspectedStrategy.totalSpendUsd)}
                  </span>
                </div>
                <div className="rounded border border-border/60 bg-surface/50 p-2.5">
                  <span className="text-muted-foreground block text-[0.65rem]">Weighted $/t</span>
                  <span className="text-copper font-semibold text-sm">
                    ${inspectedStrategy.weightedCostPerT.toFixed(2)}
                  </span>
                </div>
                <div className="rounded border border-border/60 bg-surface/50 p-2.5">
                  <span className="text-muted-foreground block text-[0.65rem]">Origin HHI</span>
                  <span className="text-foreground font-semibold text-sm">
                    {inspectedStrategy.originHHI}
                  </span>
                </div>
                <div className="rounded border border-border/60 bg-surface/50 p-2.5">
                  <span className="text-muted-foreground block text-[0.65rem]">Clean Draft %</span>
                  <span className="text-success font-semibold text-sm">
                    {inspectedStrategy.feasibilitySummary.feasiblePct}%
                  </span>
                </div>
              </div>

              {/* Stems Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground font-sans">
                  Underlying Sourcing Stems
                </h4>
                <div className="overflow-x-auto rounded border border-border/60">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/80 text-eyebrow text-muted-foreground bg-surface/40">
                        <th className="py-2 px-3">Corridor</th>
                        <th className="py-2 px-3 font-mono text-right">Volume</th>
                        <th className="py-2 px-3">Vessel</th>
                        <th className="py-2 px-3 font-mono text-right">Voyages</th>
                        <th className="py-2 px-3 font-mono text-right">Freight ($/t)</th>
                        <th className="py-2 px-3 font-mono text-right">Landed ($/t)</th>
                        <th className="py-2 px-3 font-mono text-right">Spend</th>
                        <th className="py-2 px-3">Feasibility</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {inspectedStrategy.stems.map((s) => (
                        <tr key={s.id} className="hover:bg-surface/30">
                          <td className="py-2 px-3 font-sans font-medium text-foreground">
                            {originById(s.origin).shortName} → {portByCode(s.destination).name}
                          </td>
                          <td className="py-2 px-3 text-right">{fmtTonnes(s.tonnes)}</td>
                          <td className="py-2 px-3 font-sans">{vesselById(s.vesselClass).name}</td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {s.voyages}
                          </td>
                          <td className="py-2 px-3 text-right">${s.freightUsdPerT.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-copper font-medium">
                            ${s.landedCostPerT.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right">{fmtUsdM(s.totalCostUsd)}</td>
                          <td className="py-2 px-3">
                            <FeasibilityBadge status={s.feasibilityStatus} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cost Component Aggregate Breakdown */}
              <div className="rounded border border-border/60 bg-surface/30 p-3 space-y-2 text-xs">
                <span className="text-eyebrow text-muted-foreground block">
                  PORTFOLIO EXPENDITURE RECONCILIATION
                </span>
                <p className="text-muted-foreground text-[0.72rem] leading-relaxed">
                  Total landed expenditure of {fmtUsdM(inspectedStrategy.totalSpendUsd)} reconciles
                  exactly across ocean vessel charter hire, VLSFO fuel consumption, discharge
                  terminal port dues, anchorage demurrage risk reserves, and marine cargo insurance.
                </p>
                <div className="text-[0.68rem] font-mono text-muted-foreground">
                  Concentration formula: HHI = ∑ (share_i %)^2 = {inspectedStrategy.originHHI}{" "}
                  across {inspectedStrategy.originShares.length} sourcing origins.
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setInspectedStrategy(null)}
                  className="rounded-md border border-border bg-surface px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-surface/80 transition"
                >
                  Close Inspection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Live Machine Learning Feature Importance & Portfolio Value Insights */}
      <BackendInsightsCard />

      {/* 8. Modal: Stem Cost Breakdown Drill-Down */}
      <AnimatePresence>
        {inspectedStem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <span className="text-eyebrow text-brass">STEM COMPONENT BREAKDOWN</span>
                  <h3 className="text-sm font-semibold text-foreground">
                    {originById(inspectedStem.origin).name} →{" "}
                    {portByCode(inspectedStem.destination).name}
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground">
                    {fmtTonnes(inspectedStem.tonnes)} • {vesselById(inspectedStem.vesselClass).name}{" "}
                    • {inspectedStem.voyages} voy
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedStem(null)}
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Breakdown Rows */}
              {inspectedStem.costBreakdown ? (
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between p-2 rounded bg-surface/50 border border-border/40">
                    <span className="font-sans text-muted-foreground">
                      1. Ocean Charter Hire (Time Charter):
                    </span>
                    <span className="text-foreground font-semibold">
                      {fmtUsd(inspectedStem.costBreakdown.freightUsd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-surface/50 border border-border/40">
                    <span className="font-sans text-muted-foreground">
                      2. VLSFO Bunker Fuel Consumption:
                    </span>
                    <span className="text-foreground font-semibold">
                      {fmtUsd(inspectedStem.costBreakdown.bunkerUsd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-surface/50 border border-border/40">
                    <span className="font-sans text-muted-foreground">
                      3. Port Dues & Terminal Wharfage:
                    </span>
                    <span className="text-foreground font-semibold">
                      {fmtUsd(inspectedStem.costBreakdown.portDuesUsd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-surface/50 border border-border/40">
                    <span className="font-sans text-muted-foreground">
                      4. Demurrage Reserve (Anchorage Delay):
                    </span>
                    <span className="text-foreground font-semibold">
                      {fmtUsd(inspectedStem.costBreakdown.demurrageReserveUsd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-surface/50 border border-border/40">
                    <span className="font-sans text-muted-foreground">
                      5. Marine Cargo Insurance:
                    </span>
                    <span className="text-foreground font-semibold">
                      {fmtUsd(inspectedStem.costBreakdown.insuranceUsd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded bg-copper/10 border border-copper/30 font-semibold text-sm">
                    <span className="font-sans text-copper">Total Landed Spend:</span>
                    <span className="text-copper">
                      {fmtUsd(inspectedStem.totalCostUsd)} ($
                      {inspectedStem.landedCostPerT.toFixed(2)}/t)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-xs font-mono text-muted-foreground text-center">
                  Cost breakdown derived from Charter model: $
                  {inspectedStem.landedCostPerT.toFixed(2)}/t landed spend.
                </div>
              )}

              {/* Feasibility Notes */}
              <div className="border-t border-border/50 pt-3 space-y-1">
                <span className="text-eyebrow text-muted-foreground block text-[0.65rem]">
                  NAUTICAL FEASIBILITY
                </span>
                <div className="flex items-center gap-2">
                  <FeasibilityBadge status={inspectedStem.feasibilityStatus} />
                  <span className="text-xs text-foreground font-sans">
                    {inspectedStem.feasibilityReasons[0] ??
                      "Full berth and draft clearance confirmed."}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setInspectedStem(null)}
                  className="rounded-md border border-border bg-surface px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-surface/80 transition"
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
