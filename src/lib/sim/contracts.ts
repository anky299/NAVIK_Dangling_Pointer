/**
 * NAVIK Contracts & Commercial Risk Intelligence Engine.
 *
 * Provides pure, deterministic functions for managing the freight contract register,
 * computing commercial portfolio summaries, detecting laycan overlaps,
 * evaluating deadline schedules, and tracking outstanding nautical/commercial checks.
 *
 * Grounded in NAVIK's existing reference data, port constraints, and market heuristics.
 */
import {
  CARGO_LABELS,
  CONTRACT_LABELS,
  ORIGINS,
  PORTS,
  VESSEL_CLASSES,
  originById,
  portByCode,
  vesselById,
} from "@/lib/api/reference";
import type {
  CargoType,
  ContractDeadline,
  ContractRecord,
  ContractStatus,
  ContractType,
  NewContract,
  OutstandingCheck,
  PortCode,
  VerificationStatus,
} from "@/lib/api/types";
import { DEFAULT_MARKET } from "./charter";
import { fmtDate, fmtInt, fmtRate, fmtTonnes, fmtUsd } from "@/lib/format";

/* ═══════════════════════════════════════════════
   Types & Interfaces
   ═══════════════════════════════════════════════ */

export interface ContractFilters {
  search?: string;
  status?: ContractStatus | "ALL";
  type?: ContractType | "ALL";
  verification?: VerificationStatus | "ALL";
  destination?: PortCode | "ALL";
  commodity?: CargoType | "ALL";
  sortKey?: "laycanStart" | "tonnage" | "rateUsdPerT" | "reference" | "createdAt";
  sortDir?: "asc" | "desc";
}

export interface CommercialSummary {
  totalTonnage: number;
  totalSpendUsd: number;
  weightedRateUsdPerT: number;
  activeFixturesCount: number;
  completedCount: number;
  draftCount: number;
  unverifiedCount: number;
  averageLaycanDays: number;
  commodityShares: {
    commodity: CargoType;
    label: string;
    tonnage: number;
    spendUsd: number;
    sharePct: number;
  }[];
  typeDistribution: Record<ContractType, number>;
}

export interface LaycanConflict {
  id: string;
  portCode: PortCode;
  portName: string;
  overlapStart: string;
  overlapEnd: string;
  overlapDays: number;
  contractA: ContractRecord;
  contractB: ContractRecord;
  combinedTonnage: number;
  severity: "HIGH" | "MODERATE";
  explanation: string;
  suggestedAction: string;
}

export type CommercialRiskCategory =
  "DEADLINE" | "VERIFICATION" | "LAYCAN_CONFLICT" | "RATE_VARIANCE" | "NAUTICAL_CHECK";

export interface CommercialRiskItem {
  id: string;
  category: CommercialRiskCategory;
  severity: "HIGH" | "ELEVATED" | "MODERATE" | "LOW";
  contractReference: string;
  contractId: string;
  vesselName: string;
  portName: string;
  title: string;
  detail: string;
  daysRemaining?: number;
  actionLabel: string;
  actionPath: string;
}

/* ═══════════════════════════════════════════════
   Contract Search & Filtering
   ═══════════════════════════════════════════════ */

