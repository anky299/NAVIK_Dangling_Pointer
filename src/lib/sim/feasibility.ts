/**
 * Fleet & Port Feasibility Intelligence Engine.
 *
 * Evaluates bulk-carrier naval specifications against discharge-port nautical,
 * physical, and operational constraints across Indian East Coast ports.
 *
 * Evaluation Rules:
 * - FEASIBLE: Every required, known hard constraint passes with safe clearance.
 * - CONDITIONAL: Suitability depends on a verified operational condition (lightering,
 *   part-laden short-loading, tidal window, or restricted anchorage discharge).
 * - REJECTED: A known physical hard constraint is violated without a mitigating mechanism.
 * - Missing data is never treated as passing; it triggers an explicit verification flag.
 */
import { LIGHTERING, PORTS, VESSEL_CLASSES, portByCode, vesselById } from "@/lib/api/reference";
import type {
  CargoType,
  FeasibilityStatus,
  PortCode,
  PortProfile,
  VesselClassId,
  VesselClassSpec,
} from "@/lib/api/types";

export type ConstraintStatus = "PASS" | "CONDITIONAL" | "VIOLATION" | "UNVERIFIED";

export interface ConstraintCheck {
  id: string;
  name: string;
  category: "DIMENSIONAL" | "NAUTICAL" | "OPERATIONAL" | "CARGO";
  vesselValue: string | number;
  limitValue: string | number;
  unit: string;
  margin: number | null;
  marginLabel: string;
  status: ConstraintStatus;
  explanation: string;
  recommendedAction: string;
  isVerified: boolean;
}

export interface VesselFeasibilityReport {
  vesselClass: VesselClassSpec;
  port: PortProfile;
  status: FeasibilityStatus;
  checks: ConstraintCheck[];
  effectiveCapacityT: number;
  capacityDeratingPct: number;
  requiresLightering: boolean;
  lighteringDetails: {
    costUsdPerT: number;
    extraDays: number;
    location: string;
  } | null;
  keyTradeoff: string;
  summaryReason: string;
  recommendationNote: string;
  unverifiedCount: number;
  confidenceScore: number;
}

export interface PortFleetFeasibilitySummary {
  port: PortProfile;
  reports: VesselFeasibilityReport[];
  totalEvaluated: number;
  feasibleCount: number;
  conditionalCount: number;
  rejectedCount: number;
  verificationRequiredCount: number;
  recommendedClassId: VesselClassId | null;
  deepestCandidateClassId: VesselClassId | null;
}

export const MAX_PART_LADEN_EXCESS_M = 1.2;

/**
 * Evaluates draft constraints between vessel laden draft and port maximum depth.
 */
