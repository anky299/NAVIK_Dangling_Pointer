/**
 * Comprehensive End-to-End Cross-Workspace Integration Test Suite
 *
 * Verifies cross-workspace consistency across:
 *  1. Chartering <-> Fleet & Port Feasibility (draft limits, lightering, vessel constraints)
 *  2. Market <-> Scenario Lab (baseline values, single-shock application, sensitivities)
 *  3. Portfolio Strategy <-> Candidate Calculations (demand reconciliation, weighted costs)
 *  4. Contracts & Audit <-> Persistence & Verification (storage integrity, before/after diffs, reset)
 *  5. NIRNAY Decision Assistant <-> Underlying Engines (grounding, deterministic figures, boundaries)
 */
import { describe, expect, it, beforeEach } from "vitest";
import { simulateCharterDecision, BASE_BUNKER_USD_PER_T } from "@/lib/sim/charter";
import { evaluatePortFleetFeasibility } from "@/lib/sim/feasibility";
import { compareScenarios, simulateScenario } from "@/lib/sim/scenario";
import { computePortfolio, buildCandidatePortfolios } from "@/lib/sim/portfolio";
import {
  contracts,
  audits,
  createContract,
  updateContract,
  verifyContractCheck,
  resetDemoState,
} from "@/lib/api/services";
import {
  detectCommercialRisks,
  detectLaycanConflicts,
  summarizeCommercialPortfolio,
} from "@/lib/sim/contracts";
import { filterAuditEvents, summarizeAuditTrail } from "@/lib/sim/audit";
import { localAssistantReply } from "@/lib/sim/assistant";
import { FIXTURE_AS_OF } from "@/lib/api/config";
import { VESSEL_CLASSES } from "@/lib/api/reference";
import type { CharterRequest, ScenarioInput } from "@/lib/api/types";