export function filterContracts(
  contracts: ContractRecord[],
  filters: ContractFilters,
): ContractRecord[] {
  let result = [...contracts];

  // Search filter
  if (filters.search && filters.search.trim() !== "") {
    const q = filters.search.trim().toLowerCase();
    result = result.filter((c) => {
      const originName = originById(c.origin)?.shortName.toLowerCase() ?? "";
      const portName = portByCode(c.destination)?.name.toLowerCase() ?? "";
      const comm = c.commodity ? CARGO_LABELS[c.commodity]?.toLowerCase() : "";
      return (
        c.reference.toLowerCase().includes(q) ||
        c.counterparty.toLowerCase().includes(q) ||
        c.vesselName.toLowerCase().includes(q) ||
        c.vesselClass.toLowerCase().includes(q) ||
        c.origin.toLowerCase().includes(q) ||
        c.destination.toLowerCase().includes(q) ||
        originName.includes(q) ||
        portName.includes(q) ||
        comm?.includes(q) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    });
  }

  // Status filter
  if (filters.status && filters.status !== "ALL") {
    result = result.filter((c) => c.status === filters.status);
  }

  // Type filter
  if (filters.type && filters.type !== "ALL") {
    result = result.filter((c) => c.type === filters.type);
  }

  // Verification filter
  if (filters.verification && filters.verification !== "ALL") {
    result = result.filter((c) => (c.verificationStatus ?? "UNVERIFIED") === filters.verification);
  }

  // Destination filter
  if (filters.destination && filters.destination !== "ALL") {
    result = result.filter((c) => c.destination === filters.destination);
  }

  // Commodity filter
  if (filters.commodity && filters.commodity !== "ALL") {
    result = result.filter((c) => (c.commodity ?? "COKING_COAL") === filters.commodity);
  }

  // Sorting
  const key = filters.sortKey ?? "laycanStart";
  const dir = filters.sortDir ?? "asc";
  const mul = dir === "asc" ? 1 : -1;

  result.sort((a, b) => {
    if (key === "laycanStart") {
      return (Date.parse(a.laycanStart) - Date.parse(b.laycanStart)) * mul;
    }
    if (key === "tonnage") {
      return (a.tonnage - b.tonnage) * mul;
    }
    if (key === "rateUsdPerT") {
      return (a.rateUsdPerT - b.rateUsdPerT) * mul;
    }
    if (key === "reference") {
      return a.reference.localeCompare(b.reference) * mul;
    }
    if (key === "createdAt") {
      return (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * mul;
    }
    return 0;
  });

  return result;
}

/* ═══════════════════════════════════════════════
   Portfolio Summary
   ═══════════════════════════════════════════════ */

export function summarizeCommercialPortfolio(contracts: ContractRecord[]): CommercialSummary {
  let totalTonnage = 0;
  let totalSpendUsd = 0;
  let activeFixturesCount = 0;
  let completedCount = 0;
  let draftCount = 0;
  let unverifiedCount = 0;
  let totalLaycanDays = 0;

  const typeDistribution: Record<ContractType, number> = {
    VOYAGE: 0,
    TIME_CHARTER: 0,
    COA: 0,
  };

  const commMap = new Map<CargoType, { tonnage: number; spendUsd: number }>();

  for (const c of contracts) {
    totalTonnage += c.tonnage;
    const spend = c.tonnage * c.rateUsdPerT;
    totalSpendUsd += spend;

    if (c.status === "FIXED" || c.status === "UNDER_REVIEW") {
      activeFixturesCount++;
    } else if (c.status === "COMPLETED") {
      completedCount++;
    } else if (c.status === "DRAFT") {
      draftCount++;
    }

    if (c.verificationStatus === "UNVERIFIED" || !c.verificationStatus) {
      unverifiedCount++;
    }

    typeDistribution[c.type] = (typeDistribution[c.type] || 0) + 1;

    // Laycan duration
    const startMs = Date.parse(c.laycanStart);
    const endMs = Date.parse(c.laycanEnd);
    if (!isNaN(startMs) && !isNaN(endMs)) {
      totalLaycanDays += Math.max(1, Math.round((endMs - startMs) / 86_400_000));
    }

    const comm = c.commodity ?? "COKING_COAL";
    const existing = commMap.get(comm) ?? { tonnage: 0, spendUsd: 0 };
    commMap.set(comm, {
      tonnage: existing.tonnage + c.tonnage,
      spendUsd: existing.spendUsd + spend,
    });
  }

  const weightedRateUsdPerT =
    totalTonnage > 0 ? Number((totalSpendUsd / totalTonnage).toFixed(2)) : 0;
  const averageLaycanDays =
    contracts.length > 0 ? Number((totalLaycanDays / contracts.length).toFixed(1)) : 0;

  const commodityShares = Array.from(commMap.entries()).map(([comm, val]) => ({
    commodity: comm,
    label: CARGO_LABELS[comm] ?? comm,
    tonnage: val.tonnage,
    spendUsd: val.spendUsd,
    sharePct: totalTonnage > 0 ? Number(((val.tonnage / totalTonnage) * 100).toFixed(1)) : 0,
  }));

  return {
    totalTonnage,
    totalSpendUsd,
    weightedRateUsdPerT,
    activeFixturesCount,
    completedCount,
    draftCount,
    unverifiedCount,
    averageLaycanDays,
    commodityShares,
    typeDistribution,
  };
}

/* ═══════════════════════════════════════════════
   Laycan Conflict Detection Engine
   ═══════════════════════════════════════════════ */

/**
 * Checks for overlapping laycan windows at the same discharge port.
 */
export function detectLaycanConflicts(contracts: ContractRecord[]): LaycanConflict[] {
  const active = contracts.filter((c) => c.status === "FIXED" || c.status === "UNDER_REVIEW");
  const conflicts: LaycanConflict[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];

      // Must be same destination port
      if (a.destination !== b.destination) continue;

      const aStart = Date.parse(a.laycanStart);
      const aEnd = Date.parse(a.laycanEnd);
      const bStart = Date.parse(b.laycanStart);
      const bEnd = Date.parse(b.laycanEnd);

      if (isNaN(aStart) || isNaN(aEnd) || isNaN(bStart) || isNaN(bEnd)) continue;

      // Overlap condition: max(start) <= min(end)
      const overlapStartMs = Math.max(aStart, bStart);
      const overlapEndMs = Math.min(aEnd, bEnd);

      if (overlapStartMs <= overlapEndMs) {
        const overlapDays = Math.round((overlapEndMs - overlapStartMs) / 86_400_000) + 1;
        const port = portByCode(a.destination);
        const combinedTonnage = a.tonnage + b.tonnage;
        const dischargeDaysNeeded = combinedTonnage / port.dischargeRateTpd;
        const severity: "HIGH" | "MODERATE" =
          dischargeDaysNeeded > port.berths * 2 || combinedTonnage > 220_000 ? "HIGH" : "MODERATE";

        const startIso = new Date(overlapStartMs).toISOString().slice(0, 10);
        const endIso = new Date(overlapEndMs).toISOString().slice(0, 10);

        conflicts.push({
          id: `LC-${a.reference}-${b.reference}`,
          portCode: a.destination,
          portName: port.name,
          overlapStart: startIso,
          overlapEnd: endIso,
          overlapDays,
          contractA: a,
          contractB: b,
          combinedTonnage,
          severity,
          explanation: `${a.vesselName} (${fmtTonnes(a.tonnage)}) and ${b.vesselName} (${fmtTonnes(b.tonnage)}) share overlapping laycan windows at ${port.name} (${fmtDate(startIso)}–${fmtDate(endIso)}). Combined volume of ${fmtTonnes(combinedTonnage)} exceeds normal 2-berth intake, risking anchorage delays.`,
          suggestedAction: `Sequence arrivals with at least 3 days buffer or stagger laycan for ${a.tonnage < b.tonnage ? a.reference : b.reference}.`,
        });
      }
    }
  }

  return conflicts;
}

