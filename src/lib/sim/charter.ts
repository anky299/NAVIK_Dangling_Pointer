/**
 * Illustrative frontend simulation of the NAVIK charter decision pipeline.
 *
 * This is NOT the production model. It is a transparent, deterministic
 * heuristic so the prototype can demonstrate the decision report end-to-end
 * while the Python backend is not connected. Every output is labelled
 * "simulated" in the UI.
 */
import {
  CARGO_INSURANCE_USD_PER_T,
  DISTANCES_NM,
  LIGHTERING,
  ROUTE_LABELS,
  VESSEL_CLASSES,
  originById,
  portByCode,
} from "@/lib/api/reference";
import type {
  CharterDecisionReport,
  CharterRequest,
  CongestionIndicator,
  Decision,
  OriginRegion,
  PipelineStage,
  PortCode,
  RiskDriver,
  RiskLevel,
  VesselCheck,
  VesselClassSpec,
} from "@/lib/api/types";

export interface MarketState {
  /** Multiplier applied to cost-based freight to reflect market tightness. */
  multiplier: number;
  /** Expected 30-day change in freight rates, percent. */
  trend30dPct: number;
  /** Annualised-ish volatility proxy, 0–1. */
  volatility: number;
}

export const DEFAULT_MARKET: Record<OriginRegion, MarketState> = {
  AUS_QLD: { multiplier: 1.24, trend30dPct: 3.8, volatility: 0.11 },
  AUS_NSW: { multiplier: 1.2, trend30dPct: 1.2, volatility: 0.09 },
  AUS_WA: { multiplier: 1.18, trend30dPct: -5.4, volatility: 0.13 },
  IDN_KAL: { multiplier: 1.15, trend30dPct: -1.6, volatility: 0.08 },
};

export const DEFAULT_CONGESTION: Record<PortCode, CongestionIndicator> = {
  PRDP: { port: "PRDP", waitingVessels: 14, avgWaitDays: 2.8, berthOccupancyPct: 86, trend: "up" },
  VIZG: { port: "VIZG", waitingVessels: 9, avgWaitDays: 2.1, berthOccupancyPct: 79, trend: "flat" },
  GGVM: { port: "GGVM", waitingVessels: 6, avgWaitDays: 1.4, berthOccupancyPct: 72, trend: "down" },
  DHMR: { port: "DHMR", waitingVessels: 8, avgWaitDays: 1.9, berthOccupancyPct: 77, trend: "up" },
  HLDA: { port: "HLDA", waitingVessels: 11, avgWaitDays: 3.4, berthOccupancyPct: 91, trend: "up" },
};

const ROUTE_RISK: Record<OriginRegion, { score: number; label: string }> = {
  AUS_QLD: { score: 10, label: "Torres Strait pilotage & draft window" },
  AUS_NSW: { score: 7, label: "Southern Ocean weather exposure" },
  AUS_WA: { score: 8, label: "Pilbara cyclone-season closures" },
  IDN_KAL: { score: 5, label: "Makassar & Sunda Strait traffic density" },
};

export interface SimContext {
  now: Date;
  bunkerUsdPerT: number;
  market?: Partial<MarketState>;
  extraWaitDays?: number;
  /** 1 = normal availability; 0.8 = 20% fewer ships than normal */
  availabilityFactor?: number;
  congestion?: Record<PortCode, CongestionIndicator>;
  /** Optional speed adjustment in knots (e.g. -2 for eco-steaming, +1 for fast steaming) */
  speedDeltaKn?: number;
}

export const BASE_BUNKER_USD_PER_T = 620;
const POSITIONING_DAYS = 7;
const LOAD_DAYS = 2;
const MAX_PART_LADEN_EXCESS_M = 1.2;

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round5 = (n: number) => Math.round(n / 5) * 5;

export function daysBetween(from: Date, isoDate: string) {
  const to = new Date(`${isoDate}T00:00:00Z`).getTime();
  return Math.floor((to - from.getTime()) / 86_400_000);
}

export function riskLevelFor(score: number): RiskLevel {
  if (score < 35) return "LOW";
  if (score < 55) return "MODERATE";
  if (score < 72) return "ELEVATED";
  return "HIGH";
}

