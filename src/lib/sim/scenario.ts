/**
 * Illustrative scenario simulation & stress-testing engine for NAVIK.
 *
 * Re-runs the frontend charter decision pipeline under stressed parameters
 * and compares against an untouched baseline voyage.
 *
 * Uses the existing charter heuristic and reference data.
 * All outputs are deterministic and clearly labeled simulated.
 */
import type {
  CharterRequest,
  FeasibilityStatus,
  ScenarioComparison,
  ScenarioDiff,
  ScenarioInput,
  ScenarioInsight,
  ScenarioOutcome,
  ScenarioResult,
  VesselClassId,
  VesselScenarioComparison,
  WaterfallItem,
} from "@/lib/api/types";
import {
  BASE_BUNKER_USD_PER_T,
  DEFAULT_CONGESTION,
  DEFAULT_MARKET,
  simulateCharterDecision,
} from "./charter";
import { VESSEL_CLASSES, portByCode } from "@/lib/api/reference";

export const BASELINE_INPUT: ScenarioInput = {
  freightShockPct: 0,
  congestionDays: 0,
  bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
  fleetAvailabilityPct: 100,
  speedDeltaKn: 0,
};

export interface ScenarioPreset {
  id: string;
  name: string;
  category: "BASE" | "MACRO" | "PORT" | "WEATHER" | "COMPOUND";
  description: string;
  input: ScenarioInput;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: "base",
    name: "Base case",
    category: "BASE",
    description: "Current demo market conditions with no stress shocks applied.",
    input: BASELINE_INPUT,
  },
  {
    id: "freight-shock",
    name: "Freight market shock",
    category: "MACRO",
    description:
      "Geopolitical route tightening and tonnage shortages drive a +25% freight rate spike.",
    input: {
      freightShockPct: 25,
      congestionDays: 1.5,
      bunkerUsdPerT: 680,
      fleetAvailabilityPct: 80,
      speedDeltaKn: 0,
    },
  },
  {
    id: "bunker-spike",
    name: "Bunker price spike",
    category: "MACRO",
    description: "Crude supply squeeze surges Singapore VLSFO to $850/t with mild freight uptick.",
    input: {
      freightShockPct: 8,
      congestionDays: 0,
      bunkerUsdPerT: 850,
      fleetAvailabilityPct: 95,
      speedDeltaKn: -0.5,
    },
  },
  {
    id: "port-congestion",
    name: "Port congestion event",
    category: "PORT",
    description:
      "Berth maintenance and vessel clustering cause +8.0 extra days at discharge anchorage.",
    input: {
      freightShockPct: 10,
      congestionDays: 8,
      bunkerUsdPerT: 640,
      fleetAvailabilityPct: 85,
      speedDeltaKn: 0,
    },
  },
  {
    id: "monsoon-delay",
    name: "Monsoon delay",
    category: "WEATHER",
    description: "Bay of Bengal seasonal depressions force eco-steaming and 5-day anchorage holds.",
    input: {
      freightShockPct: 6,
      congestionDays: 5,
      bunkerUsdPerT: 650,
      fleetAvailabilityPct: 90,
      speedDeltaKn: -1.5,
    },
  },
  {
    id: "combined-downside",
    name: "Combined downside case",
    category: "COMPOUND",
    description:
      "Simultaneous freight shock (+22%), $820/t bunker, +6d delay, and 75% fleet availability.",
    input: {
      freightShockPct: 22,
      congestionDays: 6,
      bunkerUsdPerT: 820,
      fleetAvailabilityPct: 75,
      speedDeltaKn: -1.0,
    },
  },
  {
    id: "cost-pressure",
    name: "Cost pressure",
    category: "MACRO",
    description: "Moderate freight firmness (+18%), VLSFO $760/t, and tighter tonnage.",
    input: {
      freightShockPct: 18,
      congestionDays: 1.5,
      bunkerUsdPerT: 760,
      fleetAvailabilityPct: 85,
      speedDeltaKn: 0,
    },
  },
  {
    id: "soft-market",
    name: "Softening market",
    category: "MACRO",
    description:
      "Weak global demand softens freight by −14%, cheaper bunkers, and surplus vessels.",
    input: {
      freightShockPct: -14,
      congestionDays: 0,
      bunkerUsdPerT: 575,
      fleetAvailabilityPct: 110,
      speedDeltaKn: 0.5,
    },
  },
];

