/**
 * NAVIK Audit Trail Intelligence Engine.
 *
 * Pure functions for filtering, grouping, diff inspecting, and summarizing
 * decision-support and commercial audit records.
 *
 * Transparent disclosure: records reflect the active session log and browser storage,
 * not a permanent immutable blockchain/enterprise ledger.
 */
import type { AuditAction, AuditDiff, AuditEvent } from "@/lib/api/types";

export interface AuditFilters {
  search?: string;
  action?: AuditAction | "ALL";
  entity?: string | "ALL";
  actor?: string | "ALL";
  timeframe?: "ALL" | "24H" | "7D" | "30D";
}

export interface AuditSummary {
  totalEvents: number;
  todayCount: number;
  actionBreakdown: Record<string, number>;
  entityBreakdown: Record<string, number>;
  uniqueActors: string[];
  governanceAlertCount: number; // e.g. overrides, term updates
}

export function filterAuditEvents(
  events: AuditEvent[],
  filters: AuditFilters,
  nowMs = Date.parse("2026-10-27T18:00:00Z"),
): AuditEvent[] {
  let result = [...events];

  // Search filter
  if (filters.search && filters.search.trim() !== "") {
    const q = filters.search.trim().toLowerCase();
    result = result.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.entity.toLowerCase().includes(q) ||
        e.entityId.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        (e.diff &&
          e.diff.some(
            (d) =>
              d.field.toLowerCase().includes(q) || String(d.newValue).toLowerCase().includes(q),
          )),
    );
  }

  // Action filter
  if (filters.action && filters.action !== "ALL") {
    result = result.filter((e) => e.action === filters.action);
  }

  // Entity filter
  if (filters.entity && filters.entity !== "ALL") {
    result = result.filter((e) => e.entity.toLowerCase() === filters.entity!.toLowerCase());
  }

  // Actor filter
  if (filters.actor && filters.actor !== "ALL") {
    result = result.filter((e) => e.actor.toLowerCase().includes(filters.actor!.toLowerCase()));
  }

  // Timeframe filter
  if (filters.timeframe && filters.timeframe !== "ALL") {
    const maxAgeMs =
      filters.timeframe === "24H"
        ? 86_400_000
        : filters.timeframe === "7D"
          ? 7 * 86_400_000
          : 30 * 86_400_000;

    result = result.filter((e) => {
      const t = Date.parse(e.timestamp);
      return !isNaN(t) && nowMs - t <= maxAgeMs;
    });
  }

  // Always newest first
  result.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  return result;
}

export function summarizeAuditTrail(
  events: AuditEvent[],
  nowMs = Date.parse("2026-10-27T18:00:00Z"),
): AuditSummary {
  const actionBreakdown: Record<string, number> = {};
  const entityBreakdown: Record<string, number> = {};
  const actorSet = new Set<string>();
  let todayCount = 0;
  let governanceAlertCount = 0;

  for (const e of events) {
    actionBreakdown[e.action] = (actionBreakdown[e.action] || 0) + 1;
    entityBreakdown[e.entity] = (entityBreakdown[e.entity] || 0) + 1;
    actorSet.add(e.actor);

    const t = Date.parse(e.timestamp);
    if (!isNaN(t) && nowMs - t <= 86_400_000) {
      todayCount++;
    }

    if (
      e.action === "DECISION_OVERRIDDEN" ||
      e.action === "CONTRACT_STATUS_CHANGED" ||
      e.action === "SETTINGS_CHANGED"
    ) {
      governanceAlertCount++;
    }
  }

  return {
    totalEvents: events.length,
    todayCount,
    actionBreakdown,
    entityBreakdown,
    uniqueActors: Array.from(actorSet),
    governanceAlertCount,
  };
}

export function formatActionLabel(action: AuditAction): string {
  switch (action) {
    case "ANALYSIS_RUN":
      return "Analysis Executed";
    case "SCENARIO_RUN":
      return "Scenario Stress Test";
    case "CONTRACT_CREATED":
      return "Contract Created";
    case "CONTRACT_UPDATED":
      return "Terms Updated";
    case "CONTRACT_STATUS_CHANGED":
      return "Status Transition";
    case "DECISION_APPROVED":
      return "Decision Approved";
    case "DECISION_OVERRIDDEN":
      return "Decision Overridden";
    case "DATA_REFRESH":
      return "Market Data Refresh";
    case "SETTINGS_CHANGED":
      return "Parameter Changed";
    case "VERIFICATION_COMPLETED":
      return "Check Verified";
    case "PORTFOLIO_RUN":
      return "Portfolio Optimization";
    default:
      return String(action).replace(/_/g, " ");
  }
}