interface Evaluated extends VesselCheck {
  spec: VesselClassSpec;
  breakdown: CharterDecisionReport["costBreakdown"];
  etaDays: number;
  freightPerT: number;
}

function evaluateVessel(
  spec: VesselClassSpec,
  req: CharterRequest,
  ctx: Required<Pick<SimContext, "bunkerUsdPerT">> & {
    market: MarketState;
    waitDays: number;
    daysToDeadline: number;
    availabilityFactor: number;
    speedDeltaKn?: number;
  },
): Evaluated {
  const port = portByCode(req.destination);
  const lightering = LIGHTERING[req.destination];
  const distance = DISTANCES_NM[req.origin][req.destination];
  const reasons: string[] = [];
  let status: VesselCheck["status"] = "FEASIBLE";
  let capacity = spec.dwtMax;
  let lighteringCostPerT = 0;
  let lighteringDays = 0;

  const draftExcess = round(spec.ladenDraftM - port.maxDraftM, 2);
  if (draftExcess > 0) {
    if (lightering) {
      status = "CONDITIONAL";
      lighteringCostPerT = lightering.costUsdPerT;
      lighteringDays = lightering.extraDays;
      reasons.push(
        `Laden draft ${spec.ladenDraftM} m exceeds ${port.name} limit ${port.maxDraftM} m — requires lightering at ${lightering.location} (+$${lightering.costUsdPerT}/t, +${lightering.extraDays} d).`,
      );
    } else if (draftExcess <= MAX_PART_LADEN_EXCESS_M) {
      const tpc = spec.dwtMax / 1500;
      capacity = Math.round(spec.dwtMax - draftExcess * 100 * tpc);
      status = "CONDITIONAL";
      reasons.push(
        `Draft restricted by ${draftExcess.toFixed(1)} m at ${port.name} — part-laden to ~${(capacity / 1000).toFixed(0)}k t.`,
      );
    } else {
      status = "REJECTED";
      reasons.push(
        `Laden draft ${spec.ladenDraftM} m exceeds ${port.name} limit ${port.maxDraftM} m by ${draftExcess.toFixed(1)} m.`,
      );
    }
  }

  if (!lightering && spec.loaM > port.maxLoaM) {
    status = "REJECTED";
    reasons.push(`LOA ${spec.loaM} m exceeds ${port.name} berth limit ${port.maxLoaM} m.`);
  }

  const voyages = Math.max(1, Math.ceil(req.cargoTonnes / capacity));
  const perVoyage = req.cargoTonnes / voyages;
  const utilisation = perVoyage / capacity;

  if (utilisation < 0.55 && status !== "REJECTED") {
    status = "CONDITIONAL";
    reasons.push(
      `Cargo fills only ${Math.round(utilisation * 100)}% of capacity — dead-freight exposure.`,
    );
  }

  const availability = spec.availabilityPct * ctx.availabilityFactor;
  if (availability < 65 && status === "FEASIBLE") {
    status = "CONDITIONAL";
    reasons.push(
      `Thin tonnage: only ~${Math.round(availability)}% of class open in the laycan window.`,
    );
  }

  const effectiveSpeed = Math.max(8, spec.serviceSpeedKn + (ctx.speedDeltaKn ?? 0));
  const seaDays = distance / (effectiveSpeed * 24);
  const dischargeDays = perVoyage / port.dischargeRateTpd;
  const portDays = LOAD_DAYS + dischargeDays + ctx.waitDays + lighteringDays;
  const etaDays = POSITIONING_DAYS + LOAD_DAYS + seaDays + ctx.waitDays + lighteringDays;

  if (etaDays > ctx.daysToDeadline) {
    status = "REJECTED";
    reasons.push(
      `ETA ~${Math.ceil(etaDays)} days misses the delivery deadline by ${Math.ceil(etaDays - ctx.daysToDeadline)} day(s).`,
    );
  }

  const roundTripDays = seaDays * 2 + portDays;
  const tightness = 1 + Math.max(0, (100 - availability) / 100) * 0.35;
  const hireUsd = spec.dailyHireUsd * roundTripDays * ctx.market.multiplier * tightness * voyages;
  const speedRatio = effectiveSpeed / spec.serviceSpeedKn;
  const fuelFactor = Math.pow(speedRatio, 3);
  const bunkerUsd = spec.fuelTpd * fuelFactor * seaDays * 2 * ctx.bunkerUsdPerT * voyages;
  const portDuesUsd = port.portDuesUsdPerT * req.cargoTonnes + lighteringCostPerT * req.cargoTonnes;
  const demurrageReserveUsd = ctx.waitDays * spec.dailyHireUsd * 1.1 * voyages;
  const insuranceUsd = CARGO_INSURANCE_USD_PER_T[req.cargoType] * req.cargoTonnes;
  const total = hireUsd + bunkerUsd + portDuesUsd + demurrageReserveUsd + insuranceUsd;

  if (status === "FEASIBLE" && reasons.length === 0) {
    reasons.push(
      `Clears ${port.name} draft (${spec.ladenDraftM} m ≤ ${port.maxDraftM} m) with ${voyages} lifting${voyages > 1 ? "s" : ""} at ${Math.round(utilisation * 100)}% utilisation.`,
    );
  }

  return {
    vesselClass: spec.id,
    status,
    reasons,
    voyages,
    utilisationPct: Math.round(utilisation * 100),
    transitDays: round(seaDays, 1),
    totalCostUsd: Math.round(total),
    costPerT: round(total / req.cargoTonnes, 2),
    spec,
    etaDays,
    freightPerT: round((hireUsd + bunkerUsd) / req.cargoTonnes, 2),
    breakdown: {
      freightUsd: Math.round(hireUsd),
      bunkerUsd: Math.round(bunkerUsd),
      portDuesUsd: Math.round(portDuesUsd),
      demurrageReserveUsd: Math.round(demurrageReserveUsd),
      insuranceUsd: Math.round(insuranceUsd),
    },
  };
}

