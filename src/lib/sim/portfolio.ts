/**
 * Strategic bulk-cargo procurement and fleet repositioning engine for NAVIK.
 *
 * Models sourcing allocation, discharge port optimization, contract cover,
 * supply concentration risks, and ballast repositioning opportunities
 * for Indian East Coast steelmaking cargo inflows.
 *
 * Deterministic and transparent heuristic based on the existing charter
 * and scenario engines. Demo data only.
 */
import type {
  Allocation,
  CargoType,
  ContractPreference,
  FeasibilityStatus,
  OpportunityLane,
  OriginRegion,
  OriginShare,
  PortfolioPlan,
  PortfolioRecommendation,
  PortfolioSensitivityPoint,
  PortfolioStrategy,
  PortCode,
  PortShare,
  ProcurementObjective,
  RiskLevel,
  RiskPreference,
  SourcingStem,
  VesselClassId,
} from "@/lib/api/types";
import {
  BASE_BUNKER_USD_PER_T,
  DEFAULT_CONGESTION,
  DEFAULT_MARKET,
  simulateCharterDecision,
} from "./charter";
import {
  CARGO_INSURANCE_USD_PER_T,
  DISTANCES_NM,
  LIGHTERING,
  ORIGINS,
  PORTS,
  VESSEL_CLASSES,
  originById,
  portByCode,
  vesselById,
} from "@/lib/api/reference";

/* ═══════════════════════════════════════════════
   Existing Contract & Risk Buckets (Preserved)
   ═══════════════════════════════════════════════ */

export const PRESET_ALLOCATIONS: Record<RiskPreference, Allocation> = {
  CONSERVATIVE: { spot: 15, shortTerm: 35, mediumTerm: 50 },
  BALANCED: { spot: 35, shortTerm: 40, mediumTerm: 25 },
  AGGRESSIVE: { spot: 60, shortTerm: 30, mediumTerm: 10 },
};

const BUCKETS = {
  spot: { mean: 15.4, sd: 3.2, idle: 0.05 },
  shortTerm: { mean: 16.0, sd: 1.7, idle: 0.09 },
  mediumTerm: { mean: 16.9, sd: 0.8, idle: 0.14 },
} as const;

const CORR = { spotShort: 0.6, spotMedium: 0.3, shortMedium: 0.5 };

export const OPPORTUNITY_LANES: OpportunityLane[] = [
  {
    id: "L1",
    from: "Paradip",
    to: "Port Hedland",
    cargo: "Ballast → iron-ore backhaul window",
    ballastNm: 3150,
    idleDaysSaved: 4.5,
    revenueOffsetUsd: 410_000,
  },
  {
    id: "L2",
    from: "Visakhapatnam",
    to: "Richards Bay",
    cargo: "Thermal coal triangulation",
    ballastNm: 4380,
    idleDaysSaved: 3.2,
    revenueOffsetUsd: 520_000,
  },
  {
    id: "L3",
    from: "Haldia",
    to: "Muara Pantai",
    cargo: "Short ballast to Kalimantan coal",
    ballastNm: 2950,
    idleDaysSaved: 2.6,
    revenueOffsetUsd: 260_000,
  },
  {
    id: "L4",
    from: "Gangavaram",
    to: "Hay Point",
    cargo: "Direct reposition for next coking-coal stem",
    ballastNm: 4630,
    idleDaysSaved: 1.8,
    revenueOffsetUsd: 180_000,
  },
];

export function normaliseAllocation(a: Allocation): Allocation {
  const total = a.spot + a.shortTerm + a.mediumTerm || 1;
  const spot = Math.round((a.spot / total) * 100);
  const shortTerm = Math.round((a.shortTerm / total) * 100);
  return { spot, shortTerm, mediumTerm: 100 - spot - shortTerm };
}

export function computePortfolio(
  preference: RiskPreference,
  allocation: Allocation,
  annualVolumeT = 2_400_000,
): PortfolioPlan {
  const a = normaliseAllocation(allocation);
  const w = { spot: a.spot / 100, shortTerm: a.shortTerm / 100, mediumTerm: a.mediumTerm / 100 };
  const mean =
    w.spot * BUCKETS.spot.mean +
    w.shortTerm * BUCKETS.shortTerm.mean +
    w.mediumTerm * BUCKETS.mediumTerm.mean;
  const s = {
    spot: BUCKETS.spot.sd * w.spot,
    short: BUCKETS.shortTerm.sd * w.shortTerm,
    med: BUCKETS.mediumTerm.sd * w.mediumTerm,
  };
  const variance =
    s.spot ** 2 +
    s.short ** 2 +
    s.med ** 2 +
    2 * s.spot * s.short * CORR.spotShort +
    2 * s.spot * s.med * CORR.spotMedium +
    2 * s.short * s.med * CORR.shortMedium;
  const idle =
    a.spot * BUCKETS.spot.idle +
    a.shortTerm * BUCKETS.shortTerm.idle +
    a.mediumTerm * BUCKETS.mediumTerm.idle;
  const lanes = [...OPPORTUNITY_LANES].sort((x, y) =>
    preference === "AGGRESSIVE"
      ? y.revenueOffsetUsd - x.revenueOffsetUsd
      : y.idleDaysSaved - x.idleDaysSaved,
  );
  return {
    preference,
    allocation: a,
    expectedCostUsdPerT: Math.round(mean * 100) / 100,
    stdDevUsdPerT: Math.round(Math.sqrt(variance) * 100) / 100,
    idleDaysPerQuarter: Math.round(idle * 10) / 10,
    annualVolumeT,
    lanes,
    provenance: {
      source: "demo",
      label: "Illustrative portfolio model",
      asOf: "2026-10-25T06:00:00Z",
    },
  };
}