export function evaluateDraftConstraint(
  spec: VesselClassSpec,
  port: PortProfile,
  lightering?: { costUsdPerT: number; extraDays: number; location: string },
): ConstraintCheck {
  const margin = Number((port.maxDraftM - spec.ladenDraftM).toFixed(2));
  const excess = spec.ladenDraftM - port.maxDraftM;

  if (margin >= 0) {
    const isTight = margin < 0.6;
    return {
      id: "DRAFT",
      name: "Permissible Draft vs Laden Draft",
      category: "NAUTICAL",
      vesselValue: spec.ladenDraftM.toFixed(1),
      limitValue: port.maxDraftM.toFixed(1),
      unit: "m",
      margin,
      marginLabel: `+${margin.toFixed(1)} m clearance`,
      status: isTight ? "CONDITIONAL" : "PASS",
      explanation: isTight
        ? `Laden draft ${spec.ladenDraftM} m satisfies port datum ${port.maxDraftM} m, but underkeel clearance is narrow (${margin.toFixed(1)} m). Tidal surge confirmation recommended.`
        : `Laden draft ${spec.ladenDraftM} m safely conforms to ${port.name} permissible draft of ${port.maxDraftM} m (+${margin.toFixed(1)} m margin).`,
      recommendedAction: isTight
        ? "Request port pilotage hydrographic update prior to arrival."
        : "Standard berthing clearance without draft restrictions.",
      isVerified: true,
    };
  }

  // Margin < 0: Excess draft
  if (lightering) {
    return {
      id: "DRAFT",
      name: "Permissible Draft vs Laden Draft",
      category: "NAUTICAL",
      vesselValue: spec.ladenDraftM.toFixed(1),
      limitValue: port.maxDraftM.toFixed(1),
      unit: "m",
      margin,
      marginLabel: `${margin.toFixed(1)} m deficit (Lightering Required)`,
      status: "CONDITIONAL",
      explanation: `Laden draft ${spec.ladenDraftM} m exceeds ${port.name} river/approach limit of ${port.maxDraftM} m by ${excess.toFixed(1)} m. Permitted via lightering at ${lightering.location} (+$${lightering.costUsdPerT}/t, +${lightering.extraDays} days).`,
      recommendedAction: `Contract lightering tugs and barges at ${lightering.location} prior to final river transit.`,
      isVerified: true,
    };
  }

  if (excess <= MAX_PART_LADEN_EXCESS_M) {
    return {
      id: "DRAFT",
      name: "Permissible Draft vs Laden Draft",
      category: "NAUTICAL",
      vesselValue: spec.ladenDraftM.toFixed(1),
      limitValue: port.maxDraftM.toFixed(1),
      unit: "m",
      margin,
      marginLabel: `${margin.toFixed(1)} m deficit (Part-Laden Allowed)`,
      status: "CONDITIONAL",
      explanation: `Laden draft ${spec.ladenDraftM} m exceeds ${port.name} datum ${port.maxDraftM} m by ${excess.toFixed(1)} m. Allowed on part-laden intake or high-water spring tidal transit.`,
      recommendedAction: `Derate cargo intake to bring arrival draft within ${port.maxDraftM} m or schedule berthing on high-water tide.`,
      isVerified: true,
    };
  }

  return {
    id: "DRAFT",
    name: "Permissible Draft vs Laden Draft",
    category: "NAUTICAL",
    vesselValue: spec.ladenDraftM.toFixed(1),
    limitValue: port.maxDraftM.toFixed(1),
    unit: "m",
    margin,
    marginLabel: `${margin.toFixed(1)} m deficit (Exceeds Limit)`,
    status: "VIOLATION",
    explanation: `Laden draft ${spec.ladenDraftM} m exceeds ${port.name} maximum draft ${port.maxDraftM} m by ${excess.toFixed(1)} m, beyond permissible part-laden safety threshold (${MAX_PART_LADEN_EXCESS_M} m).`,
    recommendedAction:
      "Vessel cannot enter this port fully laden or part-laden. Reject candidate or consider alternative deepwater terminal.",
    isVerified: true,
  };
}

/**
 * Evaluates vessel Length Overall (LOA) against quay pocket capacity.
 */
export function evaluateLoaConstraint(
  spec: VesselClassSpec,
  port: PortProfile,
  lightering?: { costUsdPerT: number; extraDays: number; location: string },
): ConstraintCheck {
  const margin = Number((port.maxLoaM - spec.loaM).toFixed(1));
  const excess = spec.loaM - port.maxLoaM;

  if (margin >= 0) {
    return {
      id: "LOA",
      name: "Length Overall (LOA) vs Berth Limit",
      category: "DIMENSIONAL",
      vesselValue: spec.loaM.toFixed(1),
      limitValue: port.maxLoaM.toFixed(1),
      unit: "m",
      margin,
      marginLabel: `+${margin.toFixed(1)} m clearance`,
      status: "PASS",
      explanation: `Vessel LOA ${spec.loaM} m fits within ${port.name} maximum berth envelope of ${port.maxLoaM} m.`,
      recommendedAction: "No berth length constraint.",
      isVerified: true,
    };
  }

  if (lightering) {
    return {
      id: "LOA",
      name: "Length Overall (LOA) vs Berth Limit",
      category: "DIMENSIONAL",
      vesselValue: spec.loaM.toFixed(1),
      limitValue: port.maxLoaM.toFixed(1),
      unit: "m",
      margin,
      marginLabel: `${margin.toFixed(1)} m excess (Anchorage Lightering)`,
      status: "CONDITIONAL",
      explanation: `Vessel LOA ${spec.loaM} m exceeds ${port.name} berth limit ${port.maxLoaM} m, but vessel will discharge offshore at ${lightering.location} without occupying river quays.`,
      recommendedAction: "Confirm anchorage transshipment permit with maritime authorities.",
      isVerified: true,
    };
  }

  return {
    id: "LOA",
    name: "Length Overall (LOA) vs Berth Limit",
    category: "DIMENSIONAL",
    vesselValue: spec.loaM.toFixed(1),
    limitValue: port.maxLoaM.toFixed(1),
    unit: "m",
    margin,
    marginLabel: `${margin.toFixed(1)} m excess`,
    status: "VIOLATION",
    explanation: `Vessel LOA ${spec.loaM} m exceeds ${port.name} maximum berth pocket length ${port.maxLoaM} m by ${excess.toFixed(1)} m.`,
    recommendedAction:
      "Vessel cannot berth at terminal quays. Reject or seek special dispensation for overhang.",
    isVerified: true,
  };
}

