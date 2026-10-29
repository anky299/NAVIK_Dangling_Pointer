import { describe, expect, it } from "vitest";
import { filterAuditEvents, formatActionLabel, summarizeAuditTrail } from "./audit";
import { auditFixtures } from "@/lib/api/fixtures";
import type { AuditEvent } from "@/lib/api/types";

describe("Audit Trail Engine", () => {
  const sampleEvents: AuditEvent[] = [
    {
      id: "AU-9201",
      timestamp: "2026-10-27T14:30:00Z",
      action: "CONTRACT_STATUS_CHANGED",
      entity: "Contract",
      entityId: "NVK-VC-2610-014",
      actor: "a.menon@navik.demo",
      detail: "Status moved from DRAFT to FIXED",
      diff: [{ field: "status", previousValue: "DRAFT", newValue: "FIXED" }],
      relatedPath: "/contracts",
    },
    {
      id: "AU-9200",
      timestamp: "2026-10-27T10:15:00Z",
      action: "DECISION_OVERRIDDEN",
      entity: "Decision report",
      entityId: "DR-1048",
      actor: "r.iyer@navik.demo",
      detail: "WAIT overridden to CHARTER_NOW by desk lead",
      diff: [{ field: "decision", previousValue: "WAIT", newValue: "CHARTER_NOW" }],
      relatedPath: "/charter",
    },
    {
      id: "AU-9199",
      timestamp: "2026-10-25T08:00:00Z",
      action: "SCENARIO_RUN",
      entity: "Scenario",
      entityId: "SC-25-1.5",
      actor: "s.das@navik.demo",
      detail: "Bunker spike preset simulated",
      relatedPath: "/scenarios",
    },
  ];

  it("filters audit events by text search, action, and entity", () => {
    const byText = filterAuditEvents(sampleEvents, { search: "overridden" });
    expect(byText.length).toBe(1);
    expect(byText[0].id).toBe("AU-9200");

    const byAction = filterAuditEvents(sampleEvents, { action: "CONTRACT_STATUS_CHANGED" });
    expect(byAction.length).toBe(1);
    expect(byAction[0].entityId).toBe("NVK-VC-2610-014");

    const byEntity = filterAuditEvents(sampleEvents, { entity: "Scenario" });
    expect(byEntity.length).toBe(1);
    expect(byEntity[0].entityId).toBe("SC-25-1.5");
  });

  it("filters audit events by timeframe", () => {
    const nowMs = Date.parse("2026-10-27T18:00:00Z");
    const last24h = filterAuditEvents(sampleEvents, { timeframe: "24H" }, nowMs);
    expect(last24h.length).toBe(2);

    const all = filterAuditEvents(sampleEvents, { timeframe: "ALL" }, nowMs);
    expect(all.length).toBe(3);
  });

  it("summarizes audit trail with actor counts and governance alerts", () => {
    const nowMs = Date.parse("2026-10-27T18:00:00Z");
    const summary = summarizeAuditTrail(sampleEvents, nowMs);

    expect(summary.totalEvents).toBe(3);
    expect(summary.todayCount).toBe(2);
    expect(summary.uniqueActors).toContain("a.menon@navik.demo");
    expect(summary.uniqueActors).toContain("r.iyer@navik.demo");
    expect(summary.governanceAlertCount).toBe(2); // CONTRACT_STATUS_CHANGED + DECISION_OVERRIDDEN
  });

  it("formats human-readable action labels", () => {
    expect(formatActionLabel("CONTRACT_CREATED")).toBe("Contract Created");
    expect(formatActionLabel("DECISION_OVERRIDDEN")).toBe("Decision Overridden");
    expect(formatActionLabel("VERIFICATION_COMPLETED")).toBe("Check Verified");
    expect(formatActionLabel("SCENARIO_RUN")).toBe("Scenario Stress Test");
  });

  it("processes fixtures without throwing", () => {
    const fixtures = auditFixtures();
    expect(fixtures.length).toBeGreaterThan(10);
    const summary = summarizeAuditTrail(fixtures);
    expect(summary.totalEvents).toBe(fixtures.length);
  });
});