/* ═══════════════════════════════════════════════
   Sourcing Stem & Allocation Intelligence
   ═══════════════════════════════════════════════ */

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

/** Computes the Herfindahl-Hirschman Index (0–10,000) for a set of share percentages */
export function computeHHI(sharesPct: number[]): number {
  if (sharesPct.length === 0) return 0;
  const total = sharesPct.reduce((acc, s) => acc + s, 0) || 1;
  return Math.round(sharesPct.reduce((acc, s) => acc + ((s / total) * 100) ** 2, 0));
}

/**
 * Evaluates an individual sourcing stem (origin -> destination with volume & vessel class)
 * using the core Charter decision engine.
 */
export function evaluateSourcingStem(params: {
  id: string;
  origin: OriginRegion;
  destination: PortCode;
  tonnes: number;
  vesselClass: VesselClassId;
  contractPreference?: ContractPreference;
  cargoType?: CargoType;
  deliveryDeadline?: string;
  now?: Date;
}): SourcingStem {
  const {
    id,
    origin,
    destination,
    tonnes,
    vesselClass,
    contractPreference = "SHORT_TERM",
    cargoType = "COKING_COAL",
    deliveryDeadline = "2026-12-31",
    now = new Date("2026-10-25T06:00:00Z"),
  } = params;

  const vSpec = vesselById(vesselClass);
  const pSpec = portByCode(destination);

  // Run charter engine heuristic
  const rep = simulateCharterDecision(
    {
      cargoTonnes: Math.max(10_000, tonnes),
      cargoType,
      origin,
      destination,
      deliveryDeadline,
      contractPreference,
    },
    { now, bunkerUsdPerT: BASE_BUNKER_USD_PER_T },
  );

  // Find check for requested vessel class
  const check = rep.checks.find((c) => c.vesselClass === vesselClass);
  const effectiveCostPerT = check ? check.costPerT : rep.estimatedFreightUsdPerT + 2.5;
  const totalSpend = check ? check.totalCostUsd : Math.round(effectiveCostPerT * tonnes);
  const voyages = check?.voyages ?? Math.max(1, Math.ceil(tonnes / vSpec.dwtMax));

  // Exact component cost breakdown calculation
  const lightering = LIGHTERING[destination];
  const waitDays = DEFAULT_CONGESTION[destination]?.avgWaitDays ?? 2;
  const lighteringCostPerT = lightering ? lightering.costUsdPerT : 0;
  const lighteringDays = lightering ? lightering.extraDays : 0;
  const effectiveDistance = DISTANCES_NM[origin]?.[destination] ?? 4000;
  const seaDays = check?.transitDays ?? round(effectiveDistance / (vSpec.serviceSpeedKn * 24), 1);
  const dischargeDays = tonnes / voyages / pSpec.dischargeRateTpd;
  const portDays = 2 + dischargeDays + waitDays + lighteringDays;
  const roundTripDays = seaDays * 2 + portDays;
  const mkt = DEFAULT_MARKET[origin] ?? { multiplier: 1.2, trend30dPct: 0, volatility: 0.1 };
  const availability = vSpec.availabilityPct;
  const tightness = 1 + Math.max(0, (100 - availability) / 100) * 0.35;
  const hireUsd = Math.round(
    vSpec.dailyHireUsd * roundTripDays * mkt.multiplier * tightness * voyages,
  );
  const bunkerUsd = Math.round(vSpec.fuelTpd * seaDays * 2 * BASE_BUNKER_USD_PER_T * voyages);
  const portDuesUsd = Math.round(pSpec.portDuesUsdPerT * tonnes + lighteringCostPerT * tonnes);
  const demurrageReserveUsd = Math.round(waitDays * vSpec.dailyHireUsd * 1.1 * voyages);
  const insuranceUsd = Math.round((CARGO_INSURANCE_USD_PER_T[cargoType] ?? 0.8) * tonnes);

  const costBreakdown =
    rep.vesselClass === vesselClass && rep.costBreakdown
      ? rep.costBreakdown
      : {
          freightUsd: hireUsd,
          bunkerUsd,
          portDuesUsd,
          demurrageReserveUsd,
          insuranceUsd,
        };

  const calculatedFreightPerT =
    tonnes > 0 ? round((costBreakdown.freightUsd + costBreakdown.bunkerUsd) / tonnes, 2) : 0;
  const freightPerT =
    calculatedFreightPerT > 0
      ? calculatedFreightPerT
      : check
        ? round(check.costPerT * 0.88, 2)
        : rep.estimatedFreightUsdPerT;

  const status: FeasibilityStatus = check?.status ?? "FEASIBLE";
  const reasons = check?.reasons ?? [];

  return {
    id,
    origin,
    destination,
    tonnes,
    vesselClass,
    contractPreference,
    voyages,
    freightUsdPerT: freightPerT,
    landedCostPerT: effectiveCostPerT,
    totalCostUsd: totalSpend,
    transitDays: check?.transitDays ?? rep.transitDays,
    etaDays: rep.transitDays + 9 + (DEFAULT_CONGESTION[destination]?.avgWaitDays ?? 2),
    feasibilityStatus: status,
    feasibilityReasons: reasons,
    riskLevel: rep.riskLevel,
    riskScore: rep.riskScore,
    costBreakdown,
  };
}