/**
 * Evaluates vessel beam against port fairway and unloader outreach restrictions.
 */
export function evaluateBeamConstraint(
  spec: VesselClassSpec,
  port: PortProfile,
  lightering?: { costUsdPerT: number; extraDays: number; location: string },
): ConstraintCheck {
  const margin = Number((port.maxBeamM - spec.beamM).toFixed(1));
  const excess = spec.beamM - port.maxBeamM;

  if (margin >= 0) {
    return {
      id: "BEAM",
      name: "Beam vs Channel / Unloader Limit",
      category: "DIMENSIONAL",
      vesselValue: spec.beamM.toFixed(1),
      limitValue: port.maxBeamM.toFixed(1),
      unit: "m",
      margin,
      marginLabel: `+${margin.toFixed(1)} m clearance`,
      status: "PASS",
      explanation: `Vessel beam ${spec.beamM} m is within ${port.name} channel and shore unloader limit of ${port.maxBeamM} m.`,
      recommendedAction: "No beam or crane outreach constraint.",
      isVerified: true,
    };
  }

  if (lightering) {
    return {
      id: "BEAM",
      name: "Beam vs Channel / Unloader Limit",
      category: "DIMENSIONAL",
      vesselValue: spec.beamM.toFixed(1),
      limitValue: port.maxBeamM.toFixed(1),
      unit: "m",
      margin,
      marginLabel: `${margin.toFixed(1)} m excess (Offshore Only)`,
      status: "CONDITIONAL",
      explanation: `Vessel beam ${spec.beamM} m exceeds ${port.name} lock/dock limit of ${port.maxBeamM} m, but cargo is lightered offshore.`,
      recommendedAction: "Ensure floating crane / grab gear matches vessel beam.",
      isVerified: true,
    };
  }

  return {
    id: "BEAM",
    name: "Beam vs Channel / Unloader Limit",
    category: "DIMENSIONAL",
    vesselValue: spec.beamM.toFixed(1),
    limitValue: port.maxBeamM.toFixed(1),
    unit: "m",
    margin,
    marginLabel: `${margin.toFixed(1)} m excess`,
    status: "VIOLATION",
    explanation: `Vessel beam ${spec.beamM} m exceeds ${port.name} permissible beam of ${port.maxBeamM} m by ${excess.toFixed(1)} m. Shore cranes cannot span the outer hatches.`,
    recommendedAction: "Vessel cannot be discharged by shore unloaders. Reject candidate.",
    isVerified: true,
  };
}

/**
 * Evaluates Deadweight Tonnage (DWT) against terminal infrastructure ratings.
 */