/** Input parameter boundary definitions and units */
export const SCENARIO_BOUNDS = {
  freightShockPct: { min: -40, max: 80, step: 1, unit: "%", label: "Freight Rate Shock" },
  bunkerUsdPerT: { min: 350, max: 1200, step: 5, unit: "$/MT", label: "VLSFO Bunker Price" },
  congestionDays: { min: 0, max: 21, step: 0.5, unit: "days", label: "Port Waiting Time Increase" },
  fleetAvailabilityPct: { min: 40, max: 150, step: 5, unit: "%", label: "Fleet Availability" },
  speedDeltaKn: { min: -3.0, max: 3.0, step: 0.5, unit: "kn", label: "Steaming Speed Adjustment" },
} as const;

/** Validates and clamps scenario inputs to physically realistic boundaries */
export function validateScenarioInput(input: Partial<ScenarioInput>): ScenarioInput {
  const clamp = (val: number | undefined, min: number, max: number, def: number) => {
    if (typeof val !== "number" || Number.isNaN(val)) return def;
    return Math.min(max, Math.max(min, val));
  };

  return {
    freightShockPct: clamp(
      input.freightShockPct,
      SCENARIO_BOUNDS.freightShockPct.min,
      SCENARIO_BOUNDS.freightShockPct.max,
      0,
    ),
    bunkerUsdPerT: clamp(
      input.bunkerUsdPerT,
      SCENARIO_BOUNDS.bunkerUsdPerT.min,
      SCENARIO_BOUNDS.bunkerUsdPerT.max,
      BASE_BUNKER_USD_PER_T,
    ),
    congestionDays: clamp(
      input.congestionDays,
      SCENARIO_BOUNDS.congestionDays.min,
      SCENARIO_BOUNDS.congestionDays.max,
      0,
    ),
    fleetAvailabilityPct: clamp(
      input.fleetAvailabilityPct,
      SCENARIO_BOUNDS.fleetAvailabilityPct.min,
      SCENARIO_BOUNDS.fleetAvailabilityPct.max,
      100,
    ),
    speedDeltaKn: clamp(
      input.speedDeltaKn,
      SCENARIO_BOUNDS.speedDeltaKn.min,
      SCENARIO_BOUNDS.speedDeltaKn.max,
      0,
    ),
  };
}

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

export function toOutcome(
  r: ReturnType<typeof simulateCharterDecision>,
  extraWaitDays = 0,
): ScenarioOutcome {
  const cargo = r.request.cargoTonnes;
  const vSpec = r.vesselClass ? VESSEL_CLASSES.find((v) => v.id === r.vesselClass) : null;
  const bestCheck = r.vesselClass ? r.checks.find((c) => c.vesselClass === r.vesselClass) : null;

  const feasibleCount = r.checks.filter((c) => c.status === "FEASIBLE").length;
  const conditionalCount = r.checks.filter((c) => c.status === "CONDITIONAL").length;
  const rejectedCount = r.checks.filter((c) => c.status === "REJECTED").length;

  const baseWait = DEFAULT_CONGESTION[r.port]?.avgWaitDays ?? 2.0;
  const totalWaitDays = round(baseWait + extraWaitDays, 1);
  const transitDays = bestCheck?.transitDays ?? r.transitDays;
  const totalDurationDays = round(transitDays + totalWaitDays + 9, 1); // 7 positioning + 2 loading

  return {
    freightUsdPerT: r.estimatedFreightUsdPerT,
    totalCostUsd: r.totalCostUsd,
    costPerT: cargo ? Math.round((r.totalCostUsd / cargo) * 100) / 100 : 0,
    riskScore: r.riskScore,
    riskLevel: r.riskLevel,
    confidence: r.confidence,
    demurrageUsd: r.costBreakdown.demurrageReserveUsd,
    bunkerCostUsd: r.costBreakdown.bunkerUsd,
    decision: r.decision,
    rationale: r.headline,
    vesselClass: r.vesselClass,
    vesselClassName: vSpec?.name ?? r.vesselClass ?? "No Viable Class",
    transitDays,
    portWaitDays: totalWaitDays,
    totalDurationDays,
    slackDays: r.slackDays,
    costBreakdown: r.costBreakdown,
    checks: r.checks,
    feasibleCount,
    conditionalCount,
    rejectedCount,
  };
}