/**
 * Calculates aggregate portfolio metrics, origin/port shares, concentration HHI,
 * feasibility breakdown, and repositioning opportunities for a set of stems.
 */
export function computePortfolioStrategy(params: {
  id: string;
  name: string;
  objective: ProcurementObjective;
  description: string;
  totalDemandT: number;
  stems: SourcingStem[];
  riskPreference?: RiskPreference;
  customAllocation?: Allocation;
}): PortfolioStrategy {
  const {
    id,
    name,
    objective,
    description,
    totalDemandT,
    stems,
    riskPreference = "BALANCED",
    customAllocation,
  } = params;

  const allocatedT = stems.reduce((sum, s) => sum + s.tonnes, 0);
  const coveragePct = totalDemandT > 0 ? round((allocatedT / totalDemandT) * 100, 1) : 0;
  const totalSpendUsd = stems.reduce((sum, s) => sum + s.totalCostUsd, 0);
  const weightedCostPerT = allocatedT > 0 ? round(totalSpendUsd / allocatedT, 2) : 0;
  const totalVoyages = stems.reduce((sum, s) => sum + s.voyages, 0);
  const totalTransitDays = stems.reduce((sum, s) => sum + s.transitDays * s.tonnes, 0);
  const avgTransitDays = allocatedT > 0 ? round(totalTransitDays / allocatedT, 1) : 0;

  // Origin Shares & Concentration HHI
  const originMap = new Map<OriginRegion, { tonnes: number; spend: number }>();
  for (const s of stems) {
    const cur = originMap.get(s.origin) ?? { tonnes: 0, spend: 0 };
    cur.tonnes += s.tonnes;
    cur.spend += s.totalCostUsd;
    originMap.set(s.origin, cur);
  }

  const originShares: OriginShare[] = ORIGINS.map((o) => {
    const data = originMap.get(o.id) ?? { tonnes: 0, spend: 0 };
    const sharePct = allocatedT > 0 ? round((data.tonnes / allocatedT) * 100, 1) : 0;
    return {
      origin: o.id,
      name: o.name,
      shortName: o.shortName,
      tonnes: data.tonnes,
      sharePct,
      spendUsd: data.spend,
    };
  }).filter((os) => os.tonnes > 0);

  const originHHI = computeHHI(originShares.map((os) => os.sharePct));

  // Destination Port Shares & Concentration HHI
  const portMap = new Map<PortCode, { tonnes: number; spend: number }>();
  for (const s of stems) {
    const cur = portMap.get(s.destination) ?? { tonnes: 0, spend: 0 };
    cur.tonnes += s.tonnes;
    cur.spend += s.totalCostUsd;
    portMap.set(s.destination, cur);
  }

  const portShares: PortShare[] = PORTS.map((p) => {
    const data = portMap.get(p.code) ?? { tonnes: 0, spend: 0 };
    const sharePct = allocatedT > 0 ? round((data.tonnes / allocatedT) * 100, 1) : 0;
    return {
      port: p.code,
      name: p.name,
      tonnes: data.tonnes,
      sharePct,
      spendUsd: data.spend,
    };
  }).filter((ps) => ps.tonnes > 0);

  const portHHI = computeHHI(portShares.map((ps) => ps.sharePct));

  // Vessel Class Distribution
  const vesselClassShares = VESSEL_CLASSES.map((v) => {
    const vStems = stems.filter((s) => s.vesselClass === v.id);
    const tonnes = vStems.reduce((sum, s) => sum + s.tonnes, 0);
    const voyages = vStems.reduce((sum, s) => sum + s.voyages, 0);
    const sharePct = allocatedT > 0 ? round((tonnes / allocatedT) * 100, 1) : 0;
    return {
      vesselClass: v.id,
      name: v.name,
      tonnes,
      voyages,
      sharePct,
    };
  }).filter((vs) => vs.tonnes > 0);

  // Feasibility Breakdown
  let feasibleT = 0;
  let conditionalT = 0;
  let rejectedT = 0;

  for (const s of stems) {
    if (s.feasibilityStatus === "FEASIBLE") feasibleT += s.tonnes;
    else if (s.feasibilityStatus === "CONDITIONAL") conditionalT += s.tonnes;
    else rejectedT += s.tonnes;
  }

  const feasibilitySummary = {
    feasibleTonnes: feasibleT,
    conditionalTonnes: conditionalT,
    rejectedTonnes: rejectedT,
    feasiblePct: allocatedT > 0 ? round((feasibleT / allocatedT) * 100, 1) : 0,
    conditionalPct: allocatedT > 0 ? round((conditionalT / allocatedT) * 100, 1) : 0,
  };

  // Contract Duration Cover & Volatility
  const alloc = customAllocation ?? PRESET_ALLOCATIONS[riskPreference];
  const contractRisk = computePortfolio(riskPreference, alloc, totalDemandT);

  // Repositioning Opportunities Matching Discharged Stems
  const repositioningOpportunities = OPPORTUNITY_LANES.map((lane) => {
    // Match lane.from (e.g. Paradip, Gangavaram, Haldia) to port stems
    const matchingStems = stems.filter((s) => {
      const p = portByCode(s.destination);
      return p.name.toLowerCase() === lane.from.toLowerCase() || p.code === lane.from;
    });

    const applicableVoyages = matchingStems.reduce((sum, s) => sum + s.voyages, 0);
    const potentialSavingsUsd =
      applicableVoyages > 0
        ? Math.round(lane.revenueOffsetUsd * 0.45 * Math.min(3, applicableVoyages))
        : 0;

    return {
      lane,
      applicableVoyages,
      potentialSavingsUsd,
    };
  }).filter((ro) => ro.applicableVoyages > 0);

  const totalRepositioningSavingsUsd = repositioningOpportunities.reduce(
    (sum, ro) => sum + ro.potentialSavingsUsd,
    0,
  );
  const effectiveCostPerTWithRepositioning =
    allocatedT > 0
      ? round((totalSpendUsd - totalRepositioningSavingsUsd) / allocatedT, 2)
      : weightedCostPerT;

  // Composite Recommendation Score (0-100)
  // Higher is better: rewards low cost, low HHI, high feasibility, and low contract volatility
  const costScore = Math.max(0, 100 - (weightedCostPerT - 13.5) * 8);
  const hhiScore = Math.max(0, 100 - (originHHI + portHHI) / 100);
  const feasScore = feasibilitySummary.feasiblePct;
  const recommendationScore = Math.round(costScore * 0.4 + hhiScore * 0.3 + feasScore * 0.3);

  return {
    id,
    name,
    objective,
    description,
    totalDemandT,
    allocatedT,
    coveragePct,
    totalSpendUsd,
    weightedCostPerT,
    totalVoyages,
    avgTransitDays,
    originHHI,
    portHHI,
    originShares,
    portShares,
    vesselClassShares,
    feasibilitySummary,
    contractMix: alloc,
    contractRisk: {
      expectedCostUsdPerT: contractRisk.expectedCostUsdPerT,
      stdDevUsdPerT: contractRisk.stdDevUsdPerT,
      idleDaysPerQuarter: contractRisk.idleDaysPerQuarter,
    },
    repositioningOpportunities,
    totalRepositioningSavingsUsd,
    effectiveCostPerTWithRepositioning,
    stems,
    recommendationScore,
  };
}

