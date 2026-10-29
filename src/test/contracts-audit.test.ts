import { beforeEach, describe, expect, it } from "vitest";
import {
  createContract,
  getContract,
  listAuditEvents,
  listContracts,
  resetAuditStore,
  resetContractStore,
  updateContract,
  verifyContractCheck,
} from "@/lib/api/services";
import {
  detectCommercialRisks,
  detectLaycanConflicts,
  filterContracts,
  formatLaycanRange,
  summarizeCommercialPortfolio,
  validateContractInput,
} from "@/lib/sim/contracts";
import { filterAuditEvents, summarizeAuditTrail } from "@/lib/sim/audit";
import type { NewContract } from "@/lib/api/types";

describe("Milestone 9: Contracts & Audit Integration", () => {
  beforeEach(() => {
    resetContractStore();
    resetAuditStore();
  });

  describe("Contract Store Lifecycle & State Transitions", () => {
    it("lists default contract fixtures", async () => {
      const contracts = await listContracts();
      expect(contracts.length).toBeGreaterThanOrEqual(6);
      expect(contracts.some((c) => c.reference === "NVK-VC-2610-014")).toBe(true);
    });

    it("creates a new voyage contract and records audit entry with diff", async () => {
      const initialAudits = await listAuditEvents();
      const initialCount = initialAudits.length;

      const newContractInput: NewContract = {
        counterparty: "Bengal Bulk Logistics",
        vesselName: "MV Kalinga Pioneer",
        vesselClass: "CAPESIZE",
        type: "VOYAGE",
        origin: "AUS_QLD",
        destination: "PRDP",
        tonnage: 170_000,
        rateUsdPerT: 16.25,
        laycanStart: "2026-12-01",
        laycanEnd: "2026-12-08",
        status: "DRAFT",
        verificationStatus: "UNVERIFIED",
        isIllustrative: true,
      };

      const created = await createContract(newContractInput);
      expect(created.id).toBeDefined();
      expect(created.reference).toMatch(/^NVK-VC-2610-\d{3}$/);
      expect(created.status).toBe("DRAFT");

      // Verify persistence in store
      const all = await listContracts();
      expect(all.some((c) => c.reference === created.reference)).toBe(true);

      // Verify audit event creation
      const updatedAudits = await listAuditEvents();
      expect(updatedAudits.length).toBe(initialCount + 1);

      const latestAudit = updatedAudits[0];
      expect(latestAudit.action).toBe("CONTRACT_CREATED");
      expect(latestAudit.entityId).toBe(created.reference);
      expect(latestAudit.diff).toBeDefined();
      expect(latestAudit.diff?.some((d) => d.field === "tonnage" && d.newValue === 170_000)).toBe(
        true,
      );
    });

    it("updates contract status and records previous/new value audit diff", async () => {
      const initial = await listContracts();
      const draft = initial.find((c) => c.status === "DRAFT")!;
      expect(draft).toBeDefined();

      const updated = await updateContract(draft.id, {
        status: "UNDER_REVIEW",
        rateUsdPerT: 10.2,
      });

      expect(updated.status).toBe("UNDER_REVIEW");
      expect(updated.rateUsdPerT).toBe(10.2);

      // Check audit event
      const audits = await listAuditEvents();
      const statusEvent = audits[0];
      expect(statusEvent.action).toBe("CONTRACT_STATUS_CHANGED");
      expect(statusEvent.entityId).toBe(draft.reference);

      // Verify diff
      expect(statusEvent.diff).toBeDefined();
      const statusDiff = statusEvent.diff?.find((d) => d.field === "status");
      expect(statusDiff?.previousValue).toBe("DRAFT");
      expect(statusDiff?.newValue).toBe("UNDER_REVIEW");

      const rateDiff = statusEvent.diff?.find((d) => d.field === "rateUsdPerT");
      expect(rateDiff?.previousValue).toBe(draft.rateUsdPerT);
      expect(rateDiff?.newValue).toBe(10.2);
    });

    it("marks an outstanding check as verified and updates contract verification status", async () => {
      const contracts = await listContracts();
      const underReview = contracts.find((c) => c.reference === "NVK-TC-2610-011")!;
      expect(underReview.outstandingChecks?.length).toBeGreaterThan(0);

      const checkId = underReview.outstandingChecks![0].id;
      const updated = await verifyContractCheck(underReview.id, checkId);

      const verifiedCheck = updated.outstandingChecks?.find((chk) => chk.id === checkId);
      expect(verifiedCheck?.status).toBe("PASSED");
      expect(updated.verificationStatus).toBe("VERIFIED");

      // Check audit event
      const audits = await listAuditEvents();
      const audit = audits[0];
      expect(audit.action).toBe("VERIFICATION_COMPLETED");
      expect(audit.entityId).toBe(underReview.reference);
      expect(audit.diff?.some((d) => d.newValue === "PASSED")).toBe(true);
    });
  });

  describe("Commercial Risk & Laycan Logic Integration", () => {
    it("computes commercial summary metrics accurately", async () => {
      const contracts = await listContracts();
      const summary = summarizeCommercialPortfolio(contracts);

      expect(summary.totalTonnage).toBeGreaterThan(1_000_000);
      expect(summary.totalSpendUsd).toBeGreaterThan(10_000_000);
      expect(summary.weightedRateUsdPerT).toBeGreaterThan(0);
      expect(summary.activeFixturesCount).toBeGreaterThan(0);
      expect(summary.commodityShares.length).toBeGreaterThanOrEqual(3);
    });

    it("identifies Paradip laycan conflict between Kalinga Star and Brahmaputra Leader", async () => {
      const contracts = await listContracts();
      const conflicts = detectLaycanConflicts(contracts);

      expect(conflicts.length).toBeGreaterThanOrEqual(1);
      const prdp = conflicts.find((c) => c.portCode === "PRDP");
      expect(prdp).toBeDefined();
      expect(prdp?.portName).toBe("Paradip");
      expect(prdp?.overlapDays).toBe(3);
      expect(prdp?.combinedTonnage).toBeGreaterThan(200_000);
      expect(prdp?.severity).toBe("HIGH");
      expect(prdp?.explanation).toContain("MV Kalinga Star");
      expect(prdp?.explanation).toContain("MV Brahmaputra Leader");
    });

    it("derives commercial risks without fabricating missing scores", async () => {
      const contracts = await listContracts();
      const risks = detectCommercialRisks(contracts, "2026-10-27");

      expect(risks.length).toBeGreaterThan(0);

      // Verify that every risk item has a legitimate category and action link
      for (const r of risks) {
        expect([
          "DEADLINE",
          "VERIFICATION",
          "LAYCAN_CONFLICT",
          "RATE_VARIANCE",
          "NAUTICAL_CHECK",
        ]).toContain(r.category);
        expect(r.actionPath).toMatch(/^\/(contracts|market)/);
        expect(r.title).toBeDefined();
        expect(r.detail).toBeDefined();
      }
    });

    it("enforces validation on new contract inputs", () => {
      const badInput = {
        counterparty: "",
        tonnage: -100,
        rateUsdPerT: 0,
        laycanStart: "2026-11-20",
        laycanEnd: "2026-11-15",
      };

      const val = validateContractInput(badInput);
      expect(val.isValid).toBe(false);
      expect(val.errors.counterparty).toBeDefined();
      expect(val.errors.tonnage).toBeDefined();
      expect(val.errors.rateUsdPerT).toBeDefined();
      expect(val.errors.laycanEnd).toBeDefined();
    });
  });

  describe("Audit Trail Querying & Governance Metrics", () => {
    it("filters audit records by timeframe and action", async () => {
      const audits = await listAuditEvents();
      const summary = summarizeAuditTrail(audits, Date.parse("2026-10-27T18:00:00Z"));

      expect(summary.totalEvents).toBe(audits.length);
      expect(summary.uniqueActors.length).toBeGreaterThanOrEqual(1);

      const scenarioEvents = filterAuditEvents(audits, { action: "SCENARIO_RUN" });
      expect(scenarioEvents.every((e) => e.action === "SCENARIO_RUN")).toBe(true);
    });
  });
});