/**
 * Runs a single scenario against baseline.
 */
export function simulateScenario(
  request: CharterRequest,
  input: ScenarioInput,
  now: Date,
): ScenarioResult {
  const validated = validateScenarioInput(input);
  const base = DEFAULT_MARKET[request.origin];

  const baseline = simulateCharterDecision(request, {
    now,
    bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
    extraWaitDays: 0,
    availabilityFactor: 1,
    speedDeltaKn: 0,
  });

  const stressed = simulateCharterDecision(request, {
    now,
    bunkerUsdPerT: validated.bunkerUsdPerT,
    extraWaitDays: validated.congestionDays,
    availabilityFactor: validated.fleetAvailabilityPct / 100,
    speedDeltaKn: validated.speedDeltaKn ?? 0,
    market: {
      multiplier: base.multiplier * (1 + validated.freightShockPct / 100),
      trend30dPct: base.trend30dPct + validated.freightShockPct * 0.25,
      volatility:
        base.volatility +
        Math.abs(validated.freightShockPct) / 400 +
        validated.congestionDays / 200,
    },
  });

  return {
    input: validated,
    baseline: toOutcome(baseline, 0),
    simulated: toOutcome(stressed, validated.congestionDays),
    provenance: { source: "demo", label: "Frontend scenario simulation", asOf: now.toISOString() },
  };
}

/**
 * Builds explainable insights directly grounded in scenario calculations.
 */