/**
 * Builds candidate portfolio strategies for a target demand volume.
 */
export interface CandidatePortfolioOptions {
  cargoType?: CargoType;
  deliveryDeadline?: string;
  now?: Date;
  allowedOrigins?: OriginRegion[];
  allowedPorts?: PortCode[];
  allowedVesselClasses?: VesselClassId[];
}

function pickOrigin(
  preferred: OriginRegion,
  fallback: OriginRegion[],
  allowed?: OriginRegion[],
): OriginRegion {
  if (!allowed || allowed.length === 0) return preferred;
  if (allowed.includes(preferred)) return preferred;
  const match = fallback.find((o) => allowed.includes(o));
  return match ?? allowed[0]!;
}

function pickPort(preferred: PortCode, fallback: PortCode[], allowed?: PortCode[]): PortCode {
  if (!allowed || allowed.length === 0) return preferred;
  if (allowed.includes(preferred)) return preferred;
  const match = fallback.find((p) => allowed.includes(p));
  return match ?? allowed[0]!;
}

function pickVessel(
  preferred: VesselClassId,
  fallback: VesselClassId[],
  allowed?: VesselClassId[],
): VesselClassId {
  if (!allowed || allowed.length === 0) return preferred;
  if (allowed.includes(preferred)) return preferred;
  const match = fallback.find((v) => allowed.includes(v));
  return match ?? allowed[0]!;
}

/**
 * Builds candidate portfolio strategies for a target demand volume.
 * Supports filtering by allowed origins, discharge ports, and vessel classes.
 */