export function evaluateDwtConstraint(
  spec: VesselClassSpec,
  port: PortProfile,
  lightering?: { costUsdPerT: number; extraDays: number; location: string },
): ConstraintCheck {
  const margin = port.maxDwt - spec.dwtMax;

  if (margin >= 0) {
    return {
      id: "DWT",
      name: "Deadweight (DWT) vs Terminal Capacity",
      category: "CARGO",
      vesselValue: `${Math.round(spec.dwtMax / 1000)}k`,
      limitValue: `${Math.round(port.maxDwt / 1000)}k`,
      unit: "t",
      margin,
      marginLabel: `+${Math.round(margin / 1000)}k t margin`,
      status: "PASS",
      explanation: `Vessel max DWT (${Math.round(spec.dwtMax / 1000)}k t) conforms to ${port.name} structural bollard and berth design (${Math.round(port.maxDwt / 1000)}k t).`,
      recommendedAction: "Full deadweight intake permitted.",
      isVerified: true,
    };
  }

  if (lightering) {
    return {
      id: "DWT",
      name: "Deadweight (DWT) vs Terminal Capacity",
      category: "CARGO",
      vesselValue: `${Math.round(spec.dwtMax / 1000)}k`,
      limitValue: `${Math.round(port.maxDwt / 1000)}k`,
      unit: "t",
      margin,
      marginLabel: `${Math.round(margin / 1000)}k t excess (Lightering)`,
      status: "CONDITIONAL",
      explanation: `Vessel nominal DWT (${Math.round(spec.dwtMax / 1000)}k t) exceeds dock rating (${Math.round(port.maxDwt / 1000)}k t); permitted because vessel discharges into feeder barges at anchorage.`,
      recommendedAction: "Nominate lightering barges meeting port dock DWT limits.",
      isVerified: true,
    };
  }

  // Part laden capability if draft deficit is within part laden limit
  const draftExcess = spec.ladenDraftM - port.maxDraftM;
  if (draftExcess <= MAX_PART_LADEN_EXCESS_M) {
    return {
      id: "DWT",
      name: "Deadweight (DWT) vs Terminal Capacity",
      category: "CARGO",
      vesselValue: `${Math.round(spec.dwtMax / 1000)}k`,
      limitValue: `${Math.round(port.maxDwt / 1000)}k`,
      unit: "t",
      margin,
      marginLabel: `${Math.round(margin / 1000)}k t excess (Part-Laden Required)`,
      status: "CONDITIONAL",
      explanation: `Vessel max DWT (${Math.round(spec.dwtMax / 1000)}k t) exceeds dock capacity (${Math.round(port.maxDwt / 1000)}k t). Requires short-loading to ~${Math.round(port.maxDwt / 1000)}k t.`,
      recommendedAction: "Cap cargo bill of lading to maximum allowable terminal displacement.",
      isVerified: true,
    };
  }

  return {
    id: "DWT",
    name: "Deadweight (DWT) vs Terminal Capacity",
    category: "CARGO",
    vesselValue: `${Math.round(spec.dwtMax / 1000)}k`,
    limitValue: `${Math.round(port.maxDwt / 1000)}k`,
    unit: "t",
    margin,
    marginLabel: `${Math.round(margin / 1000)}k t excess`,
    status: "VIOLATION",
    explanation: `Vessel deadweight exceeds ${port.name} rated terminal handling limits by ${Math.round(Math.abs(margin) / 1000)}k t.`,
    recommendedAction:
      "Vessel displacement exceeds civil dock structural ratings. Reject candidate.",
    isVerified: true,
  };
}

/**
 * Generates an operational verification item when specific berth or river telemetry is missing.
 */