export function generateScenarioExplanations(
  diff: ScenarioDiff,
  baseline: ScenarioOutcome,
  simulated: ScenarioOutcome,
  input: ScenarioInput,
  request: CharterRequest,
): ScenarioInsight[] {
  const insights: ScenarioInsight[] = [];
  const port = portByCode(request.destination);

  // 1. Cost driver explanation
  const absBunker = Math.abs(diff.bunkerUsd);
  const absFreight = Math.abs(diff.freightHireUsd);
  const absDemurrage = Math.abs(diff.demurrageUsd);

  if (diff.totalCostUsd === 0) {
    insights.push({
      id: "cost-parity",
      category: "COST",
      title: "Cost parity with baseline",
      detail: `All simulated parameters match the baseline. Voyage landed expenditure is unchanged at $${baseline.costPerT.toFixed(2)}/t.`,
      impact: "neutral",
    });
  } else if (absBunker >= absFreight && absBunker >= absDemurrage && absBunker > 0) {
    const dir = diff.bunkerUsd > 0 ? "increase" : "saving";
    insights.push({
      id: "bunker-driver",
      category: "COST",
      title: `Bunkers represent the primary cost ${dir}`,
      detail: `VLSFO fuel spend shifted by ${diff.bunkerUsd > 0 ? "+" : ""}$${Math.round(diff.bunkerUsd).toLocaleString()} (${diff.bunkerPct > 0 ? "+" : ""}${diff.bunkerPct.toFixed(1)}%), accounting for ${Math.round((absBunker / Math.max(1, Math.abs(diff.totalCostUsd))) * 100)}% of total landed expenditure variance.`,
      impact: diff.bunkerUsd > 0 ? "negative" : "positive",
    });
  } else if (absFreight >= absBunker && absFreight >= absDemurrage && absFreight > 0) {
    const dir = diff.freightHireUsd > 0 ? "expansion" : "reduction";
    insights.push({
      id: "freight-driver",
      category: "COST",
      title: `Charter hire & freight rate ${dir}`,
      detail: `Freight and vessel hire variance is $${Math.round(diff.freightHireUsd).toLocaleString()}, driven by ${input.freightShockPct > 0 ? "+" : ""}${input.freightShockPct}% freight shock and ${input.fleetAvailabilityPct}% vessel availability factor.`,
      impact: diff.freightHireUsd > 0 ? "negative" : "positive",
    });
  } else if (absDemurrage > 0) {
    insights.push({
      id: "demurrage-driver",
      category: "COST",
      title: "Port congestion drives demurrage exposure",
      detail: `Adding ${input.congestionDays.toFixed(1)} extra days at ${port.name} anchorage expands demurrage contingency reserve by $${Math.round(diff.demurrageUsd).toLocaleString()}.`,
      impact: "warning",
    });
  }

  // 2. Schedule & deadline window
  if (simulated.slackDays !== undefined && baseline.slackDays !== undefined) {
    if (simulated.slackDays < 0) {
      insights.push({
        id: "schedule-breach",
        category: "SCHEDULE",
        title: "Critical: Delivery deadline breached",
        detail: `Under stressed waiting times and steaming speeds, estimated vessel arrival misses the target delivery deadline (${request.deliveryDeadline}) by ${Math.abs(simulated.slackDays)} day(s).`,
        impact: "negative",
      });
    } else if (simulated.slackDays < 7 && baseline.slackDays >= 7) {
      insights.push({
        id: "schedule-thin",
        category: "SCHEDULE",
        title: "Schedule buffer compressed below safety threshold",
        detail: `Arrival buffer reduced from ${baseline.slackDays} days to ${simulated.slackDays} days. High vulnerability to unforeseen weather or berth queues.`,
        impact: "warning",
      });
    } else {
      insights.push({
        id: "schedule-safe",
        category: "SCHEDULE",
        title: "Voyage schedule remains viable",
        detail: `Estimated delivery maintains ${simulated.slackDays} days of buffer before the ${request.deliveryDeadline} laycan deadline.`,
        impact: "positive",
      });
    }
  }

  // 3. Feasibility & class ranking
  if (baseline.vesselClass !== simulated.vesselClass) {
    insights.push({
      id: "vessel-switch",
      category: "FEASIBILITY",
      title: "Optimal vessel class shifted",
      detail: `Baseline recommended ${baseline.vesselClassName}, but stressed conditions favor ${simulated.vesselClassName} due to relative fuel efficiency, draft constraints, or lifting economics.`,
      impact: "warning",
    });
  } else if (
    simulated.rejectedCount !== undefined &&
    baseline.rejectedCount !== undefined &&
    simulated.rejectedCount > baseline.rejectedCount
  ) {
    insights.push({
      id: "vessel-disqualification",
      category: "FEASIBILITY",
      title: "Vessel alternatives disqualified",
      detail: `${simulated.rejectedCount - baseline.rejectedCount} vessel class(es) shifted to REJECTED status under stressed delay and schedule constraints.`,
      impact: "negative",
    });
  }

  // 4. Recommendation impact
  if (baseline.decision !== simulated.decision) {
    insights.push({
      id: "decision-shift",
      category: "DECISION",
      title: `Charter recommendation shifted to ${simulated.decision.replace("_", " ")}`,
      detail: `Baseline recommendation was ${baseline.decision.replace("_", " ")}, but changed to ${simulated.decision.replace("_", " ")} under scenario conditions: "${simulated.rationale}".`,
      impact: "warning",
    });
  } else {
    insights.push({
      id: "decision-stable",
      category: "DECISION",
      title: `Recommendation remains ${simulated.decision.replace("_", " ")}`,
      detail: `Optimal strategy holds under current stress parameters with a ${simulated.riskLevel.toLowerCase()} risk profile (score ${simulated.riskScore}/100).`,
      impact: "neutral",
    });
  }

  // 5. Methodology & honest disclosures
  insights.push({
    id: "methodology-tag",
    category: "METHODOLOGY",
    title: "Hypothetical stress test disclosure",
    detail:
      "Outputs are transparent mathematical sensitivities based on SAIL bulk-carrier reference heuristics. This simulation does not claim to predict actual future market rates.",
    impact: "neutral",
  });

  return insights;
}