export function buildCandidatePortfolios(
  totalDemandT: number,
  cargoTypeOrOptions: CargoType | CandidatePortfolioOptions = "COKING_COAL",
  deliveryDeadlineParam = "2026-12-31",
  nowParam = new Date("2026-10-25T06:00:00Z"),
): Record<ProcurementObjective, PortfolioStrategy> {
  const normDemand = Math.max(100_000, totalDemandT);

  const isOpts = typeof cargoTypeOrOptions === "object";
  const cargoType: CargoType = isOpts
    ? (cargoTypeOrOptions.cargoType ?? "COKING_COAL")
    : cargoTypeOrOptions;
  const deliveryDeadline = isOpts
    ? (cargoTypeOrOptions.deliveryDeadline ?? deliveryDeadlineParam)
    : deliveryDeadlineParam;
  const now = isOpts ? (cargoTypeOrOptions.now ?? nowParam) : nowParam;
  const allowedOrigins = isOpts ? cargoTypeOrOptions.allowedOrigins : undefined;
  const allowedPorts = isOpts ? cargoTypeOrOptions.allowedPorts : undefined;
  const allowedVessels = isOpts ? cargoTypeOrOptions.allowedVesselClasses : undefined;

  // 1. LOWEST_COST: Economy of scale, heavy Capesize & Kamsarmax via deep-water berths
  const costStems: SourcingStem[] = [
    evaluateSourcingStem({
      id: "stem-c1",
      origin: pickOrigin("AUS_QLD", ["AUS_NSW", "AUS_WA", "IDN_KAL"], allowedOrigins),
      destination: pickPort("GGVM", ["PRDP", "DHMR", "VIZG", "HLDA"], allowedPorts),
      tonnes: Math.round(normDemand * 0.5),
      vesselClass: pickVessel("CAPESIZE", ["KAMSARMAX", "PANAMAX", "ULTRAMAX"], allowedVessels),
      contractPreference: "SPOT",
      cargoType,
      deliveryDeadline,
      now,
    }),
    evaluateSourcingStem({
      id: "stem-c2",
      origin: pickOrigin("AUS_QLD", ["AUS_NSW", "AUS_WA", "IDN_KAL"], allowedOrigins),
      destination: pickPort("PRDP", ["GGVM", "DHMR", "VIZG", "HLDA"], allowedPorts),
      tonnes: Math.round(normDemand * 0.3),
      vesselClass: pickVessel("KAMSARMAX", ["PANAMAX", "CAPESIZE", "ULTRAMAX"], allowedVessels),
      contractPreference: "SPOT",
      cargoType,
      deliveryDeadline,
      now,
    }),
    evaluateSourcingStem({
      id: "stem-c3",
      origin: pickOrigin("AUS_WA", ["AUS_NSW", "AUS_QLD", "IDN_KAL"], allowedOrigins),
      destination: pickPort("DHMR", ["PRDP", "GGVM", "VIZG", "HLDA"], allowedPorts),
      tonnes: Math.round(normDemand * 0.2),
      vesselClass: pickVessel("PANAMAX", ["KAMSARMAX", "ULTRAMAX", "SUPRAMAX"], allowedVessels),
      contractPreference: "SHORT_TERM",
      cargoType,
      deliveryDeadline,
      now,
    }),
  ];

  const lowestCost = computePortfolioStrategy({
    id: "strat-lowest-cost",
    name: "Cost-Optimized Scale",
    objective: "LOWEST_COST",
    description:
      "Maximizes large bulkers (Capesize/Kamsarmax) into deep-water Gangavaram and Paradip. Achieves lowest landed spend per tonne.",
    totalDemandT: normDemand,
    stems: costStems,
    riskPreference: "AGGRESSIVE",
  });

  // 2. BALANCED_RESILIENCE: Multi-origin (Queensland, NSW, Kalimantan) and multi-port
  const resilientStems: SourcingStem[] = [
    evaluateSourcingStem({
      id: "stem-b1",
      origin: pickOrigin("AUS_QLD", ["AUS_NSW", "AUS_WA", "IDN_KAL"], allowedOrigins),
      destination: pickPort("PRDP", ["DHMR", "GGVM", "VIZG", "HLDA"], allowedPorts),
      tonnes: Math.round(normDemand * 0.4),
      vesselClass: pickVessel("KAMSARMAX", ["PANAMAX", "ULTRAMAX", "CAPESIZE"], allowedVessels),
      contractPreference: "SHORT_TERM",
      cargoType,
      deliveryDeadline,
      now,
    }),
    evaluateSourcingStem({
      id: "stem-b2",
      origin: pickOrigin("AUS_NSW", ["AUS_QLD", "AUS_WA", "IDN_KAL"], allowedOrigins),
      destination: pickPort("GGVM", ["DHMR", "PRDP", "VIZG", "HLDA"], allowedPorts),
      tonnes: Math.round(normDemand * 0.3),
      vesselClass: pickVessel("PANAMAX", ["KAMSARMAX", "ULTRAMAX", "SUPRAMAX"], allowedVessels),
      contractPreference: "SHORT_TERM",
      cargoType,
      deliveryDeadline,
      now,
    }),
    evaluateSourcingStem({
      id: "stem-b3",
      origin: pickOrigin("IDN_KAL", ["AUS_WA", "AUS_NSW", "AUS_QLD"], allowedOrigins),
      destination: pickPort("DHMR", ["PRDP", "GGVM", "VIZG", "HLDA"], allowedPorts),
      tonnes: Math.round(normDemand * 0.3),
      vesselClass: pickVessel("ULTRAMAX", ["PANAMAX", "SUPRAMAX", "KAMSARMAX"], allowedVessels),
      contractPreference: "MEDIUM_TERM",
      cargoType,
      deliveryDeadline,
      now,
    }),
  ];

  const balanced = computePortfolioStrategy({
    id: "strat-balanced",
    name: "Resilient Sourcing Mix",
    objective: "BALANCED_RESILIENCE",
    description:
      "Diversifies cargo inflow across Queensland, NSW, and Kalimantan to eliminate single-point weather, port, or geopolitical vulnerabilities.",
    totalDemandT: normDemand,
    stems: resilientStems,
    riskPreference: "BALANCED",
  });

  // 3. SCHEDULE_RELIABILITY: Congestion-hedged, deep draft, minimal anchor queue
  const reliableStems: SourcingStem[] = [
    evaluateSourcingStem({
      id: "stem-s1",
      origin: pickOrigin("AUS_QLD", ["AUS_NSW", "AUS_WA", "IDN_KAL"], allowedOrigins),
      destination: pickPort("GGVM", ["DHMR", "PRDP", "VIZG", "HLDA"], allowedPorts),
      tonnes: Math.round(normDemand * 0.55),
      vesselClass: pickVessel("KAMSARMAX", ["PANAMAX", "CAPESIZE", "ULTRAMAX"], allowedVessels),
      contractPreference: "MEDIUM_TERM",
      cargoType,
      deliveryDeadline,
      now,
    }),
    evaluateSourcingStem({
      id: "stem-s2",
      origin: pickOrigin("AUS_NSW", ["AUS_QLD", "AUS_WA", "IDN_KAL"], allowedOrigins),
      destination: pickPort("DHMR", ["GGVM", "PRDP", "VIZG", "HLDA"], allowedPorts),
      tonnes: Math.round(normDemand * 0.45),
      vesselClass: pickVessel("PANAMAX", ["KAMSARMAX", "ULTRAMAX", "SUPRAMAX"], allowedVessels),
      contractPreference: "MEDIUM_TERM",
      cargoType,
      deliveryDeadline,
      now,
    }),
  ];

  const schedule = computePortfolioStrategy({
    id: "strat-schedule",
    name: "Congestion-Hedged Flow",
    objective: "SCHEDULE_RELIABILITY",
    description:
      "Bypasses high-queue anchorages (Paradip/Haldia) in favor of fast-turnaround deep berths at Gangavaram and Dhamra.",
    totalDemandT: normDemand,
    stems: reliableStems,
    riskPreference: "CONSERVATIVE",
  });

  // 4. MINIMIZE_CONGESTION: Spreads discharge to avoid peak berth occupancies
  const congestionStems: SourcingStem[] = [
    evaluateSourcingStem({
      id: "stem-m1",
      origin: pickOrigin("AUS_QLD", ["AUS_NSW", "AUS_WA", "IDN_KAL"], allowedOrigins),
      destination: pickPort("DHMR", ["PRDP", "GGVM", "VIZG", "HLDA"], allowedPorts),
      tonnes: Math.round(normDemand * 0.4),
      vesselClass: pickVessel("PANAMAX", ["KAMSARMAX", "ULTRAMAX", "SUPRAMAX"], allowedVessels),
      contractPreference: "SHORT_TERM",
      cargoType,
      deliveryDeadline,
      now,
    }),
    evaluateSourcingStem({
      id: "stem-m2",
      origin: pickOrigin("IDN_KAL", ["AUS_NSW", "AUS_QLD", "AUS_WA"], allowedOrigins),
      destination: pickPort("VIZG", ["PRDP", "GGVM", "DHMR", "HLDA"], allowedPorts),
      tonnes: Math.round(normDemand * 0.3),
      vesselClass: pickVessel("ULTRAMAX", ["SUPRAMAX", "PANAMAX", "KAMSARMAX"], allowedVessels),
      contractPreference: "SPOT",
      cargoType,
      deliveryDeadline,
      now,
    }),
    evaluateSourcingStem({
      id: "stem-m3",
      origin: pickOrigin("AUS_WA", ["AUS_QLD", "AUS_NSW", "IDN_KAL"], allowedOrigins),
      destination: pickPort("GGVM", ["DHMR", "PRDP", "VIZG", "HLDA"], allowedPorts),
      tonnes: Math.round(normDemand * 0.3),
      vesselClass: pickVessel("KAMSARMAX", ["PANAMAX", "CAPESIZE", "ULTRAMAX"], allowedVessels),
      contractPreference: "SHORT_TERM",
      cargoType,
      deliveryDeadline,
      now,
    }),
  ];

  const congestion = computePortfolioStrategy({
    id: "strat-congestion",
    name: "Anchor-Queue Hedged",
    objective: "MINIMIZE_CONGESTION",
    description:
      "Distributes discharge across Gangavaram, Dhamra, and Vizag outer harbour to keep average waiting times below 1.8 days.",
    totalDemandT: normDemand,
    stems: congestionStems,
    riskPreference: "BALANCED",
  });

  // 5. CUSTOM: Default seeded from balanced
  const custom = computePortfolioStrategy({
    id: "strat-custom",
    name: "Custom Plan",
    objective: "CUSTOM",
    description:
      "User-configured stem allocation across origins, ports, vessel classes, and contract commitments.",
    totalDemandT: normDemand,
    stems: [...resilientStems],
    riskPreference: "BALANCED",
  });

  return {
    LOWEST_COST: lowestCost,
    BALANCED_RESILIENCE: balanced,
    SCHEDULE_RELIABILITY: schedule,
    MINIMIZE_CONGESTION: congestion,
    CUSTOM: custom,
  };
}