/* ═══════════════════════════════════════════════
   Commercial Risk & Outstanding Checks Engine
   ═══════════════════════════════════════════════ */

export function detectCommercialRisks(
  contracts: ContractRecord[],
  referenceDate = "2026-10-27",
): CommercialRiskItem[] {
  const refMs = Date.parse(referenceDate);
  const risks: CommercialRiskItem[] = [];

  // 1. Imminent Deadlines
  for (const c of contracts) {
    if (c.status === "COMPLETED") continue;
    const port = portByCode(c.destination);

    if (c.deadlines) {
      for (const dl of c.deadlines) {
        if (dl.isCompleted) continue;
        const dueMs = Date.parse(dl.dueDate);
        if (isNaN(dueMs)) continue;

        const diffDays = Math.ceil((dueMs - refMs) / 86_400_000);

        if (diffDays <= 14) {
          const isOverdue = diffDays < 0;
          const severity = isOverdue ? "HIGH" : diffDays <= 5 ? "ELEVATED" : "MODERATE";
          risks.push({
            id: `RSK-DL-${dl.id}`,
            category: "DEADLINE",
            severity,
            contractReference: c.reference,
            contractId: c.id,
            vesselName: c.vesselName,
            portName: port.name,
            title: isOverdue ? `Overdue Deadline: ${dl.label}` : `Imminent Deadline: ${dl.label}`,
            detail: `${dl.label} for ${c.reference} (${c.vesselName}) is due ${fmtDate(dl.dueDate)} (${isOverdue ? `${Math.abs(diffDays)}d overdue` : `in ${diffDays} day(s)`}). Category: ${dl.category}.`,
            daysRemaining: diffDays,
            actionLabel: "Inspect Contract",
            actionPath: `/contracts?highlight=${c.reference}`,
          });
        }
      }
    }

    // 2. Unverified Terms
    if (c.verificationStatus === "UNVERIFIED") {
      risks.push({
        id: `RSK-VER-${c.id}`,
        category: "VERIFICATION",
        severity: "MODERATE",
        contractReference: c.reference,
        contractId: c.id,
        vesselName: c.vesselName,
        portName: port.name,
        title: `Unverified Commercial Terms (${c.reference})`,
        detail: `Contract is marked unverified. Counterparty credit, demurrage escalation, and laytime definitions require desk lead verification.`,
        actionLabel: "Review Terms",
        actionPath: `/contracts?highlight=${c.reference}`,
      });
    }

    // 3. Outstanding Checks (Nautical / Vessel / Commercial)
    if (c.outstandingChecks) {
      for (const chk of c.outstandingChecks) {
        if (chk.status === "PENDING" || chk.status === "FAILED") {
          const isFailed = chk.status === "FAILED";
          risks.push({
            id: `RSK-CHK-${chk.id}`,
            category: chk.category === "PORT_NAUTICAL" ? "NAUTICAL_CHECK" : "VERIFICATION",
            severity: isFailed ? "HIGH" : "MODERATE",
            contractReference: c.reference,
            contractId: c.id,
            vesselName: c.vesselName,
            portName: port.name,
            title: `${chk.status}: ${chk.label}`,
            detail:
              chk.detail ??
              `Outstanding ${chk.category.toLowerCase().replace(/_/g, " ")} check for ${c.vesselName} to ${port.name}.`,
            actionLabel: "Verify Check",
            actionPath: `/contracts?highlight=${c.reference}`,
          });
        }
      }
    }

    // 4. Rate Variance vs Simulated Baseline
    const defaultMkt = DEFAULT_MARKET[c.origin];
    if (defaultMkt) {
      const baseFreightEst = defaultMkt.multiplier * 12.5; // proxy
      const variancePct = ((c.rateUsdPerT - baseFreightEst) / baseFreightEst) * 100;
      if (Math.abs(variancePct) > 18 && c.status !== "COMPLETED") {
        risks.push({
          id: `RSK-VAR-${c.id}`,
          category: "RATE_VARIANCE",
          severity: variancePct > 25 ? "ELEVATED" : "MODERATE",
          contractReference: c.reference,
          contractId: c.id,
          vesselName: c.vesselName,
          portName: port.name,
          title: `Material Rate Variance: ${fmtRate(c.rateUsdPerT)}/t (${variancePct > 0 ? "+" : ""}${variancePct.toFixed(1)}%)`,
          detail: `Contract fixture rate differs by ${Math.abs(variancePct).toFixed(1)}% from benchmark simulated market rate ($${baseFreightEst.toFixed(2)}/t). Check bunker escalation adjustments.`,
          actionLabel: "Compare Market",
          actionPath: `/market`,
        });
      }
    }
  }

  // 5. Laycan Conflicts
  const conflicts = detectLaycanConflicts(contracts);
  for (const cf of conflicts) {
    risks.push({
      id: `RSK-CF-${cf.id}`,
      category: "LAYCAN_CONFLICT",
      severity: cf.severity,
      contractReference: `${cf.contractA.reference} & ${cf.contractB.reference}`,
      contractId: cf.contractA.id,
      vesselName: `${cf.contractA.vesselName} / ${cf.contractB.vesselName}`,
      portName: cf.portName,
      title: `Laycan Window Overlap at ${cf.portName} (${cf.overlapDays}d)`,
      detail: cf.explanation,
      actionLabel: "Review Conflict",
      actionPath: `/contracts?highlight=${cf.contractA.reference}`,
    });
  }

  // Sort: HIGH first, then ELEVATED, then MODERATE, then LOW
  const order = { HIGH: 0, ELEVATED: 1, MODERATE: 2, LOW: 3 };
  risks.sort((a, b) => order[a.severity] - order[b.severity]);

  return risks;
}