/**
 * Builds the complete baseline-vs-scenario comparison with diffs, waterfall,
 * vessel matrix, and explainable insights.
 */
export function compareScenarios(
  request: CharterRequest,
  input: ScenarioInput,
  now: Date,
  name = "Custom Scenario",
  id = "scenario-active",
  description?: string,
): ScenarioComparison {
  const result = simulateScenario(request, input, now);
  const { baseline, simulated } = result;

  const costDiffUsd = simulated.totalCostUsd - baseline.totalCostUsd;
  const costDiffPct = baseline.totalCostUsd > 0 ? (costDiffUsd / baseline.totalCostUsd) * 100 : 0;
  const costPerTDiff = simulated.costPerT - baseline.costPerT;
  const costPerTPct = baseline.costPerT > 0 ? (costPerTDiff / baseline.costPerT) * 100 : 0;
  const freightUsdPerTDiff = simulated.freightUsdPerT - baseline.freightUsdPerT;
  const bunkerDiffUsd = simulated.bunkerCostUsd - baseline.bunkerCostUsd;
  const bunkerDiffPct =
    baseline.bunkerCostUsd > 0 ? (bunkerDiffUsd / baseline.bunkerCostUsd) * 100 : 0;
  const demurrageDiffUsd = simulated.demurrageUsd - baseline.demurrageUsd;

  const baseBk = baseline.costBreakdown ?? {
    freightUsd: 0,
    bunkerUsd: 0,
    portDuesUsd: 0,
    demurrageReserveUsd: 0,
    insuranceUsd: 0,
  };
  const simBk = simulated.costBreakdown ?? {
    freightUsd: 0,
    bunkerUsd: 0,
    portDuesUsd: 0,
    demurrageReserveUsd: 0,
    insuranceUsd: 0,
  };

  const freightHireUsd = simBk.freightUsd - baseBk.freightUsd;
  const portDuesUsd = simBk.portDuesUsd - baseBk.portDuesUsd;
  const insuranceUsd = simBk.insuranceUsd - baseBk.insuranceUsd;
  const durationDays = (simulated.totalDurationDays ?? 0) - (baseline.totalDurationDays ?? 0);
  const riskScoreDiff = simulated.riskScore - baseline.riskScore;

  const diff: ScenarioDiff = {
    totalCostUsd: Math.round(costDiffUsd),
    totalCostPct: round(costDiffPct, 2),
    costPerTUsd: round(costPerTDiff, 2),
    costPerTPct: round(costPerTPct, 2),
    freightUsdPerT: round(freightUsdPerTDiff, 2),
    bunkerUsd: Math.round(bunkerDiffUsd),
    bunkerPct: round(bunkerDiffPct, 2),
    demurrageUsd: Math.round(demurrageDiffUsd),
    freightHireUsd: Math.round(freightHireUsd),
    portDuesUsd: Math.round(portDuesUsd),
    insuranceUsd: Math.round(insuranceUsd),
    durationDays: round(durationDays, 1),
    riskScore: riskScoreDiff,
  };

  // Waterfall items with mathematical parity:
  // Baseline + FreightHire + Bunker + Demurrage + Port/Ins = Scenario Total
  const otherDelta = portDuesUsd + insuranceUsd;
  let running = baseline.totalCostUsd;

  const waterfall: WaterfallItem[] = [
    {
      category: "Baseline Total",
      deltaUsd: baseline.totalCostUsd,
      percentage: 100,
      direction: "flat",
      cumulativeUsd: running,
    },
    {
      category: "Freight / Hire",
      deltaUsd: Math.round(freightHireUsd),
      percentage:
        baseline.totalCostUsd > 0 ? round((freightHireUsd / baseline.totalCostUsd) * 100, 1) : 0,
      direction: freightHireUsd > 0 ? "up" : freightHireUsd < 0 ? "down" : "flat",
      cumulativeUsd: (running += freightHireUsd),
    },
    {
      category: "Bunker Fuel",
      deltaUsd: Math.round(bunkerDiffUsd),
      percentage:
        baseline.totalCostUsd > 0 ? round((bunkerDiffUsd / baseline.totalCostUsd) * 100, 1) : 0,
      direction: bunkerDiffUsd > 0 ? "up" : bunkerDiffUsd < 0 ? "down" : "flat",
      cumulativeUsd: (running += bunkerDiffUsd),
    },
    {
      category: "Demurrage / Delay",
      deltaUsd: Math.round(demurrageDiffUsd),
      percentage:
        baseline.totalCostUsd > 0 ? round((demurrageDiffUsd / baseline.totalCostUsd) * 100, 1) : 0,
      direction: demurrageDiffUsd > 0 ? "up" : demurrageDiffUsd < 0 ? "down" : "flat",
      cumulativeUsd: (running += demurrageDiffUsd),
    },
    {
      category: "Port & Insurance",
      deltaUsd: Math.round(otherDelta),
      percentage:
        baseline.totalCostUsd > 0 ? round((otherDelta / baseline.totalCostUsd) * 100, 1) : 0,
      direction: otherDelta > 0 ? "up" : otherDelta < 0 ? "down" : "flat",
      cumulativeUsd: (running += otherDelta),
    },
    {
      category: "Scenario Total",
      deltaUsd: simulated.totalCostUsd,
      percentage:
        baseline.totalCostUsd > 0
          ? round((simulated.totalCostUsd / baseline.totalCostUsd) * 100, 1)
          : 100,
      direction: costDiffUsd > 0 ? "up" : costDiffUsd < 0 ? "down" : "flat",
      cumulativeUsd: simulated.totalCostUsd,
    },
  ];

  // Side-by-side vessel comparison matrix
  const vesselComparisons: VesselScenarioComparison[] = VESSEL_CLASSES.map((spec) => {
    const baseC = baseline.checks?.find((c) => c.vesselClass === spec.id);
    const simC = simulated.checks?.find((c) => c.vesselClass === spec.id);

    const bStatus: FeasibilityStatus = baseC?.status ?? "REJECTED";
    const sStatus: FeasibilityStatus = simC?.status ?? "REJECTED";
    const bCost = baseC?.costPerT ?? 0;
    const sCost = simC?.costPerT ?? 0;

    return {
      vesselClass: spec.id,
      name: spec.name,
      baselineStatus: bStatus,
      simulatedStatus: sStatus,
      baselineCostPerT: bCost,
      simulatedCostPerT: sCost,
      costPerTDiff: round(sCost - bCost, 2),
      statusChanged: bStatus !== sStatus,
      baselineSelected: baseline.vesselClass === spec.id,
      simulatedSelected: simulated.vesselClass === spec.id,
      reasons: simC?.reasons ?? baseC?.reasons ?? [],
    };
  });

  const insights = generateScenarioExplanations(diff, baseline, simulated, result.input, request);

  return {
    id,
    name,
    description,
    input: result.input,
    baseline,
    simulated,
    diff,
    waterfall,
    insights,
    vesselComparisons,
  };
}

/**
 * Compares an array of saved scenarios against the exact same baseline.
 */
export function compareMultipleScenarios(
  request: CharterRequest,
  scenarios: { id: string; name: string; description?: string; input: ScenarioInput }[],
  now: Date,
): ScenarioComparison[] {
  return scenarios.map((s) => compareScenarios(request, s.input, now, s.name, s.id, s.description));
}