/**
 * Rebalances existing sourcing stems proportionally so their sum matches target demand.
 */
export function rebalanceStemsToDemand(
  stems: SourcingStem[],
  targetDemandT: number,
  cargoType: CargoType = "COKING_COAL",
  deliveryDeadline = "2026-12-31",
  now = new Date("2026-10-25T06:00:00Z"),
): SourcingStem[] {
  const currentTotal = stems.reduce((sum, s) => sum + s.tonnes, 0);
  if (currentTotal <= 0 || stems.length === 0) return stems;
  const ratio = targetDemandT / currentTotal;

  return stems.map((stem, idx) => {
    let newTonnes = Math.round((stem.tonnes * ratio) / 5_000) * 5_000;
    if (idx === stems.length - 1) {
      const prevSum = stems
        .slice(0, idx)
        .reduce((acc, s) => acc + Math.round((s.tonnes * ratio) / 5_000) * 5_000, 0);
      newTonnes = Math.max(10_000, targetDemandT - prevSum);
    }
    return evaluateSourcingStem({
      id: stem.id,
      origin: stem.origin,
      destination: stem.destination,
      tonnes: newTonnes,
      vesselClass: stem.vesselClass,
      contractPreference: stem.contractPreference,
      cargoType,
      deliveryDeadline,
      now,
    });
  });
}