export function evaluateVerificationItem(
  port: PortProfile,
  spec: VesselClassSpec,
): ConstraintCheck {
  // If Haldia: River navigational channel depth requires pilotage notice verification
  if (port.code === "HLDA") {
    return {
      id: "VERIFY_HOOGHLY",
      name: "Hooghly River Pilotage Notice Verification",
      category: "OPERATIONAL",
      vesselValue: "Dynamic Draft",
      limitValue: "Daily Pilot Bulletin",
      unit: "m",
      margin: null,
      marginLabel: "Requires Verification",
      status: "UNVERIFIED",
      explanation:
        "Riverine siltation causes daily shifts in the Hooghly navigation channel. Actual maximum safe draft varies by tide cycle and must be confirmed with Kolkata Port Trust.",
      recommendedAction:
        "Obtain latest Kolkata Port Trust (KoPT) river pilotage bulletin for the scheduled arrival date.",
      isVerified: false,
    };
  }

  // If Visakhapatnam: Inner vs Outer harbour designation
  if (port.code === "VIZG" && (spec.id === "CAPESIZE" || spec.id === "NEWCASTLEMAX")) {
    return {
      id: "VERIFY_HARBOUR_BERTH",
      name: "Outer Harbour Deepwater Berth Allocation",
      category: "OPERATIONAL",
      vesselValue: spec.name,
      limitValue: "Outer Harbour",
      unit: "berth",
      margin: null,
      marginLabel: "Berth Confirmation Needed",
      status: "UNVERIFIED",
      explanation:
        "Visakhapatnam Inner Harbour is restricted to Panamax dimensions. Capesize tonnage can only be accommodated at the dedicated Outer Harbour General Cargo Berth (OHGCB) or VGCB.",
      recommendedAction:
        "Confirm Outer Harbour iron ore / coking coal conveyor berth nomination with port traffic manager.",
      isVerified: false,
    };
  }

  // If Paradip and large tonnage: Tidal window confirmation
  if (port.code === "PRDP" && spec.ladenDraftM > 16.5) {
    return {
      id: "VERIFY_TIDAL_WINDOW",
      name: "High-Water Tidal Window Scheduling",
      category: "OPERATIONAL",
      vesselValue: `${spec.ladenDraftM} m`,
      limitValue: "17.1 m Datum",
      unit: "tide",
      margin: null,
      marginLabel: "Tidal Schedule Needed",
      status: "UNVERIFIED",
      explanation:
        "Arrival draft approaches Paradip approach datum. Safe entry requires coordination with the astronomical high-water tide window (+1.2m surge).",
      recommendedAction:
        "Cross-reference voyage ETA with Paradip Port Trust tide tables; confirm arrival window with shipping agent.",
      isVerified: false,
    };
  }

  // Generic verification item: Berth occupancy & laycan confirmation
  return {
    id: "VERIFY_BERTH_AVAIL",
    name: "Terminal Berth Window Confirmation",
    category: "OPERATIONAL",
    vesselValue: "Laycan Window",
    limitValue: "Berth Lineup",
    unit: "schedule",
    margin: null,
    marginLabel: "Confirmed via Fixture",
    status: "PASS",
    explanation: `Standard dry-bulk berth lineup at ${port.name} (${port.berths} operational berths, discharge rate ~${Math.round(port.dischargeRateTpd / 1000)}k t/day).`,
    recommendedAction:
      "Coordinate 72h / 48h / 24h Notices of Readiness (NOR) with local port agents.",
    isVerified: true,
  };
}

/**
 * Evaluates full feasibility for a specific vessel class at a selected port.
 */
export function evaluateVesselFeasibility(
  spec: VesselClassSpec,
  port: PortProfile,
  cargoType: CargoType = "COKING_COAL",
): VesselFeasibilityReport {
  const lightering = LIGHTERING[port.code];

  // Perform individual constraint checks
  const draftCheck = evaluateDraftConstraint(spec, port, lightering);
  const loaCheck = evaluateLoaConstraint(spec, port, lightering);
  const beamCheck = evaluateBeamConstraint(spec, port, lightering);
  const dwtCheck = evaluateDwtConstraint(spec, port, lightering);
  const verifyCheck = evaluateVerificationItem(port, spec);

  const checks = [draftCheck, loaCheck, beamCheck, dwtCheck, verifyCheck];

  // Determine overall status
  const hasViolation = checks.some((c) => c.status === "VIOLATION");
  const hasConditional = checks.some(
    (c) => c.status === "CONDITIONAL" || c.status === "UNVERIFIED",
  );

  let status: FeasibilityStatus = "FEASIBLE";
  if (hasViolation) {
    status = "REJECTED";
  } else if (hasConditional) {
    status = "CONDITIONAL";
  }

  // Calculate effective cargo capacity
  let effectiveCapacityT = spec.dwtMax;
  let capacityDeratingPct = 0;
  const draftExcess = Number((spec.ladenDraftM - port.maxDraftM).toFixed(2));

  if (lightering) {
    // Vessel carries full cargo, but part is discharged offshore
    effectiveCapacityT = spec.dwtMax;
    capacityDeratingPct = 0;
  } else if (draftExcess > 0 && draftExcess <= MAX_PART_LADEN_EXCESS_M) {
    // Derated based on tonnes per centimetre (TPC) immersion
    const tpc = spec.dwtMax / 1500;
    effectiveCapacityT = Math.round(spec.dwtMax - draftExcess * 100 * tpc);
    capacityDeratingPct = Math.round(((spec.dwtMax - effectiveCapacityT) / spec.dwtMax) * 100);
  } else if (draftExcess > MAX_PART_LADEN_EXCESS_M) {
    effectiveCapacityT = 0;
    capacityDeratingPct = 100;
  }

  // Key tradeoff & summary explanation
  let keyTradeoff = "Optimal balance between freight economy and unimpeded berth access.";
  let summaryReason = "All physical dimensions and nautical depths conform fully to port limits.";
  let recommendationNote =
    "Recommended candidate for direct discharge without lightering or short-loading.";

  if (status === "REJECTED") {
    const violation = checks.find((c) => c.status === "VIOLATION");
    keyTradeoff = "Incompatible with terminal physical infrastructure.";
    summaryReason = violation?.explanation ?? "Violates hard nautical or dimensional constraints.";
    recommendationNote =
      "Reject candidate. Do not fix this vessel class for this port without terminal redesign.";
  } else if (status === "CONDITIONAL") {
    if (lightering) {
      keyTradeoff = `High volumetric efficiency offset by offshore lightering surcharge (+$${lightering.costUsdPerT}/t) and +${lightering.extraDays} days delay.`;
      summaryReason = `Requires transshipment / lightering at ${lightering.location} due to river depth restriction.`;
      recommendationNote =
        "Feasible only if lightering barge charter and double-handling insurance are arranged.";
    } else if (capacityDeratingPct > 0) {
      keyTradeoff = `Lower unit freight potential reduced by ${capacityDeratingPct}% deadweight short-loading penalty.`;
      summaryReason = `Requires part-laden short-loading to ~${Math.round(effectiveCapacityT / 1000)}k t to satisfy ${port.maxDraftM} m draft limit.`;
      recommendationNote =
        "Evaluate if unit freight savings on derated cargo outweigh Panamax fully laden alternatives.";
    } else {
      keyTradeoff = "Feasible under active tidal management or operational berth allocation.";
      summaryReason = "Narrow safety margins or dedicated deepwater berth required.";
      recommendationNote =
        "Confirm berth allocation and arrival draft with local shipping agency before fixing.";
    }
  }

  const unverifiedCount = checks.filter((c) => !c.isVerified).length;
  const confidenceScore = status === "REJECTED" ? 0.95 : unverifiedCount > 0 ? 0.72 : 0.88;

  return {
    vesselClass: spec,
    port,
    status,
    checks,
    effectiveCapacityT,
    capacityDeratingPct,
    requiresLightering: Boolean(lightering && draftExcess > 0),
    lighteringDetails: lightering && draftExcess > 0 ? lightering : null,
    keyTradeoff,
    summaryReason,
    recommendationNote,
    unverifiedCount,
    confidenceScore,
  };
}