/* ═══════════════════════════════════════════════
   Validation for New Contract Form
   ═══════════════════════════════════════════════ */

export interface ContractFormValidation {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateContractInput(input: Partial<NewContract>): ContractFormValidation {
  const errors: Record<string, string> = {};

  if (!input.counterparty || input.counterparty.trim().length < 2) {
    errors.counterparty = "Counterparty legal entity is required";
  }

  if (!input.vesselName || input.vesselName.trim().length < 2) {
    errors.vesselName = "Vessel name or nomination clause is required";
  }

  if (!input.vesselClass) {
    errors.vesselClass = "Vessel class specification is required";
  }

  if (!input.origin) {
    errors.origin = "Origin loading region is required";
  }

  if (!input.destination) {
    errors.destination = "Discharge port is required";
  }

  if (typeof input.tonnage !== "number" || input.tonnage <= 0 || isNaN(input.tonnage)) {
    errors.tonnage = "Cargo tonnage must be greater than 0";
  } else if (input.tonnage < 10_000 || input.tonnage > 400_000) {
    errors.tonnage = "Tonnage must be between 10,000 t and 400,000 t";
  }

  if (typeof input.rateUsdPerT !== "number" || input.rateUsdPerT <= 0 || isNaN(input.rateUsdPerT)) {
    errors.rateUsdPerT = "Freight rate must be a positive USD amount";
  }

  if (!input.laycanStart) {
    errors.laycanStart = "Laycan start date is required";
  }

  if (!input.laycanEnd) {
    errors.laycanEnd = "Laycan end date is required";
  }

  if (input.laycanStart && input.laycanEnd) {
    if (Date.parse(input.laycanEnd) < Date.parse(input.laycanStart)) {
      errors.laycanEnd = "Laycan end date cannot precede laycan start date";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function formatLaycanRange(start: string, end: string): string {
  try {
    const s = fmtDate(start);
    const e = fmtDate(end);
    return `${s} — ${e}`;
  } catch {
    return `${start} — ${end}`;
  }
}