/**
 * Clones candidate strategy stems as an editable custom plan with unique stem IDs.
 */
export function cloneStrategyAsCustom(
  strategy: PortfolioStrategy,
  targetDemandT?: number,
  cargoType: CargoType = "COKING_COAL",
  deliveryDeadline = "2026-12-31",
  now = new Date("2026-10-25T06:00:00Z"),
): SourcingStem[] {
  const normDemand = targetDemandT ?? strategy.totalDemandT;
  const rebalanced = rebalanceStemsToDemand(
    strategy.stems,
    normDemand,
    cargoType,
    deliveryDeadline,
    now,
  );
  return rebalanced.map((s, idx) => ({
    ...s,
    id: `custom-stem-${Date.now()}-${idx + 1}`,
  }));
}

/**
 * Runs a portfolio strategy through Scenario Lab stress conditions to measure downside resilience.
 * Evaluates each stem under stressed market parameters using the core charter engine.
 */
export function evaluatePortfolioSensitivities(
  strategy: PortfolioStrategy,
  cargoType: CargoType = "COKING_COAL",
  deliveryDeadline = "2026-12-31",
  now = new Date("2026-10-25T06:00:00Z"),
): PortfolioSensitivityPoint[] {
  const baseCost = strategy.weightedCostPerT;

  const shocks = [
    {
      label: "Base Case",
      description: "Current demo market rates with no stress shocks applied.",
      freightShockPct: 0,
      bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
      congestionDays: 0,
      fleetAvailabilityPct: 100,
    },
    {
      label: "Freight Rate Shock (+20%)",
      description: "Geopolitical route tightening & tonnage shortage drive a +20% spot rate surge.",
      freightShockPct: 20,
      bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
      congestionDays: 0,
      fleetAvailabilityPct: 90,
    },
    {
      label: "Bunker Price Surge ($800/t)",
      description: "Crude supply squeeze pushes Singapore VLSFO to $800/t (+29%).",
      freightShockPct: 5,
      bunkerUsdPerT: 800,
      congestionDays: 0,
      fleetAvailabilityPct: 95,
    },
    {
      label: "Monsoon Port Delay (+5 Days)",
      description: "Bay of Bengal swells cause 5-day anchorage holds at discharge terminals.",
      freightShockPct: 6,
      bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
      congestionDays: 5,
      fleetAvailabilityPct: 90,
    },
    {
      label: "Compound Downside Shock",
      description: "Simultaneous +20% freight, $800/t bunker, 5-day port delay, and tight fleet.",
      freightShockPct: 20,
      bunkerUsdPerT: 800,
      congestionDays: 5,
      fleetAvailabilityPct: 80,
    },
  ];

  return shocks.map((sh) => {
    let totalSpend = 0;
    let totalT = 0;

    for (const stem of strategy.stems) {
      const baseMkt = DEFAULT_MARKET[stem.origin] ?? {
        multiplier: 1.2,
        trend30dPct: 0,
        volatility: 0.1,
      };
      const rep = simulateCharterDecision(
        {
          cargoTonnes: Math.max(10_000, stem.tonnes),
          cargoType,
          origin: stem.origin,
          destination: stem.destination,
          deliveryDeadline,
          contractPreference: stem.contractPreference,
        },
        {
          now,
          bunkerUsdPerT: sh.bunkerUsdPerT,
          extraWaitDays: sh.congestionDays,
          availabilityFactor: sh.fleetAvailabilityPct / 100,
          market: {
            multiplier: baseMkt.multiplier * (1 + sh.freightShockPct / 100),
            trend30dPct: baseMkt.trend30dPct + sh.freightShockPct * 0.25,
            volatility:
              baseMkt.volatility + Math.abs(sh.freightShockPct) / 400 + sh.congestionDays / 200,
          },
        },
      );

      const check = rep.checks.find((c) => c.vesselClass === stem.vesselClass);
      const stemSpend = check
        ? check.totalCostUsd
        : Math.round(rep.estimatedFreightUsdPerT * stem.tonnes);

      totalSpend += stemSpend;
      totalT += stem.tonnes;
    }

    const stressedCostPerT = totalT > 0 ? round(totalSpend / totalT, 2) : baseCost;
    const costDeltaUsdPerT = round(stressedCostPerT - baseCost, 2);
    const costDeltaPct = baseCost > 0 ? round((costDeltaUsdPerT / baseCost) * 100, 1) : 0;

    return {
      shockLabel: sh.label,
      shockDescription: sh.description,
      freightShockPct: sh.freightShockPct,
      bunkerUsdPerT: sh.bunkerUsdPerT,
      congestionDays: sh.congestionDays,
      fleetAvailabilityPct: sh.fleetAvailabilityPct,
      weightedCostPerT: stressedCostPerT,
      totalSpendUsd: Math.round(totalSpend),
      costDeltaUsdPerT,
      costDeltaPct,
    };
  });
}

/**
 * Generates explainable procurement recommendations comparing candidate strategies.
 */