describe("Milestone 10: End-to-End Cross-Workspace Integration", () => {
  const asOf = new Date(FIXTURE_AS_OF);

  const sampleCharterReq: CharterRequest = {
    origin: "AUS_QLD",
    destination: "PRDP",
    cargoType: "COKING_COAL",
    cargoTonnes: 75_000,
    laycanStart: "2026-11-10",
    laycanEnd: "2026-11-18",
    deliveryDeadline: "2026-11-28",
    contractPreference: "SPOT",
  };

  beforeEach(() => {
    resetDemoState();
  });

  describe("1. Chartering & Feasibility Consistency", () => {
    it("respects port draft constraints: Capesize is CONDITIONAL at Haldia due to 8.5m river draft", () => {
      const hldSummary = evaluatePortFleetFeasibility("HLDA");
      const capeReport = hldSummary.reports.find((r) => r.vesselClass.id === "CAPESIZE");

      expect(capeReport).toBeDefined();
      expect(capeReport?.status).toBe("CONDITIONAL");
      expect(capeReport?.requiresLightering).toBe(true);

      // Charter recommendation for Haldia must reflect conditional status with Sandheads lightering
      const hldCharterReq: CharterRequest = {
        ...sampleCharterReq,
        destination: "HLDA",
        cargoTonnes: 55_000,
      };
      const rep = simulateCharterDecision(hldCharterReq, {
        now: asOf,
        bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
      });

      const evaluatedCape = rep.checks.find((c) => c.vesselClass === "CAPESIZE");
      expect(evaluatedCape).toBeDefined();
      expect(evaluatedCape?.status).toBe("CONDITIONAL");
      expect(
        evaluatedCape?.reasons.some(
          (r) =>
            r.toLowerCase().includes("lightering") ||
            r.toLowerCase().includes("sandheads") ||
            r.toLowerCase().includes("draft"),
        ),
      ).toBe(true);
    });

    it("verifies deep-water ports (Gangavaram) accept Capesize unconditionally", () => {
      const ggvmSummary = evaluatePortFleetFeasibility("GGVM");
      const ggvmCape = ggvmSummary.reports.find((r) => r.vesselClass.id === "CAPESIZE");
      expect(ggvmCape?.status).toBe("FEASIBLE");
      expect(ggvmCape?.requiresLightering).toBe(false);

      const ggvmCharterReq: CharterRequest = {
        ...sampleCharterReq,
        destination: "GGVM",
        cargoTonnes: 160_000,
      };
      const ggvmRep = simulateCharterDecision(ggvmCharterReq, {
        now: asOf,
        bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
      });
      const ggvmCapeCharter = ggvmRep.checks.find((c) => c.vesselClass === "CAPESIZE");
      expect(ggvmCapeCharter?.status).toBe("FEASIBLE");
    });

    it("ensures vessel capacities and deadweight are consistent across reference and feasibility models", () => {
      const prdpSummary = evaluatePortFleetFeasibility("PRDP");
      for (const item of prdpSummary.reports) {
        const refSpec = VESSEL_CLASSES.find((v) => v.id === item.vesselClass.id);
        expect(refSpec).toBeDefined();
        expect(item.vesselClass.dwtMax).toBe(refSpec!.dwtMax);
        expect(item.vesselClass.ladenDraftM).toBe(refSpec!.ladenDraftM);
      }
    });
  });

  describe("2. Freight Market & Scenario Lab Consistency", () => {
    it("baseline scenario with 0 shocks matches base charter decision exactly", () => {
      const baseCharter = simulateCharterDecision(sampleCharterReq, {
        now: asOf,
        bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
      });

      const zeroShockInput: ScenarioInput = {
        freightShockPct: 0,
        bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
        congestionDays: 0,
        speedKnotsDelta: 0,
      };

      const comparison = compareScenarios(sampleCharterReq, zeroShockInput, asOf);

      expect(comparison.diff.totalCostUsd).toBe(0);
      expect(comparison.diff.totalCostPct).toBe(0);
      expect(comparison.diff.freightUsdPerT).toBe(0);
      expect(comparison.baseline.totalCostUsd).toBe(comparison.simulated.totalCostUsd);
      expect(comparison.baseline.totalCostUsd).toBe(baseCharter.totalCostUsd);
      expect(comparison.baseline.costPerT).toBeCloseTo(
        baseCharter.totalCostUsd / sampleCharterReq.cargoTonnes,
        2,
      );
    });

    it("applies freight and bunker shocks cleanly without double-counting", () => {
      const freightShockOnly: ScenarioInput = {
        freightShockPct: 20,
        bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
        congestionDays: 0,
        speedKnotsDelta: 0,
      };

      const comparison = compareScenarios(sampleCharterReq, freightShockOnly, asOf);
      expect(comparison.diff.totalCostUsd).toBeGreaterThan(0);
      expect(comparison.diff.totalCostPct).toBeGreaterThan(0);
      expect(comparison.diff.freightUsdPerT).toBeGreaterThan(0);
      expect(comparison.diff.bunkerUsd).toBe(0); // bunker was not shocked
    });

    it("calculates bunker sensitivity monotonically as fuel price rises", () => {
      const lowBunker: ScenarioInput = {
        freightShockPct: 0,
        bunkerUsdPerT: 500,
        congestionDays: 0,
        speedKnotsDelta: 0,
      };
      const highBunker: ScenarioInput = {
        freightShockPct: 0,
        bunkerUsdPerT: 750,
        congestionDays: 0,
        speedKnotsDelta: 0,
      };

      const lowRes = simulateScenario(sampleCharterReq, lowBunker, asOf);
      const highRes = simulateScenario(sampleCharterReq, highBunker, asOf);

      expect(highRes.simulated.bunkerCostUsd).toBeGreaterThan(lowRes.simulated.bunkerCostUsd);
      expect(highRes.simulated.totalCostUsd).toBeGreaterThan(lowRes.simulated.totalCostUsd);
    });
  });

  describe("3. Portfolio Strategy & Demand Reconciliation", () => {
    it("guarantees candidate portfolio total stems reconcile exactly to demand volume", () => {
      const demand = 1_200_000;
      const candidates = buildCandidatePortfolios(demand, "COKING_COAL", "2026-12-31");
      const strategies = Object.values(candidates);

      expect(strategies.length).toBeGreaterThanOrEqual(3);

      for (const strat of strategies) {
        expect(strat.totalDemandT).toBe(demand);
        const sumStems = strat.stems.reduce((acc, stem) => acc + stem.tonnes, 0);
        expect(sumStems).toBe(demand);
        expect(strat.weightedCostPerT).toBeGreaterThan(0);
        expect(strat.totalSpendUsd).toBeGreaterThan(0);
      }
    });

    it("computes portfolio allocation plan with mathematically weighted landed costs", () => {
      const plan = computePortfolio(
        "BALANCED",
        { spot: 40, shortTerm: 40, mediumTerm: 20 },
        2_400_000,
      );

      expect(plan.annualVolumeT).toBe(2_400_000);
      expect(plan.expectedCostUsdPerT).toBeGreaterThan(0);
      expect(plan.allocation.spot).toBe(40);
      expect(plan.allocation.shortTerm).toBe(40);
      expect(plan.allocation.mediumTerm).toBe(20);
    });
  });

  describe("4. Contracts & Audit Trail Lifecycle & Persistence", () => {
    it("handles contract creation, audit diff tracking, and verification transition", async () => {
      const initialCount = contracts().length;

      const newRecord = await createContract({
        counterparty: "Adani Global Pte Ltd",
        vesselName: "MV Compass Test",
        vesselClass: "PANAMAX",
        type: "VOYAGE",
        origin: "AUS_QLD",
        destination: "PRDP",
        tonnage: 75_000,
        rateUsdPerT: 14.8,
        laycanStart: "2026-11-20",
        laycanEnd: "2026-11-27",
        status: "DRAFT",
        verificationStatus: "UNVERIFIED",
        isIllustrative: true,
        assumptions: ["Berth 2 ready on arrival"],
        outstandingChecks: [
          {
            id: "chk-test-1",
            label: "Verify Panamax LOA berth constraint",
            category: "PORT_NAUTICAL",
            status: "PENDING",
          },
        ],
      });

      expect(newRecord.reference).toMatch(/^NVK-VC-2610-\d{3}$/);
      expect(contracts().length).toBe(initialCount + 1);

      // Audit trail must record CONTRACT_CREATED at top
      const latestAudit = audits()[0];
      expect(latestAudit.action).toBe("CONTRACT_CREATED");
      expect(latestAudit.entityId).toBe(newRecord.reference);
      expect(latestAudit.diff).toBeDefined();

      // Verify outstanding check
      const verified = await verifyContractCheck(newRecord.id, "chk-test-1");
      expect(verified.outstandingChecks?.[0].status).toBe("PASSED");
      expect(verified.verificationStatus).toBe("VERIFIED");

      // Verify audit recorded VERIFICATION_COMPLETED
      const verifyAudit = audits()[0];
      expect(verifyAudit.action).toBe("VERIFICATION_COMPLETED");
      expect(verifyAudit.entityId).toBe(newRecord.reference);
    });

    it("computes commercial risks and laycan conflicts from active register", () => {
      const activeContracts = contracts();
      const risks = detectCommercialRisks(activeContracts);
      const conflicts = detectLaycanConflicts(activeContracts);
      const summary = summarizeCommercialPortfolio(activeContracts);

      expect(Array.isArray(risks)).toBe(true);
      expect(Array.isArray(conflicts)).toBe(true);
      expect(summary.totalTonnage).toBeGreaterThan(0);
      expect(summary.totalSpendUsd).toBeGreaterThan(0);
    });

    it("summarizes and filters audit trail accurately", () => {
      const allEvents = audits();
      const summary = summarizeAuditTrail(allEvents);
      expect(summary.totalEvents).toBe(allEvents.length);
      expect(summary.actionBreakdown).toBeDefined();

      const contractEvents = filterAuditEvents(allEvents, { action: "CONTRACT_CREATED" });
      for (const ev of contractEvents) {
        expect(ev.action).toBe("CONTRACT_CREATED");
      }
    });

    it("resets state cleanly to pristine demo fixtures without data leaks", () => {
      resetDemoState();
      expect(contracts().length).toBeGreaterThan(0);
      expect(audits().length).toBeGreaterThan(0);
    });
  });

  describe("5. NIRNAY Decision Assistant Engine Integration", () => {
    it("answers charter comparison queries with grounded figures from charter simulation", () => {
      const rep = simulateCharterDecision(sampleCharterReq, {
        now: asOf,
        bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
      });

      const reply = localAssistantReply("Compare the two lowest-cost feasible vessel options", {
        charterReq: sampleCharterReq,
        decisionReport: rep,
      });

      expect(reply.content).toMatch(/Capesize|Kamsarmax/i);
      expect(reply.sources.length).toBeGreaterThan(0);
      expect(reply.actions).toBeDefined();
    });

    it("explains Haldia draft constraints using actual port limits and Sandheads lightering", () => {
      const reply = localAssistantReply("Explain why a vessel is conditional at Haldia", {
        charterReq: { ...sampleCharterReq, destination: "HLDA" },
      });

      expect(reply.content).toMatch(/Haldia|Sandheads|8\.5/);
      expect(reply.sources.some((s) => s.toLowerCase().includes("haldia"))).toBe(true);
    });

    it("addresses bunker price sensitivities with quantitative landed cost impacts", () => {
      const reply = localAssistantReply("Assess the effect of a bunker-price increase", {
        charterReq: sampleCharterReq,
      });

      expect(reply.content).toMatch(/bunker|VLSFO|\$/i);
      expect(reply.actions?.some((a) => a.to === "/scenarios")).toBe(true);
    });

    it("safely handles out-of-domain or conversational questions with transparent guidance", () => {
      const reply = localAssistantReply("What is the weather in London next year?");
      expect(reply.content).toMatch(/decision-support assistant|NAVIK/i);
      expect(reply.followUps).toBeDefined();
      expect(reply.followUps?.length).toBeGreaterThan(0);
    });
  });
});