export function decide(params: {
  hasFeasible: boolean;
  trendPct: number;
  slackDays: number;
  voyages: number;
  preference: CharterRequest["contractPreference"];
}): Decision {
  const { hasFeasible, trendPct, slackDays, voyages, preference } = params;
  if (!hasFeasible) return "WAIT";
  if (trendPct >= 2) return "CHARTER_NOW";
  if (trendPct <= -3 && slackDays >= 21) return "WAIT";
  if (voyages > 1 || preference === "FLEXIBLE" || (trendPct < 0 && slackDays >= 10)) return "SPLIT";
  return "CHARTER_NOW";
}

export const PIPELINE: { id: PipelineStage["id"]; label: string }[] = [
  { id: "forecast", label: "Freight Forecast" },
  { id: "risk", label: "Disruption Risk" },
  { id: "feasibility", label: "Vessel / Port Feasibility" },
  { id: "cost", label: "Logistics Cost" },
  { id: "optimize", label: "Optimization" },
];

export function simulateCharterDecision(
  req: CharterRequest,
  ctx: SimContext,
): CharterDecisionReport {
  const origin = originById(req.origin);
  const port = portByCode(req.destination);
  const market: MarketState = { ...DEFAULT_MARKET[req.origin], ...ctx.market };
  const congestion = (ctx.congestion ?? DEFAULT_CONGESTION)[req.destination];
  const waitDays = congestion.avgWaitDays + (ctx.extraWaitDays ?? 0);
  const daysToDeadline = daysBetween(ctx.now, req.deliveryDeadline);
  const availabilityFactor = ctx.availabilityFactor ?? 1;

  const evaluated = VESSEL_CLASSES.map((spec) =>
    evaluateVessel(spec, req, {
      bunkerUsdPerT: ctx.bunkerUsdPerT,
      market,
      waitDays,
      daysToDeadline,
      availabilityFactor,
      speedDeltaKn: ctx.speedDeltaKn,
    }),
  );

  const rank = (s: VesselCheck["status"]) => (s === "FEASIBLE" ? 0 : s === "CONDITIONAL" ? 1 : 2);
  const candidates = evaluated
    .filter((e) => e.status !== "REJECTED")
    .sort((a, b) => rank(a.status) - rank(b.status) || a.totalCostUsd - b.totalCostUsd);
  // Prefer the cheapest overall, but a fully feasible option within 4% beats a conditional one.
  const cheapest = [...candidates].sort((a, b) => a.totalCostUsd - b.totalCostUsd)[0];
  const bestFeasible = candidates.find((c) => c.status === "FEASIBLE");
  const best =
    bestFeasible && cheapest && bestFeasible.totalCostUsd <= cheapest.totalCostUsd * 1.04
      ? bestFeasible
      : cheapest;

  const slackDays = best ? Math.floor(daysToDeadline - best.etaDays) : daysToDeadline;
  const decision = decide({
    hasFeasible: Boolean(best),
    trendPct: market.trend30dPct,
    slackDays,
    voyages: best?.voyages ?? 1,
    preference: req.contractPreference,
  });

  const freightPerT = best?.freightPerT ?? 0;
  const p50 = round(freightPerT * (1 + (market.trend30dPct / 100) * 0.5), 2);
  const forecastRange = {
    p10: round(p50 * (1 - market.volatility * 1.28), 2),
    p50,
    p90: round(p50 * (1 + market.volatility * 1.28), 2),
  };

  // Risk scoring
  const deadlineMonth = new Date(`${req.deliveryDeadline}T00:00:00Z`).getUTCMonth();
  const cycloneSeason = deadlineMonth >= 9 && deadlineMonth <= 11;
  const drivers: RiskDriver[] = [
    { label: ROUTE_RISK[req.origin].label, direction: "up", weight: ROUTE_RISK[req.origin].score },
    {
      label: `${port.name} anchorage wait ~${waitDays.toFixed(1)} d (${congestion.waitingVessels} vessels)`,
      direction: "up",
      weight: round(waitDays * 4, 0),
    },
    {
      label: `Freight volatility ${(market.volatility * 100).toFixed(0)}% on ${origin.shortName} lanes`,
      direction: "up",
      weight: round(market.volatility * 60, 0),
    },
  ];
  if (slackDays < 14) {
    drivers.push({
      label: `Thin schedule buffer: ${Math.max(0, slackDays)} day(s) of slack`,
      direction: "up",
      weight: slackDays < 7 ? 18 : 9,
    });
  } else {
    drivers.push({
      label: `Comfortable buffer of ${slackDays} days before deadline`,
      direction: "down",
      weight: 6,
    });
  }
  if (cycloneSeason) {
    drivers.push({
      label: "Bay of Bengal post-monsoon cyclone window (Oct–Dec)",
      direction: "up",
      weight: 10,
    });
  }
  if (best?.status === "CONDITIONAL") {
    drivers.push({
      label: "Selected vessel carries operating conditions",
      direction: "up",
      weight: 8,
    });
  }
  if (availabilityFactor < 0.9) {
    drivers.push({
      label: "Reduced fleet availability in loading window",
      direction: "up",
      weight: round((1 - availabilityFactor) * 40, 0),
    });
  }

  const riskScore = clamp(
    Math.round(18 + drivers.reduce((s, d) => s + (d.direction === "up" ? d.weight : -d.weight), 0)),
    5,
    98,
  );
  const riskLevel = riskLevelFor(riskScore);
  const confidence = round(clamp(0.92 - market.volatility * 1.6 - riskScore / 400, 0.42, 0.91), 2);

  let split: CharterDecisionReport["split"] = null;
  if (decision === "SPLIT") {
    const nowPct = clamp(
      round5(55 + market.trend30dPct * 4 - Math.max(0, slackDays - 10) * 0.5),
      30,
      70,
    );
    split = {
      nowPct,
      laterPct: 100 - nowPct,
      rationale:
        best && best.voyages > 1
          ? `Cargo needs ${best.voyages} liftings — fix ${nowPct}% now to protect the deadline, keep ${100 - nowPct}% open for a softer window.`
          : `Hedge timing risk: fix ${nowPct}% now, defer ${100 - nowPct}% while the ${origin.shortName} market is soft.`,
    };
  }

  const trendWord = market.trend30dPct >= 0 ? "firm" : "soften";
  const reasoning: string[] = [];
  if (best) {
    reasoning.push(
      `${best.spec.name} is the lowest-cost viable class at ~$${best.costPerT.toFixed(2)}/t landed, ${best.voyages} lifting${best.voyages > 1 ? "s" : ""}.`,
    );
    reasoning.push(
      `${origin.shortName} → ${port.name} rates are expected to ${trendWord} ${Math.abs(market.trend30dPct).toFixed(1)}% over 30 days (simulated forecast).`,
    );
    reasoning.push(
      slackDays >= 14
        ? `ETA leaves ${slackDays} days of slack, so timing is not the binding constraint.`
        : `Only ${Math.max(0, slackDays)} days of slack — schedule reliability dominates price.`,
    );
    const rejected = evaluated.filter((e) => e.status === "REJECTED").length;
    if (rejected)
      reasoning.push(
        `${rejected} vessel class${rejected > 1 ? "es were" : " was"} rejected on draft, length or deadline constraints.`,
      );
  } else {
    reasoning.push("No vessel class satisfies draft, length and deadline constraints together.");
    reasoning.push(
      "Extend the delivery deadline or select a deeper-draft discharge port such as Gangavaram.",
    );
  }
  if (decision === "WAIT" && best) {
    reasoning.push(
      "Waiting is favoured: softening rates and ample slack make a later fixture cheaper in expectation.",
    );
  }

  const headline =
    decision === "CHARTER_NOW"
      ? `Fix a ${best?.spec.name} now — rates are firming into the laycan window.`
      : decision === "SPLIT"
        ? `Split the programme: ${split?.nowPct}% now, ${split?.laterPct}% deferred.`
        : best
          ? "Hold — the market is softening and the schedule has room."
          : "Hold — no vessel meets the current constraints.";

  const stages: PipelineStage[] = [
    {
      id: "forecast",
      label: "Freight Forecast",
      summary: `P50 $${forecastRange.p50.toFixed(2)}/t · range $${forecastRange.p10.toFixed(2)}–${forecastRange.p90.toFixed(2)}`,
    },
    {
      id: "risk",
      label: "Disruption Risk",
      summary: `${riskLevel.toLowerCase()} · score ${riskScore}/100`,
    },
    {
      id: "feasibility",
      label: "Vessel / Port Feasibility",
      summary: `${candidates.length} of ${evaluated.length} classes viable at ${port.name}`,
    },
    {
      id: "cost",
      label: "Logistics Cost",
      summary: best ? `Landed ~$${best.costPerT.toFixed(2)}/t` : "No viable cost path",
    },
    {
      id: "optimize",
      label: "Optimization",
      summary: `Recommendation: ${decision.replace("_", " ")}`,
    },
  ];

  const empty = {
    freightUsd: 0,
    bunkerUsd: 0,
    portDuesUsd: 0,
    demurrageReserveUsd: 0,
    insuranceUsd: 0,
  };

  return {
    requestId: `SIM-${req.origin.slice(-3)}-${req.destination}-${Math.round(req.cargoTonnes / 1000)}K`,
    request: req,
    decision,
    headline,
    vesselClass: best?.vesselClass ?? null,
    routeLabel: ROUTE_LABELS[req.origin],
    distanceNm: DISTANCES_NM[req.origin][req.destination],
    transitDays: best?.transitDays ?? 0,
    port: req.destination,
    estimatedFreightUsdPerT: freightPerT,
    forecastRange,
    totalCostUsd: best?.totalCostUsd ?? 0,
    costBreakdown: best?.breakdown ?? empty,
    riskLevel,
    riskScore,
    confidence,
    slackDays,
    marketTrendPct: market.trend30dPct,
    checks: evaluated.map(({ spec: _s, breakdown: _b, etaDays: _e, freightPerT: _f, ...c }) => c),
    split,
    reasoning,
    riskDrivers: drivers.sort((a, b) => b.weight - a.weight),
    stages,
    provenance: {
      source: "demo",
      label: "Frontend simulation — illustrative heuristic",
      asOf: ctx.now.toISOString(),
    },
  };
}