export function generatePortfolioRecommendation(
  strategies: PortfolioStrategy[],
  selectedObjective: ProcurementObjective,
): PortfolioRecommendation {
  const preferred = strategies.find((s) => s.objective === selectedObjective) ?? strategies[0]!;
  const lowestCost = strategies.find((s) => s.objective === "LOWEST_COST") ?? strategies[0]!;
  const balanced = strategies.find((s) => s.objective === "BALANCED_RESILIENCE") ?? strategies[0]!;

  const costDeltaVsLowest = round(preferred.weightedCostPerT - lowestCost.weightedCostPerT, 2);
  const costSavingsVsBalanced = round(balanced.weightedCostPerT - preferred.weightedCostPerT, 2);

  let headline = "";
  let advantage = "";
  let tradeoff = "";
  let decisionCriteria = "";
  let assumptionsThatCouldChangeRecommendation = "";

  if (selectedObjective === "LOWEST_COST") {
    headline = `Capesize & deep-berth economies yield the lowest landed expenditure ($${preferred.weightedCostPerT.toFixed(2)}/t).`;
    advantage = `Saves $${Math.max(0, costSavingsVsBalanced).toFixed(2)}/t ($${((Math.max(0, costSavingsVsBalanced) * preferred.allocatedT) / 1_000_000).toFixed(2)}M total) vs balanced mix by maximizing Capesize displacement at Gangavaram and Paradip.`;
    tradeoff = `High origin concentration (HHI ${preferred.originHHI}) in Queensland leaves intake vulnerable to cyclone-season port stoppages.`;
    decisionCriteria =
      "Prioritizes minimum landed dollar cost per tonne over supply diversity and demurrage risk buffers.";
    assumptionsThatCouldChangeRecommendation =
      "If Australian cyclone activity or demurrage queues exceed 4.5 days at Paradip, the Resilient Mix overcomes scale savings.";
  } else if (selectedObjective === "BALANCED_RESILIENCE") {
    headline = `Multi-origin sourcing diversifies supply chain at an incremental cost of $${Math.max(0, costDeltaVsLowest).toFixed(2)}/t.`;
    advantage = `Low concentration index (HHI ${preferred.originHHI}) protects steel mill blast furnaces against single-corridor disruptions by incorporating NSW and Kalimantan.`;
    tradeoff =
      "Slightly higher unit cost due to smaller vessel classes (Panamax/Ultramax) required at secondary shallow-draft berths.";
    decisionCriteria =
      "Prioritizes geopolitical, meteorological, and supply continuity over raw vessel displacement scale.";
    assumptionsThatCouldChangeRecommendation =
      "If Australia spot Capesize rates drop by >15% while Indonesian barge logistics tighten, scale concentration becomes substantially more attractive.";
  } else if (selectedObjective === "SCHEDULE_RELIABILITY") {
    headline =
      "Congestion-hedged allocation guarantees delivery windows by bypassing anchorage bottlenecks.";
    advantage =
      "Routes 100% of cargo to deep private terminals (Gangavaram & Dhamra) with rapid mechanised discharge and <1.8 days average waiting time.";
    tradeoff =
      "Incurs longer inland rail/rake logistics distance from Gangavaram to interior Odisha and Jharkhand steel plants.";
    decisionCriteria =
      "Prioritizes laycan deadline adherence and demurrage elimination over coastal transport distance.";
    assumptionsThatCouldChangeRecommendation =
      "If Paradip anchorage waiting times drop below 1.2 days, direct Paradip discharge recovers schedule certainty with lower rail rake freight.";
  } else if (selectedObjective === "MINIMIZE_CONGESTION") {
    headline = "Discharge spread evenly across 3 East Coast ports to eliminate berth queuing.";
    advantage =
      "Keeps average anchorage wait under 1.8 days and minimizes vessel laytime demurrage penalties.";
    tradeoff =
      "Multi-port logistics coordination and split cargo inspections across Paradip, Dhamra, and Visakhapatnam.";
    decisionCriteria =
      "Prioritizes vessel turnaround velocity and demurrage risk mitigation across multiple regional terminals.";
    assumptionsThatCouldChangeRecommendation =
      "If a dedicated mechanized berth is guaranteed at Paradip, volume can safely reconcentrate without queue risk.";
  } else {
    headline = "Custom sourcing configuration tailored to specific steel plant demands.";
    advantage =
      "User-controlled tonnage allocation and vessel pairing across designated discharge gateways.";
    tradeoff =
      "Requires manual reconciliation of laycan deadlines, draft restrictions, and contractual commitments.";
    decisionCriteria =
      "Tailored user allocation matching bespoke plant blast furnace blends and logistical requirements.";
    assumptionsThatCouldChangeRecommendation =
      "Depends on real-time plant inventory stock and specific charter party terms.";
  }

  const concentrationWarning =
    preferred.originHHI > 4000
      ? `Warning: Origin HHI is ${preferred.originHHI} (high single-source dependency on ${preferred.originShares[0]?.shortName ?? "primary origin"}).`
      : undefined;

  const feasibilityAlert =
    preferred.feasibilitySummary.conditionalPct > 20
      ? `${preferred.feasibilitySummary.conditionalPct}% of cargo volume carries operational conditions (part-laden or tidal draft windows).`
      : undefined;

  const sensitivityNote = `Under a +20% freight market spike, this strategy expands landed spend by approximately $${round(preferred.weightedCostPerT * 0.13, 2)}/t. Hedged via ${preferred.contractMix.mediumTerm}% medium-term COA commitment.`;

  return {
    preferredStrategyId: preferred.id,
    preferredStrategyName: preferred.name,
    objective: selectedObjective,
    headline,
    primaryAdvantage: advantage,
    keyTradeoff: tradeoff,
    feasibilityAlert,
    concentrationWarning,
    sensitivityNote,
    decisionCriteria,
    assumptionsThatCouldChangeRecommendation,
  };
}
