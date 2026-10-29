import { describe, expect, it } from "vitest";
import {
  CATEGORIZED_PROMPTS,
  DEFAULT_ASSISTANT_CONTEXT,
  SUGGESTED_PROMPTS,
  detectIntent,
  extractContextFromQuery,
  localAssistantReply,
} from "./assistant";

describe("NIRNAY Decision Assistant Engine", () => {
  describe("Intent Detection", () => {
    it("detects charter recommendation intent", () => {
      expect(detectIntent("Explain the current charter recommendation.")).toBe(
        "charter_recommendation",
      );
      expect(
        detectIntent("Should I charter a Capesize now for 160k t coking coal to Paradip?"),
      ).toBe("charter_recommendation");
      expect(detectIntent("How does a SPLIT recommendation work?")).toBe("charter_recommendation");
    });

    it("detects vessel and port comparison intents", () => {
      expect(detectIntent("Compare the two lowest-cost feasible vessel options.")).toBe(
        "vessel_comparison",
      );
      expect(detectIntent("Compare Gangavaram and Visakhapatnam for a 175k t parcel.")).toBe(
        "vessel_comparison",
      );
      expect(detectIntent("Why is one vessel preferred over another?")).toBe("vessel_comparison");
    });

    it("detects landed cost driver intent", () => {
      expect(detectIntent("Identify the biggest drivers of landed cost.")).toBe(
        "landed_cost_drivers",
      );
      expect(detectIntent("What drives the landed cost of a proposed voyage?")).toBe(
        "landed_cost_drivers",
      );
      expect(detectIntent("Show me the voyage cost breakdown.")).toBe("landed_cost_drivers");
    });

    it("detects port feasibility & constraint intents", () => {
      expect(detectIntent("Explain why a vessel is conditional at Haldia.")).toBe(
        "feasibility_port",
      );
      expect(detectIntent("Why would a Capesize be rejected at Haldia?")).toBe("feasibility_port");
      expect(detectIntent("Which vessel classes are feasible for the selected destination?")).toBe(
        "feasibility_port",
      );
    });

    it("detects bunker sensitivity & scenario intents", () => {
      expect(detectIntent("Assess the effect of a bunker-price increase.")).toBe(
        "bunker_sensitivity",
      );
      expect(detectIntent("What happens to landed cost if VLSFO hits $760/t?")).toBe(
        "bunker_sensitivity",
      );
      expect(detectIntent("Compare the baseline and downside scenario.")).toBe(
        "bunker_sensitivity",
      );
    });

    it("detects strategic portfolio intent", () => {
      expect(detectIntent("Which sourcing portfolio best satisfies the selected objective?")).toBe(
        "portfolio_strategy",
      );
      expect(detectIntent("Explain the portfolio recommendation.")).toBe("portfolio_strategy");
    });

    it("detects operational risks & pre-fixing intent", () => {
      expect(
        detectIntent("What risks or missing information should be checked before fixing a vessel?"),
      ).toBe("operational_risks");
      expect(detectIntent("What operational risks should I check before chartering?")).toBe(
        "operational_risks",
      );
    });

    it("detects assumptions inversion intent", () => {
      expect(detectIntent("Which assumptions could change the recommendation?")).toBe(
        "assumptions_inversion",
      );
      expect(detectIntent("What would cause NAVIK to switch from CHARTER NOW to WAIT?")).toBe(
        "assumptions_inversion",
      );
    });

    it("detects market intelligence intent", () => {
      expect(detectIntent("What is driving freight risk on the Queensland lanes this month?")).toBe(
        "market_trends",
      );
      expect(detectIntent("Summarize the freight market trends.")).toBe("market_trends");
    });

    it("detects contracts & commercial governance intent", () => {
      expect(detectIntent("What contracts are currently under review?")).toBe(
        "contracts_governance",
      );
      expect(
        detectIntent("Are there any upcoming contractual deadlines or laycan conflicts?"),
      ).toBe("contracts_governance");
      expect(detectIntent("Summarize the audit trail for recent decisions.")).toBe(
        "contracts_governance",
      );
    });

    it("detects unsupported questions outside maritime dry bulk domain", () => {
      expect(detectIntent("What is the capital of Australia?")).toBe("unsupported");
      expect(detectIntent("Write a poem about the sea")).toBe("unsupported");
      expect(detectIntent("Who won the World Cup?")).toBe("unsupported");
    });
  });

  describe("Context & Entity Extraction", () => {
    it("extracts port, origin, vessel, and parcel size from text", () => {
      const ctx = extractContextFromQuery(
        "Compare Gangavaram and Visakhapatnam for a 175k t parcel from Queensland",
      );
      expect(ctx.origin).toBe("AUS_QLD");
      expect(["GGVM", "VIZG"]).toContain(ctx.destination);
      expect(ctx.cargoTonnes).toBe(175_000);
    });

    it("extracts Haldia and lightering context", () => {
      const ctx = extractContextFromQuery(
        "Why is a Capesize conditional at Haldia for 160k t coking coal?",
      );
      expect(ctx.destination).toBe("HLDA");
      expect(ctx.vesselClass).toBe("CAPESIZE");
      expect(ctx.cargoTonnes).toBe(160_000);
      expect(ctx.cargoType).toBe("COKING_COAL");
    });

    it("falls back to default context when query has no entities", () => {
      const ctx = extractContextFromQuery("Explain the current charter recommendation.");
      expect(ctx.origin).toBe(DEFAULT_ASSISTANT_CONTEXT.origin);
      expect(ctx.destination).toBe(DEFAULT_ASSISTANT_CONTEXT.destination);
      expect(ctx.cargoTonnes).toBe(DEFAULT_ASSISTANT_CONTEXT.cargoTonnes);
    });
  });

  describe("Charter Explanation (Actual Computed Values)", () => {
    it("generates structured answer with accurate numbers and units", () => {
      const res = localAssistantReply("Explain the current charter recommendation.");
      expect(res.intent).toBe("charter_recommendation");
      expect(res.structured).toBeDefined();

      // Check sections
      expect(res.structured.executive).toMatch(/CHARTER NOW|WAIT|SPLIT/);
      expect(res.structured.executive).toContain("Paradip");
      expect(res.structured.executive).toContain("Capesize");
      expect(res.structured.evidence.length).toBeGreaterThanOrEqual(4);

      // Verify units and formatting
      const landedItem = res.structured.evidence.find((e) => e.label === "Landed Cost");
      expect(landedItem).toBeDefined();
      expect(landedItem?.value).toMatch(/\$\d+(\.\d{2})?\/t/);

      // Check actions and sources
      expect(res.actions.some((a) => a.to === "/charter")).toBe(true);
      expect(res.sources.some((s) => s.includes("Charter Pipeline"))).toBe(true);
      expect(res.followUps.length).toBeGreaterThan(0);
    });
  });

  describe("Vessel & Port Comparison", () => {
    it("compares Gangavaram and Visakhapatnam with nautical details", () => {
      const res = localAssistantReply("Compare Gangavaram and Visakhapatnam for a 175k t parcel.");
      expect(res.intent).toBe("vessel_comparison");
      expect(res.structured.executive).toContain("Gangavaram");
      expect(res.structured.executive).toContain("Visakhapatnam");

      // Evidence should compare drafts and wait times
      const draftItem = res.structured.evidence.find((e) => e.label === "Max Draft");
      expect(draftItem?.value).toContain("21.0 m");
      expect(draftItem?.value).toContain("17.0 m");

      expect(res.actions.some((a) => a.to === "/feasibility")).toBe(true);
    });

    it("compares two lowest-cost feasible vessels", () => {
      const res = localAssistantReply("Compare the two lowest-cost feasible vessel options.");
      expect(res.intent).toBe("vessel_comparison");
      expect(res.structured.evidence.some((e) => e.label.includes("Landed Cost"))).toBe(true);
      expect(res.structured.evidence.some((e) => e.label.includes("Cost Advantage"))).toBe(true);
      expect(res.structured.impact.toLowerCase()).toContain("consolidat");
    });
  });

  describe("Landed Cost Drivers", () => {
    it("breaks down freight, bunker, port dues, and demurrage percentages", () => {
      const res = localAssistantReply("Identify the biggest drivers of landed cost.");
      expect(res.intent).toBe("landed_cost_drivers");
      expect(res.structured.executive).toMatch(/Freight Hire/);
      expect(res.structured.executive).toMatch(/Bunker Fuel/);

      // Verify all 5 cost components in evidence
      const labels = res.structured.evidence.map((e) => e.label);
      expect(labels).toContain("Freight Hire");
      expect(labels).toContain("Bunker Fuel");
      expect(labels).toContain("Port Dues & Tariffs");
      expect(labels).toContain("Demurrage Reserve");
      expect(labels).toContain("Cargo Insurance");

      expect(res.actions.some((a) => a.to === "/scenarios")).toBe(true);
    });
  });

  describe("Port Feasibility Explanations", () => {
    it("explains Haldia river draft and Sandheads lightering surcharge", () => {
      const res = localAssistantReply("Explain why a vessel is conditional at Haldia.");
      expect(res.intent).toBe("feasibility_port");
      expect(res.structured.executive).toContain("8.5 m");
      expect(res.structured.executive).toContain("Sandheads");
      expect(res.structured.executive).toContain("CONDITIONAL");

      const surcharge = res.structured.evidence.find((e) => e.label === "Lightering Surcharge");
      expect(surcharge?.value).toContain("$4.60/t");

      const days = res.structured.evidence.find((e) => e.label === "Schedule Impact");
      expect(days?.value).toContain("3 days");
    });

    it("lists feasible classes for a selected port", () => {
      const res = localAssistantReply(
        "Which vessel classes are feasible for the selected destination?",
        {
          destination: "GGVM",
        },
      );
      expect(res.intent).toBe("feasibility_port");
      expect(res.structured.executive).toContain("Gangavaram");
      expect(res.structured.evidence.some((e) => e.label === "Feasible Classes")).toBe(true);
    });
  });

  describe("Bunker Price Sensitivity", () => {
    it("calculates exact impact of VLSFO rise to $760/t", () => {
      const res = localAssistantReply("What happens to landed cost if VLSFO hits $760/t?");
      expect(res.intent).toBe("bunker_sensitivity");
      expect(res.structured.executive).toContain("$760/t");
      expect(res.structured.executive).toContain("$620/t");

      const impactItem = res.structured.evidence.find((e) => e.label === "Landed Cost Impact");
      expect(impactItem).toBeDefined();
      expect(impactItem?.value).toMatch(/\+\$\d+(\.\d{2})?\/t/);

      expect(res.sources.some((s) => s.includes("Scenario Lab"))).toBe(true);
      expect(res.actions.some((a) => a.to === "/scenarios")).toBe(true);
    });
  });

  describe("Portfolio & Sourcing Strategy", () => {
    it("explains portfolio recommendation with weighted cost and HHI", () => {
      const res = localAssistantReply(
        "Which sourcing portfolio best satisfies the selected objective?",
      );
      expect(res.intent).toBe("portfolio_strategy");
      expect(res.structured.executive).toContain("weighted landed cost");

      const costItem = res.structured.evidence.find((e) => e.label === "Weighted Landed Cost");
      expect(costItem).toBeDefined();
      expect(costItem?.value).toMatch(/\$\d+(\.\d{2})?\/t/);

      const hhiItem = res.structured.evidence.find((e) => e.label === "Origin Diversification");
      expect(hhiItem).toBeDefined();
      expect(hhiItem?.value).toMatch(/HHI \d+/);

      expect(res.actions.some((a) => a.to === "/strategy")).toBe(true);
    });
  });

  describe("Operational Risks & Pre-Fixing Checks", () => {
    it("provides 5-point operational verification checklist", () => {
      const res = localAssistantReply(
        "What risks or missing information should be checked before fixing a vessel?",
      );
      expect(res.intent).toBe("operational_risks");
      expect(res.structured.executive).toContain("five critical operational risk vectors");

      // Verify draft and congestion items
      expect(res.structured.evidence.some((e) => e.label.includes("Draft Limit"))).toBe(true);
      expect(res.structured.evidence.some((e) => e.label.includes("Anchorage Congestion"))).toBe(
        true,
      );
      expect(res.structured.evidence.some((e) => e.label.includes("Weather Window"))).toBe(true);

      expect(res.actions.some((a) => a.to === "/dashboard")).toBe(true);
    });
  });

  describe("Assumptions & Inversion Boundaries", () => {
    it("identifies freight trend, bunker, and schedule slack tipping points", () => {
      const res = localAssistantReply("Which assumptions could change the recommendation?");
      expect(res.intent).toBe("assumptions_inversion");

      const trendInversion = res.structured.evidence.find(
        (e) => e.label === "Market Drift Inversion",
      );
      expect(trendInversion?.value).toContain("< -3.0%");

      const bunkerThreshold = res.structured.evidence.find((e) => e.label === "Bunker Threshold");
      expect(bunkerThreshold?.value).toContain("$850/t");

      const slackItem = res.structured.evidence.find((e) => e.label === "Schedule Compression");
      expect(slackItem?.value).toContain("< 14 days");
    });
  });

  describe("Contracts & Commercial Governance", () => {
    it("explains active contracts, laycan overlaps, and audit depth", () => {
      const res = localAssistantReply("What contracts are currently under review?");
      expect(res.intent).toBe("contracts_governance");
      expect(res.structured.executive).toContain("contract fixture");
      expect(res.actions.some((a) => a.to === "/contracts")).toBe(true);
      expect(res.actions.some((a) => a.to === "/audit")).toBe(true);
    });
  });

  describe("Unsupported & Out-of-Domain Queries", () => {
    it("handles out-of-domain questions with transparent boundary", () => {
      const res = localAssistantReply("What is the recipe for chocolate cake?");
      expect(res.intent).toBe("unsupported");
      expect(res.structured.executive).toContain("maritime decision-support assistant");
      expect(res.structured.recommendedStep).toContain("suggested prompts");
      expect(res.actions.length).toBeGreaterThan(0);
      expect(res.followUps.length).toBeGreaterThan(0);
    });
  });

  describe("Suggested Prompts Consistency", () => {
    it("exports comprehensive list of suggested prompts", () => {
      expect(SUGGESTED_PROMPTS.length).toBeGreaterThanOrEqual(10);
      expect(CATEGORIZED_PROMPTS.length).toBe(4);

      // Verify all required prompts are covered
      expect(SUGGESTED_PROMPTS).toContain("Explain the current charter recommendation.");
      expect(SUGGESTED_PROMPTS).toContain("Compare the two lowest-cost feasible vessel options.");
      expect(SUGGESTED_PROMPTS).toContain("Identify the biggest drivers of landed cost.");
      expect(SUGGESTED_PROMPTS).toContain("Assess the effect of a bunker-price increase.");
      expect(SUGGESTED_PROMPTS).toContain("Explain why a vessel is conditional at Haldia.");
      expect(SUGGESTED_PROMPTS).toContain(
        "Summarize the main risks in the selected procurement strategy.",
      );
      expect(SUGGESTED_PROMPTS).toContain("Compare the baseline and downside scenario.");
    });
  });
});
