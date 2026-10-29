/**
 * Command Center operational intelligence engine.
 *
 * Pure functions for aggregating maritime telemetry, port constraints,
 * cargo inflow pipelines, and risk alert priority queues.
 */
import type {
  CongestionIndicator,
  ContractRecord,
  PortCode,
  RecentDecision,
  RiskAlert,
  RiskLevel,
} from "@/lib/api/types";
import { PORTS, VESSEL_CLASSES } from "@/lib/api/reference";

export interface CongestionSummary {
  totalWaitingVessels: number;
  averageWaitDays: number;
  averageOccupancyPct: number;
  criticalPortCount: number;
  congestedPorts: PortCode[];
}

export interface InflowPipelineSummary {
  totalTonnage: number;
  totalEstimatedSpendUsd: number;
  averageRatePerTonne: number;
  commodityBreakdown: Record<string, { tonnage: number; count: number }>;
  vesselClassDistribution: Record<string, number>;
  activeFixturesCount: number;
}

export interface PortOperationalDetail {
  code: PortCode;
  name: string;
  state: string;
  maxDraftM: number;
  waitingVessels: number;
  avgWaitDays: number;
  berthOccupancyPct: number;
  status: "NORMAL" | "MODERATE" | "CONGESTED" | "CRITICAL";
  draftRisk: boolean;
  supportedClasses: string[];
}

/**
 * Computes aggregate congestion telemetry across all discharge ports.
 */
export function summarizeCongestion(indicators: CongestionIndicator[]): CongestionSummary {
  if (!indicators || indicators.length === 0) {
    return {
      totalWaitingVessels: 0,
      averageWaitDays: 0,
      averageOccupancyPct: 0,
      criticalPortCount: 0,
      congestedPorts: [],
    };
  }

  let totalWaitVessels = 0;
  let totalWaitDays = 0;
  let totalOccupancy = 0;
  const congestedPorts: PortCode[] = [];

  for (const ind of indicators) {
    totalWaitVessels += ind.waitingVessels;
    totalWaitDays += ind.avgWaitDays;
    totalOccupancy += ind.berthOccupancyPct;

    if (ind.avgWaitDays >= 2.5 || ind.berthOccupancyPct >= 85) {
      congestedPorts.push(ind.port);
    }
  }

  return {
    totalWaitingVessels: totalWaitVessels,
    averageWaitDays: Number((totalWaitDays / indicators.length).toFixed(1)),
    averageOccupancyPct: Math.round(totalOccupancy / indicators.length),
    criticalPortCount: congestedPorts.length,
    congestedPorts,
  };
}

/**
 * Computes cargo inflow pipeline metrics combining recent charter decisions
 * and active voyage/COA contract commitments.
 */
export function summarizeInflowPipeline(
  decisions: RecentDecision[],
  contracts: ContractRecord[],
): InflowPipelineSummary {
  let totalTonnage = 0;
  let weightedSpendUsd = 0;
  const commodityBreakdown: Record<string, { tonnage: number; count: number }> = {};
  const vesselClassDistribution: Record<string, number> = {};

  // Aggregate decisions
  for (const d of decisions) {
    totalTonnage += d.cargoTonnes;
    weightedSpendUsd += d.cargoTonnes * d.rateUsdPerT;

    const comm = d.cargoType;
    if (!commodityBreakdown[comm]) {
      commodityBreakdown[comm] = { tonnage: 0, count: 0 };
    }
    commodityBreakdown[comm].tonnage += d.cargoTonnes;
    commodityBreakdown[comm].count += 1;

    const vc = d.vesselClass;
    vesselClassDistribution[vc] = (vesselClassDistribution[vc] || 0) + 1;
  }

  // Count active fixed/under-review contracts
  const activeContracts = contracts.filter(
    (c) => c.status === "FIXED" || c.status === "UNDER_REVIEW",
  );

  const averageRate = totalTonnage > 0 ? Number((weightedSpendUsd / totalTonnage).toFixed(2)) : 0;

  return {
    totalTonnage,
    totalEstimatedSpendUsd: Math.round(weightedSpendUsd),
    averageRatePerTonne: averageRate,
    commodityBreakdown,
    vesselClassDistribution,
    activeFixturesCount: activeContracts.length,
  };
}

/**
 * Derives comprehensive operational status for a discharge terminal.
 */
export function getPortOperationalDetail(
  portCode: PortCode,
  indicators: CongestionIndicator[],
): PortOperationalDetail {
  const portDef = PORTS.find((p) => p.code === portCode) || PORTS[0];
  const ind = indicators.find((i) => i.port === portCode) || {
    port: portCode,
    waitingVessels: 4,
    avgWaitDays: 1.8,
    berthOccupancyPct: 70,
    trend: "flat" as const,
  };

  let status: PortOperationalDetail["status"] = "NORMAL";
  if (ind.avgWaitDays >= 3.0 || ind.berthOccupancyPct >= 90) {
    status = "CRITICAL";
  } else if (ind.avgWaitDays >= 2.2 || ind.berthOccupancyPct >= 80) {
    status = "CONGESTED";
  } else if (ind.avgWaitDays >= 1.5 || ind.berthOccupancyPct >= 70) {
    status = "MODERATE";
  }

  // Find vessel classes compatible with this port's draft
  const compatible = VESSEL_CLASSES.filter((vc) => vc.maxDraftM <= portDef.maxDraftM).map(
    (vc) => vc.name,
  );

  // Draft risk is high if Capesize/Newcastlemax cannot enter fully laden
  const draftRisk = portDef.maxDraftM < 17.5;

  return {
    code: portDef.code,
    name: portDef.name,
    state: portDef.state,
    maxDraftM: portDef.maxDraftM,
    waitingVessels: ind.waitingVessels,
    avgWaitDays: ind.avgWaitDays,
    berthOccupancyPct: ind.berthOccupancyPct,
    status,
    draftRisk,
    supportedClasses: compatible,
  };
}

/**
 * Filter and sort risk alerts by severity and search term.
 */
export function filterRiskAlerts(
  alerts: RiskAlert[],
  severityFilter: "ALL" | RiskLevel,
  searchTerm: string = "",
): RiskAlert[] {
  const severityOrder: Record<RiskLevel, number> = {
    HIGH: 4,
    ELEVATED: 3,
    MODERATE: 2,
    LOW: 1,
  };

  const term = searchTerm.toLowerCase().trim();

  return alerts
    .filter((alert) => {
      if (severityFilter !== "ALL" && alert.severity !== severityFilter) {
        return false;
      }
      if (term) {
        return (
          alert.title.toLowerCase().includes(term) ||
          alert.detail.toLowerCase().includes(term) ||
          alert.region.toLowerCase().includes(term)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const diff = severityOrder[b.severity] - severityOrder[a.severity];
      if (diff !== 0) return diff;
      return Date.parse(b.issuedAt) - Date.parse(a.issuedAt);
    });
}