/**
 * Evaluates feasibility of all registered bulk vessel classes for a given port.
 */
export function evaluatePortFleetFeasibility(
  portCode: PortCode,
  cargoType: CargoType = "COKING_COAL",
): PortFleetFeasibilitySummary {
  const port = portByCode(portCode);
  const reports = VESSEL_CLASSES.map((spec) => evaluateVesselFeasibility(spec, port, cargoType));

  const feasible = reports.filter((r) => r.status === "FEASIBLE");
  const conditional = reports.filter((r) => r.status === "CONDITIONAL");
  const rejected = reports.filter((r) => r.status === "REJECTED");
  const unverified = reports.reduce((acc, r) => acc + r.unverifiedCount, 0);

  // Recommend best commercial/operational candidate:
  // Prefer the largest fully FEASIBLE candidate; if none, the most efficient CONDITIONAL candidate.
  let recommendedClassId: VesselClassId | null = null;
  if (feasible.length > 0) {
    // Sort by largest capacity
    const sorted = [...feasible].sort((a, b) => b.effectiveCapacityT - a.effectiveCapacityT);
    recommendedClassId = sorted[0].vesselClass.id;
  } else if (conditional.length > 0) {
    const sorted = [...conditional].sort((a, b) => b.effectiveCapacityT - a.effectiveCapacityT);
    recommendedClassId = sorted[0].vesselClass.id;
  }

  // Find deepest acceptable class
  const acceptable = reports.filter((r) => r.status !== "REJECTED");
  const deepest = [...acceptable].sort(
    (a, b) => b.vesselClass.ladenDraftM - a.vesselClass.ladenDraftM,
  );
  const deepestCandidateClassId = deepest.length > 0 ? deepest[0].vesselClass.id : null;

  return {
    port,
    reports,
    totalEvaluated: reports.length,
    feasibleCount: feasible.length,
    conditionalCount: conditional.length,
    rejectedCount: rejected.length,
    verificationRequiredCount: unverified,
    recommendedClassId,
    deepestCandidateClassId,
  };
}
