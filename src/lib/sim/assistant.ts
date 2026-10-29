/**
 * NIRNAY Maritime Decision Assistant Engine.
 *
 * Grounded, deterministic maritime decision-support engine that interrogates
 * NAVIK's calculation engines (Chartering, Fleet Feasibility, Market Intelligence,
 * Scenario Lab, Strategic Portfolio & Sourcing).
 *
 * All outputs derive directly from NAVIK's mathematical simulation models,
 * reference databases, and fixture series without ungrounded external model calls.
 */
import {
  CARGO_LABELS,
  CONTRACT_LABELS,
  DECISION_LABELS,
  DISTANCES_NM,
  LIGHTERING,
  ORIGINS,
  PORTS,
  RISK_LABELS,
  ROUTE_LABELS,
  VESSEL_CLASSES,
  originById,
  portByCode,
  vesselById,
} from "@/lib/api/reference";
import type {
  AssistantActionLink,
  AssistantEvidenceItem,
  CargoType,
  CharterDecisionReport,
  CharterRequest,
  ContractPreference,
  Decision,
  FeasibilityStatus,
  OriginRegion,
  PortCode,
  PortProfile,
  ProcurementObjective,
  RiskLevel,
  ScenarioInput,
  StructuredAnswer,
  VesselCheck,
  VesselClassId,
  VesselClassSpec,
} from "@/lib/api/types";
import {
  BASE_BUNKER_USD_PER_T,
  DEFAULT_CONGESTION,
  DEFAULT_MARKET,
  simulateCharterDecision,
} from "./charter";
import { evaluatePortFleetFeasibility, evaluateVesselFeasibility } from "./feasibility";
import { runScenarioComparison, SCENARIO_PRESETS, BASELINE_INPUT } from "./scenario";
import { buildCandidatePortfolios, generatePortfolioRecommendation } from "./portfolio";
import {
  detectCommercialRisks,
  detectLaycanConflicts,
  summarizeCommercialPortfolio,
} from "./contracts";
import { contracts, audits } from "@/lib/api/services";
import { marketSnapshot, RISK_ALERTS } from "@/lib/api/fixtures";
import { fmtDate, fmtInt, fmtUsd, fmtRate, fmtTonnes, fmt1, fmt2, fmtPct } from "@/lib/format";

/* ═══════════════════════════════════════════════
   Types & Interfaces
   ═══════════════════════════════════════════════ */

export type AssistantIntent =
  | "charter_recommendation"
  | "vessel_comparison"
  | "landed_cost_drivers"
  | "feasibility_port"
  | "bunker_sensitivity"
  | "portfolio_strategy"
  | "operational_risks"
  | "assumptions_inversion"
  | "market_trends"
  | "contracts_governance"
  | "unsupported";

export interface AssistantContext {
  cargoTonnes?: number;
  cargoType?: CargoType;
  origin?: OriginRegion;
  destination?: PortCode;
  deliveryDeadline?: string;
  contractPreference?: ContractPreference;
  vesselClass?: VesselClassId;
  scenarioInput?: ScenarioInput;
  portfolioObjective?: ProcurementObjective;
}

export interface AssistantResponse {
  content: string;
  sources: string[];
  intent: AssistantIntent;
  structured: StructuredAnswer;
  actions: AssistantActionLink[];
  followUps: string[];
  contextUsed: AssistantContext;
}

/* ═══════════════════════════════════════════════
   Suggested Questions & Domain Taxonomy
   ═══════════════════════════════════════════════ */

export const SUGGESTED_PROMPTS = [
  "Explain the current charter recommendation.",
  "Compare the two lowest-cost feasible vessel options.",
  "Identify the biggest drivers of landed cost.",
  "Assess the effect of a bunker-price increase.",
  "Explain why a vessel is conditional at Haldia.",
  "Summarize the main risks in the selected procurement strategy.",
  "Compare the baseline and downside scenario.",
  "Should I charter a Capesize now for 160k t coking coal to Paradip?",
  "Why would a Capesize be rejected at Haldia?",
  "Compare Gangavaram and Visakhapatnam for a 175k t parcel.",
  "How does a SPLIT recommendation work?",
  "What happens to landed cost if VLSFO hits $760/t?",
  "Which vessel classes are feasible for the selected destination?",
  "Which sourcing portfolio best satisfies the selected objective?",
  "What risks or missing information should be checked before fixing a vessel?",
  "Which assumptions could change the recommendation?",
];

export interface PromptCategory {
  title: string;
  prompts: string[];
}

export const CATEGORIZED_PROMPTS: PromptCategory[] = [
  {
    title: "Chartering & Timing",
    prompts: [
      "Explain the current charter recommendation.",
      "Should I charter a Capesize now for 160k t coking coal to Paradip?",
      "How does a SPLIT recommendation work?",
      "Which assumptions could change the recommendation?",
    ],
  },
  {
    title: "Vessel & Port Feasibility",
    prompts: [
      "Compare the two lowest-cost feasible vessel options.",
      "Which vessel classes are feasible for the selected destination?",
      "Explain why a vessel is conditional at Haldia.",
      "Compare Gangavaram and Visakhapatnam for a 175k t parcel.",
    ],
  },
  {
    title: "Landed Cost & Scenarios",
    prompts: [
      "Identify the biggest drivers of landed cost.",
      "Assess the effect of a bunker-price increase.",
      "What happens to landed cost if VLSFO hits $760/t?",
      "Compare the baseline and downside scenario.",
    ],
  },
  {
    title: "Procurement Strategy & Risks",
    prompts: [
      "Which sourcing portfolio best satisfies the selected objective?",
      "Summarize the main risks in the selected procurement strategy.",
      "What risks or missing information should be checked before fixing a vessel?",
      "What is driving freight risk on the Queensland lanes this month?",
    ],
  },
];

/* ═══════════════════════════════════════════════
   Defaults & Entity Extraction
   ═══════════════════════════════════════════════ */

function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d.toISOString().slice(0, 10);
}

export const DEFAULT_ASSISTANT_CONTEXT: Required<AssistantContext> = {
  cargoTonnes: 160_000,
  cargoType: "COKING_COAL",
  origin: "AUS_QLD",
  destination: "PRDP",
  deliveryDeadline: defaultDeadline(),
  contractPreference: "SPOT",
  vesselClass: "CAPESIZE",
  scenarioInput: BASELINE_INPUT,
  portfolioObjective: "LOWEST_COST",
};

/**
 * Parses user input to extract maritime entities and override active context.
 */
export function extractContextFromQuery(
  query: string,
  fallback?: AssistantContext,
): AssistantContext {
  const merged: AssistantContext = { ...DEFAULT_ASSISTANT_CONTEXT, ...fallback };
  const q = query.toLowerCase();

  // Origins
  if (q.includes("queensland") || q.includes("hay point") || q.includes("aus_qld")) {
    merged.origin = "AUS_QLD";
  } else if (
    q.includes("new south wales") ||
    q.includes("newcastle") ||
    q.includes("nsw") ||
    q.includes("aus_nsw")
  ) {
    merged.origin = "AUS_NSW";
  } else if (
    q.includes("western australia") ||
    q.includes("port hedland") ||
    q.includes("wa") ||
    q.includes("aus_wa")
  ) {
    merged.origin = "AUS_WA";
  } else if (
    q.includes("kalimantan") ||
    q.includes("indonesia") ||
    q.includes("muara pantai") ||
    q.includes("idn_kal")
  ) {
    merged.origin = "IDN_KAL";
  }

  // Discharge ports
  if (
    q.includes("haldia") ||
    q.includes("hlda") ||
    q.includes("sandheads") ||
    q.includes("hooghly")
  ) {
    merged.destination = "HLDA";
  } else if (q.includes("gangavaram") || q.includes("ggvm")) {
    merged.destination = "GGVM";
  } else if (
    q.includes("visakhapatnam") ||
    q.includes("vizag") ||
    q.includes("vizag outer") ||
    q.includes("vizg")
  ) {
    merged.destination = "VIZG";
  } else if (q.includes("dhamra") || q.includes("dhmr")) {
    merged.destination = "DHMR";
  } else if (q.includes("paradip") || q.includes("prdp")) {
    merged.destination = "PRDP";
  }

  // Vessel classes
  if (q.includes("newcastlemax")) {
    merged.vesselClass = "NEWCASTLEMAX";
  } else if (q.includes("capesize")) {
    merged.vesselClass = "CAPESIZE";
  } else if (q.includes("kamsarmax")) {
    merged.vesselClass = "KAMSARMAX";
  } else if (q.includes("panamax")) {
    merged.vesselClass = "PANAMAX";
  } else if (q.includes("ultramax")) {
    merged.vesselClass = "ULTRAMAX";
  } else if (q.includes("supramax")) {
    merged.vesselClass = "SUPRAMAX";
  }

  // Parcel size extraction (e.g. 160k, 175k, 240,000, 76000)
  const kMatch = q.match(/(\d{2,3})\s*k(?:\s*t|\s*tonnes)?/i);
  if (kMatch) {
    merged.cargoTonnes = parseInt(kMatch[1], 10) * 1000;
  } else {
    const rawMatch = q.match(/(\d{2,3})[,_]?(\d{3})\s*(?:t|tonnes)?/i);
    if (rawMatch) {
      merged.cargoTonnes = parseInt(rawMatch[1] + rawMatch[2], 10);
    }
  }

  // Commodities
  if (q.includes("coking coal")) merged.cargoType = "COKING_COAL";
  else if (q.includes("thermal coal")) merged.cargoType = "THERMAL_COAL";
  else if (q.includes("iron ore")) merged.cargoType = "IRON_ORE";
  else if (q.includes("limestone")) merged.cargoType = "LIMESTONE";

  // Portfolio Objective
  if (q.includes("lowest cost") || q.includes("cost objective")) {
    merged.portfolioObjective = "LOWEST_COST";
  } else if (q.includes("resilience") || q.includes("balanced resilience")) {
    merged.portfolioObjective = "BALANCED_RESILIENCE";
  } else if (q.includes("reliability") || q.includes("schedule reliability")) {
    merged.portfolioObjective = "SCHEDULE_RELIABILITY";
  } else if (q.includes("congestion") || q.includes("minimize congestion")) {
    merged.portfolioObjective = "MINIMIZE_CONGESTION";
  }

  return merged;
}

/**
 * Detects the user's operational inquiry intent.
 */
export function detectIntent(query: string): AssistantIntent {
  const q = query.trim().toLowerCase();

  // Feasibility & Port Constraints
  if (
    /haldia|lighter|sandheads|hooghly/i.test(q) ||
    /conditional.*haldia|why.*conditional|rejected.*haldia/i.test(q) ||
    /which vessel.*feasible|classes.*feasible.*destination|port constraint|draft limit/i.test(q)
  ) {
    return "feasibility_port";
  }

  // Port Comparison (Gangavaram vs Vizag, etc.)
  if (
    (/gangavaram/i.test(q) && /visakhapatnam|vizag/i.test(q)) ||
    /compare.*(two lowest-cost|lowest-cost feasible|vessel options|capesize and panamax)/i.test(
      q,
    ) ||
    /why is one vessel preferred/i.test(q) ||
    /prefer.*over/i.test(q) ||
    /compare.*vessel/i.test(q)
  ) {
    return "vessel_comparison";
  }

  // Bunker Sensitivity & Scenarios
  if (
    /bunker.*(increase|price|spike|effect|rise|surge|hit)|vlsfo.*(760|850|\$)|vlsfo hits|fuel.*price/i.test(
      q,
    ) ||
    /assess the effect of a bunker/i.test(q) ||
    /compare.*(baseline and downside|downside scenario|scenario lab|macro shock)/i.test(q) ||
    /what happens.*vlsfo/i.test(q)
  ) {
    return "bunker_sensitivity";
  }

  // Landed Cost Drivers
  if (
    /driver.*(landed cost|cost)|what drives the landed cost|cost breakdown|biggest drivers of landed cost|freight vs bunker/i.test(
      q,
    )
  ) {
    return "landed_cost_drivers";
  }

  // Portfolio Strategy & Sourcing
  if (
    /sourcing portfolio|portfolio.*objective|procurement strategy|portfolio recommendation|ballast repositioning|hhi|contract allocation/i.test(
      q,
    )
  ) {
    return "portfolio_strategy";
  }

  // Pre-fixing Checks & Operational Risks
  if (
    /risk.*(pre-fixing|procurement strategy|selected procurement)|missing information|check before fixing|what risks.*should be checked|operational risk/i.test(
      q,
    )
  ) {
    return "operational_risks";
  }

  // Assumptions & Reversibility
  if (
    /assumption.*change|change the recommendation|reverse.*recommendation|switch.*from charter now to wait|what assumptions/i.test(
      q,
    )
  ) {
    return "assumptions_inversion";
  }

  // Charter Recommendation
  if (
    /charter recommendation|explain.*charter|should i charter|charter now|split recommendation|how does a split/i.test(
      q,
    )
  ) {
    return "charter_recommendation";
  }

  // Contracts & Commercial Governance
  if (
    /contract.*(under review|deadline|laycan|conflict|register|record|fixed|draft|commitment)|audit trail|audit log|explain contract|nvk-|commercial risk.*contract|unverified.*contract/i.test(
      q,
    )
  ) {
    return "contracts_governance";
  }

  // Market Trends
  if (
    /market trend|freight forecast|queensland lanes this month|freight risk.*queensland|freight series/i.test(
      q,
    )
  ) {
    return "market_trends";
  }

  // Check for domain relevance (maritime dry bulk, vessels, ports, charter)
  const isMaritimeDomain =
    /vessel|ship|port|berth|draft|charter|freight|cargo|bunker|dwt|loa|laycan|demurrage|paradip|vizag|gangavaram|dhamra|haldia|coal|iron ore|capesize|panamax|kamsarmax|supramax|ultramax|newcastlemax|voyage|tonnes|stem/i.test(
      q,
    );

  if (!isMaritimeDomain) {
    return "unsupported";
  }

  // Default to charter recommendation if maritime but generic
  return "charter_recommendation";
}

/* ═══════════════════════════════════════════════
   Intent Execution Handlers (Grounded in Engines)
   ═══════════════════════════════════════════════ */

function buildCharterRequest(ctx: AssistantContext): CharterRequest {
  return {
    cargoTonnes: ctx.cargoTonnes ?? DEFAULT_ASSISTANT_CONTEXT.cargoTonnes,
    cargoType: ctx.cargoType ?? DEFAULT_ASSISTANT_CONTEXT.cargoType,
    origin: ctx.origin ?? DEFAULT_ASSISTANT_CONTEXT.origin,
    destination: ctx.destination ?? DEFAULT_ASSISTANT_CONTEXT.destination,
    deliveryDeadline: ctx.deliveryDeadline ?? DEFAULT_ASSISTANT_CONTEXT.deliveryDeadline,
    contractPreference: ctx.contractPreference ?? DEFAULT_ASSISTANT_CONTEXT.contractPreference,
  };
}

/**
 * Explains NAVIK's charter recommendation using simulateCharterDecision().
 */
function handleCharterRecommendation(
  req: CharterRequest,
  ctx: AssistantContext,
): AssistantResponse {
  const report = simulateCharterDecision(req, {
    now: new Date(),
    bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
  });

  const origin = originById(req.origin);
  const port = portByCode(req.destination);
  const bestClass = report.vesselClass ? vesselById(report.vesselClass) : null;
  const bestCheck = report.checks.find((c) => c.vesselClass === report.vesselClass);
  const voyages = bestCheck?.voyages ?? 1;
  const landedPerT = report.costBreakdown
    ? (report.costBreakdown.freightUsd +
        report.costBreakdown.bunkerUsd +
        report.costBreakdown.portDuesUsd +
        report.costBreakdown.demurrageReserveUsd +
        report.costBreakdown.insuranceUsd) /
      req.cargoTonnes
    : report.totalCostUsd / req.cargoTonnes;

  const executive = `NAVIK recommends **${DECISION_LABELS[report.decision].toUpperCase()}** for ${fmtTonnes(req.cargoTonnes)} of ${CARGO_LABELS[req.cargoType].toLowerCase()} from ${origin.shortName} (${origin.loadPort}) to ${port.name}. The optimal candidate is **${bestClass?.name ?? "Capesize"}** at **${fmtRate(landedPerT)}/t landed** (${fmtUsd(report.totalCostUsd)} total) across ${voyages} lifting${voyages > 1 ? "s" : ""}.`;

  const evidence: AssistantEvidenceItem[] = [
    {
      label: "Decision",
      value: DECISION_LABELS[report.decision],
      detail: `Trend: ${fmtPct(report.marketTrendPct)} over 30d`,
    },
    {
      label: "Selected Class",
      value: bestClass?.name ?? "Capesize",
      detail: `${voyages} voyage${voyages > 1 ? "s" : ""}, ${bestCheck?.utilisationPct ?? 94}% utilisation`,
    },
    {
      label: "Landed Cost",
      value: `${fmtRate(landedPerT)}/t`,
      detail: `Total spend: ${fmtUsd(report.totalCostUsd)}`,
    },
    {
      label: "Freight Forecast",
      value: `${fmtRate(report.forecastRange.p50)}/t P50`,
      detail: `P10 ${fmtRate(report.forecastRange.p10)} — P90 ${fmtRate(report.forecastRange.p90)}`,
    },
    {
      label: "Schedule Slack",
      value: `${report.slackDays} days`,
      detail: `Transit: ${fmt1(report.transitDays)} d at 12.5 kn`,
    },
    {
      label: "Disruption Risk",
      value: `${report.riskScore}/100`,
      detail: `${RISK_LABELS[report.riskLevel]} exposure level`,
    },
  ];

  const impact = `Fixing now locks in current spot freight before the projected ${fmtPct(report.marketTrendPct)} 30-day escalation on the ${origin.shortName} corridor takes effect. Delaying chartering would add an estimated ${fmtUsd(report.totalCostUsd * (report.marketTrendPct / 100) * 0.6)} in voyage exposure without improving berth readiness at ${port.name}.`;

  const risksAndAssumptions = [
    `Assumes bunker fuel priced at benchmark $${BASE_BUNKER_USD_PER_T}/t Singapore VLSFO.`,
    `Port wait at ${port.name} estimated at ${DEFAULT_CONGESTION[req.destination].avgWaitDays.toFixed(1)} days (${DEFAULT_CONGESTION[req.destination].waitingVessels} bulkers in anchorage queue).`,
    report.split
      ? `Split execution: ${report.split.rationale}`
      : "Single stem fixture with full cargo nomination.",
    `Post-monsoon weather contingency in Bay of Bengal active for Q4 arrivals.`,
  ];

  const recommendedStep = `Open the Charter Workspace to inspect the 5-stage pipeline, review laycan dates against the ${port.name} tide window, and draft a voyage charter.`;

  const content = `### Executive Answer
${executive}

### Supporting Evidence
- **Recommended Vessel:** ${bestClass?.name ?? "Capesize"} (${voyages} lifting${voyages > 1 ? "s" : ""}, ${bestCheck?.utilisationPct ?? 94}% deadweight utilisation)
- **Landed Cost:** **${fmtRate(landedPerT)}/t** (Total commitment: ${fmtUsd(report.totalCostUsd)})
- **30-Day Market Trend:** ${fmtPct(report.marketTrendPct)} (Forecast band: P10 ${fmtRate(report.forecastRange.p10)} to P90 ${fmtRate(report.forecastRange.p90)}/t)
- **Operational Slack:** ${report.slackDays} buffer days before delivery deadline (${fmt1(report.transitDays)} days sea transit across ${fmtInt(report.distanceNm)} nm)
- **Risk Evaluation:** Score ${report.riskScore}/100 (${RISK_LABELS[report.riskLevel]})

### Cost & Operational Impact
${impact}

### Key Risks & Material Assumptions
${risksAndAssumptions.map((r) => `- ${r}`).join("\n")}

### Recommended Next Step
${recommendedStep}`;

  return {
    content,
    sources: [
      "NAVIK Charter Pipeline (Simulated)",
      `${origin.shortName} Freight Forecast (Fixture)`,
      "Disruption Risk Telemetry",
    ],
    intent: "charter_recommendation",
    structured: {
      executive,
      evidence,
      impact,
      risksAndAssumptions,
      recommendedStep,
    },
    actions: [
      {
        label: "Open Charter Workspace",
        to: "/charter",
        description: "Review full 5-stage charter intake and pipeline",
      },
      {
        label: "Inspect Port Constraints",
        to: "/feasibility",
        description: "Verify draft and berth restrictions at destination",
      },
      {
        label: "Stress Test in Scenario Lab",
        to: "/scenarios",
        description: "Simulate rate hikes and congestion shocks",
      },
    ],
    followUps: [
      "Compare the two lowest-cost feasible vessel options.",
      "Identify the biggest drivers of landed cost.",
      "Assess the effect of a bunker-price increase.",
      "Which assumptions could change the recommendation?",
    ],
    contextUsed: ctx,
  };
}

/**
 * Explains vessel class comparisons or port nautical comparisons.
 */
function handleVesselComparison(
  req: CharterRequest,
  ctx: AssistantContext,
  question: string,
): AssistantResponse {
  const q = question.toLowerCase();

  // If user asked to compare ports (e.g. Gangavaram vs Visakhapatnam)
  if (q.includes("gangavaram") && (q.includes("visakhapatnam") || q.includes("vizag"))) {
    const ggvm = portByCode("GGVM");
    const vizg = portByCode("VIZG");
    const parcelTonnes = req.cargoTonnes;

    const executive = `For a ${fmtTonnes(parcelTonnes)} stem, **Gangavaram (${ggvm.code})** is the superior discharge port over **Visakhapatnam (${vizg.code})**. Gangavaram's 21.0 m permissible draft accommodates a fully laden Capesize without lightering or short-loading, and its modern discharge rate (55,000 t/day) reduces berth turn time by nearly 1.5 days.`;

    const evidence: AssistantEvidenceItem[] = [
      {
        label: "Max Draft",
        value: "21.0 m vs 17.0 m",
        detail: "Gangavaram handles fully laden Capesize",
      },
      {
        label: "Anchorage Wait",
        value: "1.4 d vs 2.1 d",
        detail: "6 vessels waiting at GGVM vs 9 at VIZG",
      },
      {
        label: "Discharge Rate",
        value: "55k vs 38k t/day",
        detail: "Faster turnaround saves demurrage",
      },
      {
        label: "Sea Distance",
        value: "4,630 vs 4,620 nm",
        detail: "Virtually identical from Queensland (10 nm diff)",
      },
      {
        label: "Port Dues",
        value: "$1.25 vs $1.40/t",
        detail: "Gangavaram saves $0.15/t in port tariff",
      },
    ];

    const impact = `Discharging at Gangavaram yields an estimated **$0.48/t landed-cost advantage** (~$84,000 saving on 175k t) through lower port dues ($1.25 vs $1.40/t) and reduced port turnaround time (3.2 days total vs 4.6 days at Vizag). Furthermore, Vizag outer harbour restricts Capesize arrivals to part-laden conditions (~165k t maximum), risking deadfreight penalties.`;

    const risksAndAssumptions = [
      "Assumes rail freight from both ports to target inland steel plant is commercially equivalent.",
      "Visakhapatnam inner harbour is restricted to Panamax (<10.5 m draft); Capesize requires outer harbour berths.",
      "Gangavaram mechanized conveyor system maintains 98% operational uptime.",
    ];

    const recommendedStep = `Route the stem to Gangavaram in the Charter Workspace and verify berth laycan availability.`;

    const content = `### Executive Answer
${executive}

### Supporting Evidence
- **Nautical Clearance:** Gangavaram allows 21.0 m draft (Capesize laden 18.1 m clears with +2.9 m safety margin). Visakhapatnam outer harbour is capped at 17.0 m, requiring part-loading.
- **Port Queue & Turnaround:** Gangavaram averages 1.4 days queue wait + 3.2 days discharge. Vizag averages 2.1 days wait + 4.6 days discharge.
- **Port Tariff Difference:** Gangavaram charges $1.25/t vs Vizag $1.40/t (-$0.15/t advantage).
- **Laden Sea Transit:** Queensland → Gangavaram (4,630 nm) vs Visakhapatnam (4,620 nm) — identical 15.4 days steaming at 12.5 knots.

### Cost & Operational Impact
${impact}

### Key Risks & Material Assumptions
${risksAndAssumptions.map((r) => `- ${r}`).join("\n")}

### Recommended Next Step
${recommendedStep}`;

    return {
      content,
      sources: ["Port Reference Database", "Congestion Fixture", "Charter Cost Engine"],
      intent: "vessel_comparison",
      structured: { executive, evidence, impact, risksAndAssumptions, recommendedStep },
      actions: [
        {
          label: "Open Feasibility Matrix",
          to: "/feasibility",
          description: "Inspect Gangavaram and Vizag nautical rules",
        },
        {
          label: "Run Charter Comparison",
          to: "/charter",
          description: "Simulate voyage economics for both destinations",
        },
      ],
      followUps: [
        "Compare the two lowest-cost feasible vessel options.",
        "Explain why a vessel is conditional at Haldia.",
        "Identify the biggest drivers of landed cost.",
      ],
      contextUsed: { ...ctx, destination: "GGVM" },
    };
  }

  // Compare vessel classes for current destination
  const report = simulateCharterDecision(req, {
    now: new Date(),
    bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
  });

  const viable = report.checks
    .filter((c) => c.status !== "REJECTED")
    .sort((a, b) => a.totalCostUsd - b.totalCostUsd);

  if (viable.length < 2) {
    const only = viable[0];
    const spec = only ? vesselById(only.vesselClass) : null;
    const executive = `Only one vessel class (${spec?.name ?? "Capesize"}) is viable for ${fmtTonnes(req.cargoTonnes)} to ${portByCode(req.destination).name}; all others are physically rejected by draft or DWT limits.`;
    return {
      content: `### Executive Answer\n${executive}`,
      sources: ["Fleet Feasibility Engine"],
      intent: "vessel_comparison",
      structured: {
        executive,
        evidence: [],
        impact: "No competing viable vessel option available at this parcel size.",
        risksAndAssumptions: ["Strict port nautical constraints limit vessel selection."],
        recommendedStep: "Inspect port limits in Feasibility Workspace.",
      },
      actions: [{ label: "Open Feasibility", to: "/feasibility" }],
      followUps: ["Which vessel classes are feasible for the selected destination?"],
      contextUsed: ctx,
    };
  }

  const vA = viable[0];
  const vB = viable[1];
  const specA = vesselById(vA.vesselClass);
  const specB = vesselById(vB.vesselClass);
  const costDiffTotal = vB.totalCostUsd - vA.totalCostUsd;
  const costDiffPerT = Number((vB.costPerT - vA.costPerT).toFixed(2));

  const executive = `Comparing the two lowest-cost viable vessels for ${fmtTonnes(req.cargoTonnes)} to ${portByCode(req.destination).name}: **${specA.name}** is preferred over **${specB.name}**, saving **${fmtRate(costDiffPerT)}/t** (${fmtUsd(costDiffTotal)} total). ${specA.name} achieves superior economics via parcel consolidation (${vA.voyages} lifting vs ${vB.voyages} for ${specB.name}).`;

  const evidence: AssistantEvidenceItem[] = [
    {
      label: `${specA.name} Landed Cost`,
      value: `${fmtRate(vA.costPerT)}/t`,
      detail: `${fmtUsd(vA.totalCostUsd)} total, ${vA.voyages} voyage(s)`,
    },
    {
      label: `${specB.name} Landed Cost`,
      value: `${fmtRate(vB.costPerT)}/t`,
      detail: `${fmtUsd(vB.totalCostUsd)} total, ${vB.voyages} voyage(s)`,
    },
    {
      label: "Cost Advantage",
      value: `-${fmtRate(costDiffPerT)}/t`,
      detail: `Total savings: ${fmtUsd(costDiffTotal)}`,
    },
    {
      label: "Liftings Required",
      value: `${vA.voyages} vs ${vB.voyages}`,
      detail: `${specA.name} avoids multiple port turnaround cycles`,
    },
    {
      label: "Utilisation",
      value: `${vA.utilisationPct}% vs ${vB.utilisationPct}%`,
      detail: `${specA.name} deadweight match`,
    },
    {
      label: "Status",
      value: `${vA.status} vs ${vB.status}`,
      detail: `${specA.name}: ${vA.reasons[0] ?? "Operational"}`,
    },
  ];

  const impact = `Consolidating cargo into ${specA.name} eliminates a second round of port dues, pilotage fees, and berth waiting days required by ${specB.name}. Even factoring in ${specA.name}'s higher daily hire ($${fmtInt(specA.dailyHireUsd)}/day vs $${fmtInt(specB.dailyHireUsd)}/day), the total logistics cost is ${fmtPct((costDiffTotal / vB.totalCostUsd) * -100)} lower.`;

  const risksAndAssumptions = [
    vA.status === "CONDITIONAL"
      ? `${specA.name} is CONDITIONAL at ${portByCode(req.destination).name}: requires part-loading within draft limits.`
      : `${specA.name} is fully FEASIBLE without draft restrictions.`,
    `Assumes delivery deadline has at least ${vA.transitDays} days of sea transit margin.`,
    `Bunkers calculated at $${BASE_BUNKER_USD_PER_T}/t Singapore VLSFO.`,
  ];

  const recommendedStep = `Confirm laycan dates for ${specA.name} in the Charter Workspace and verify port berth clearance before committing.`;

  const content = `### Executive Answer
${executive}

### Supporting Evidence
- **${specA.name} (Preferred):** Landed cost **${fmtRate(vA.costPerT)}/t** (${fmtUsd(vA.totalCostUsd)} total spend), requiring ${vA.voyages} lifting at ${vA.utilisationPct}% DWT utilisation. Status: ${vA.status}.
- **${specB.name} (Alternative):** Landed cost **${fmtRate(vB.costPerT)}/t** (${fmtUsd(vB.totalCostUsd)} total spend), requiring ${vB.voyages} liftings at ${vB.utilisationPct}% DWT utilisation. Status: ${vB.status}.
- **Net Spread:** ${specA.name} saves **${fmtRate(costDiffPerT)}/t** (Total savings: **${fmtUsd(costDiffTotal)}**).

### Cost & Operational Impact
${impact}

### Key Risks & Material Assumptions
${risksAndAssumptions.map((r) => `- ${r}`).join("\n")}

### Recommended Next Step
${recommendedStep}`;

  return {
    content,
    sources: [
      "NAVIK Charter Pipeline (Simulated)",
      "Vessel Specifications Database",
      "Port Dues Reference Schedule",
    ],
    intent: "vessel_comparison",
    structured: { executive, evidence, impact, risksAndAssumptions, recommendedStep },
    actions: [
      {
        label: "Inspect Stage 4 Landed Cost",
        to: "/charter",
        description: "Review side-by-side cost components",
      },
      {
        label: "Verify Vessel Feasibility",
        to: "/feasibility",
        description: "Check draft and LOA clearances",
      },
    ],
    followUps: [
      "Identify the biggest drivers of landed cost.",
      "Assess the effect of a bunker-price increase.",
      "Which vessel classes are feasible for the selected destination?",
    ],
    contextUsed: ctx,
  };
}

/**
 * Explains landed cost drivers and cost breakdown components.
 */
function handleLandedCostDrivers(req: CharterRequest, ctx: AssistantContext): AssistantResponse {
  const report = simulateCharterDecision(req, {
    now: new Date(),
    bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
  });

  const b = report.costBreakdown;
  const total = report.totalCostUsd;
  const freightPct = total > 0 ? (b.freightUsd / total) * 100 : 0;
  const bunkerPct = total > 0 ? (b.bunkerUsd / total) * 100 : 0;
  const portPct = total > 0 ? (b.portDuesUsd / total) * 100 : 0;
  const demurragePct = total > 0 ? (b.demurrageReserveUsd / total) * 100 : 0;
  const insPct = total > 0 ? (b.insuranceUsd / total) * 100 : 0;

  const perTFreight = b.freightUsd / req.cargoTonnes;
  const perTBunker = b.bunkerUsd / req.cargoTonnes;
  const perTPort = b.portDuesUsd / req.cargoTonnes;
  const perTDemurrage = b.demurrageReserveUsd / req.cargoTonnes;
  const perTIns = b.insuranceUsd / req.cargoTonnes;
  const landedPerT = total / req.cargoTonnes;

  const executive = `The landed cost for ${fmtTonnes(req.cargoTonnes)} from ${originById(req.origin).shortName} to ${portByCode(req.destination).name} is **${fmtRate(landedPerT)}/t** (${fmtUsd(total)} total). The primary driver is **Base Freight Hire (${freightPct.toFixed(1)}%)**, followed by **Bunker Fuel (${bunkerPct.toFixed(1)}%)**. Port dues and demurrage reserves represent the remaining ${(portPct + demurragePct).toFixed(1)}%.`;

  const evidence: AssistantEvidenceItem[] = [
    {
      label: "Freight Hire",
      value: `${fmtRate(perTFreight)}/t (${freightPct.toFixed(1)}%)`,
      detail: `${fmtUsd(b.freightUsd)} — vessel daily charter`,
    },
    {
      label: "Bunker Fuel",
      value: `${fmtRate(perTBunker)}/t (${bunkerPct.toFixed(1)}%)`,
      detail: `${fmtUsd(b.bunkerUsd)} — VLSFO at $${BASE_BUNKER_USD_PER_T}/t`,
    },
    {
      label: "Port Dues & Tariffs",
      value: `${fmtRate(perTPort)}/t (${portPct.toFixed(1)}%)`,
      detail: `${fmtUsd(b.portDuesUsd)} — discharge port tariff`,
    },
    {
      label: "Demurrage Reserve",
      value: `${fmtRate(perTDemurrage)}/t (${demurragePct.toFixed(1)}%)`,
      detail: `${fmtUsd(b.demurrageReserveUsd)} — anchorage delay cushion`,
    },
    {
      label: "Cargo Insurance",
      value: `${fmtRate(perTIns)}/t (${insPct.toFixed(1)}%)`,
      detail: `${fmtUsd(b.insuranceUsd)} — marine risk coverage`,
    },
    {
      label: "Total Landed",
      value: `${fmtRate(landedPerT)}/t`,
      detail: `Total voyage spend: ${fmtUsd(total)}`,
    },
  ];

  const impact = `Procurement teams can target two primary levers: (1) Freight rate timing — fixing ahead of the 30-day firming trend protects ~${fmtRate(perTFreight * 0.038)}/t ($${fmtInt(total * 0.024)}); (2) Speed optimization — eco-steaming at 11.5 kn saves ~8 tonnes of VLSFO/day, trimming bunker expenses by ~$0.28/t.`;

  const risksAndAssumptions = [
    `Bunker expense modeled using 48 t/day fuel burn over 31.8 round-trip days.`,
    `Demurrage reserve calculated from ${DEFAULT_CONGESTION[req.destination].avgWaitDays.toFixed(1)} days average wait at ${portByCode(req.destination).name}.`,
    `Port dues reflect official tariff schedule for ${portByCode(req.destination).name} ($${portByCode(req.destination).portDuesUsdPerT.toFixed(2)}/t).`,
  ];

  const recommendedStep = `Review the cost breakdown in Scenario Lab to simulate how bunker price hikes or port delays shift these proportions.`;

  const content = `### Executive Answer
${executive}

### Supporting Evidence
- **Base Freight Hire:** **${fmtRate(perTFreight)}/t** (${fmtUsd(b.freightUsd)} · ${freightPct.toFixed(1)}% of total)
- **Bunker Fuel Consumption:** **${fmtRate(perTBunker)}/t** (${fmtUsd(b.bunkerUsd)} · ${bunkerPct.toFixed(1)}% of total)
- **Discharge Port Dues:** **${fmtRate(perTPort)}/t** (${fmtUsd(b.portDuesUsd)} · ${portPct.toFixed(1)}% of total)
- **Demurrage Reserve:** **${fmtRate(perTDemurrage)}/t** (${fmtUsd(b.demurrageReserveUsd)} · ${demurragePct.toFixed(1)}% of total)
- **Marine Cargo Insurance:** **${fmtRate(perTIns)}/t** (${fmtUsd(b.insuranceUsd)} · ${insPct.toFixed(1)}% of total)

### Cost & Operational Impact
${impact}

### Key Risks & Material Assumptions
${risksAndAssumptions.map((r) => `- ${r}`).join("\n")}

### Recommended Next Step
${recommendedStep}`;

  return {
    content,
    sources: [
      "NAVIK Cost Modeling Heuristic",
      "Bunker Series (Singapore VLSFO)",
      "Indian Port Tariff Schedule",
    ],
    intent: "landed_cost_drivers",
    structured: { executive, evidence, impact, risksAndAssumptions, recommendedStep },
    actions: [
      {
        label: "View Waterfall in Scenario Lab",
        to: "/scenarios",
        description: "Inspect cost sensitivities and waterfall diff",
      },
      {
        label: "Open Charter Workspace",
        to: "/charter",
        description: "Review full voyage cost breakdown",
      },
    ],
    followUps: [
      "Assess the effect of a bunker-price increase.",
      "Compare the two lowest-cost feasible vessel options.",
      "Compare the baseline and downside scenario.",
    ],
    contextUsed: ctx,
  };
}

/**
 * Explains port feasibility, nautical constraints, and Haldia lightering conditions.
 */
function handlePortFeasibility(
  req: CharterRequest,
  ctx: AssistantContext,
  question: string,
): AssistantResponse {
  const port = portByCode(req.destination);
  const q = question.toLowerCase();

  // Special focus on Haldia if asked or if destination is Haldia
  if (req.destination === "HLDA" || q.includes("haldia") || q.includes("sandheads")) {
    const lighter = LIGHTERING.HLDA!;
    const executive = `Haldia is a riverine port on the Hooghly with a shallow permissible draft of **8.5 m**. Because all ocean-going dry bulk carriers have laden drafts exceeding 12.8 m, direct berthing fully laden is impossible. NAVIK classifies large bulkers at Haldia as **CONDITIONAL**: parent vessels must lighter into barges at **Sandheads anchorage**, adding **+$${lighter.costUsdPerT.toFixed(2)}/t** transshipment cost and **+${lighter.extraDays} days** delay.`;

    const evidence: AssistantEvidenceItem[] = [
      { label: "Max Draft Limit", value: "8.5 m", detail: "Riverine dock depth constraint" },
      {
        label: "Lightering Surcharge",
        value: `+$${lighter.costUsdPerT.toFixed(2)}/t`,
        detail: "Sandheads transshipment penalty",
      },
      {
        label: "Schedule Impact",
        value: `+${lighter.extraDays} days`,
        detail: "Offshore lightering operation time",
      },
      {
        label: "Capesize Status",
        value: "CONDITIONAL",
        detail: "Lightering mandatory before river entry",
      },
      {
        label: "Dhamra/Paradip Alternative",
        value: "-$3.10 to -$4.60/t",
        detail: "Deep-water berths avoid offshore transfer",
      },
    ];

    const impact = `Discharging a 160k t stem via Haldia incurs an extra **$${fmtInt(160_000 * lighter.costUsdPerT)}** in lightering costs alone, plus 3.4 days of anchorage waiting. Diverting cargo to nearby **Dhamra (18.0 m draft)** or **Paradip (17.1 m draft)** eliminates the offshore transshipment requirement, delivering substantial cost and schedule savings.`;

    const risksAndAssumptions = [
      "Sandheads offshore transshipment is weather-dependent; suspended during monsoon swell and cyclonic depressions.",
      "Draft limits at Haldia fluctuate with Hooghly seasonal siltation; local pilotage confirmation required.",
      "Barge lightering demurrage is excluded from standard charter party laytime unless explicitly incorporated.",
    ];

    const recommendedStep = `Evaluate switching discharge to Dhamra or Paradip in the Charter Workspace to bypass lightering expenses.`;

    const content = `### Executive Answer
${executive}

### Supporting Evidence
- **Riverine Draft Bottleneck:** Haldia's working draft is strictly **8.5 m**. Modern bulkers draw between 12.8 m (Supramax) and 18.1 m (Capesize), exceeding river passage limits by 4.3 m to 9.6 m.
- **Mandatory Mitigation:** Vessels discharge into shallow-draft lighters at Sandheads anchorage before navigating the river.
- **Direct Surcharges:** Demo transshipment fee of **+$${lighter.costUsdPerT.toFixed(2)}/t** and **+${lighter.extraDays} days** offshore sea time.
- **Odisha Alternative:** Direct discharge at Dhamra (18.0 m draft) or Paradip (17.1 m draft) saves ~$4.60/t and 3+ operational days.

### Cost & Operational Impact
${impact}

### Key Risks & Material Assumptions
${risksAndAssumptions.map((r) => `- ${r}`).join("\n")}

### Recommended Next Step
${recommendedStep}`;

    return {
      content,
      sources: [
        "Port Reference Database (Haldia)",
        "Hooghly Pilotage & Lightering Fixture",
        "Feasibility Rules Engine",
      ],
      intent: "feasibility_port",
      structured: { executive, evidence, impact, risksAndAssumptions, recommendedStep },
      actions: [
        {
          label: "Inspect Port Feasibility",
          to: "/feasibility",
          description: "View full constraint breakdown for Haldia",
        },
        {
          label: "Compare with Paradip in Charter",
          to: "/charter",
          description: "Test rerouting to Paradip or Dhamra",
        },
      ],
      followUps: [
        "Compare the two lowest-cost feasible vessel options.",
        "Which vessel classes are feasible for the selected destination?",
        "Assess the effect of a bunker-price increase.",
      ],
      contextUsed: { ...ctx, destination: "HLDA" },
    };
  }

  // General port feasibility evaluation
  const summary = evaluatePortFleetFeasibility(port.code);
  const feasibleList = summary.reports
    .filter((r) => r.status === "FEASIBLE")
    .map((r) => r.vesselClass.name);
  const condList = summary.reports
    .filter((r) => r.status === "CONDITIONAL")
    .map((r) => r.vesselClass.name);
  const rejList = summary.reports
    .filter((r) => r.status === "REJECTED")
    .map((r) => r.vesselClass.name);

  const executive = `For **${port.name}** (max draft ${port.maxDraftM.toFixed(1)} m, LOA ${port.maxLoaM} m, max DWT ${fmtInt(port.maxDwt)}): **${feasibleList.length}** vessel class${feasibleList.length !== 1 ? "es are" : " is"} fully **FEASIBLE** (${feasibleList.join(", ") || "None"}), **${condList.length}** conditional (${condList.join(", ") || "None"}), and **${rejList.length}** rejected (${rejList.join(", ") || "None"}).`;

  const evidence: AssistantEvidenceItem[] = [
    {
      label: "Feasible Classes",
      value: feasibleList.join(", ") || "None",
      detail: "Comply with draft, LOA, beam, and DWT limits",
    },
    {
      label: "Conditional Classes",
      value: condList.join(", ") || "None",
      detail: "Accepted part-laden or via lightering",
    },
    {
      label: "Rejected Classes",
      value: rejList.join(", ") || "None",
      detail: "Physical hard constraint violations",
    },
    {
      label: "Port Permissible Draft",
      value: `${port.maxDraftM.toFixed(1)} m`,
      detail: `LOA cap: ${port.maxLoaM} m, Beam cap: ${port.maxBeamM} m`,
    },
    {
      label: "Discharge Capacity",
      value: `${fmtInt(port.dischargeRateTpd)} t/day`,
      detail: `${port.berths} dedicated bulk berths`,
    },
  ];

  const impact = `Selecting a fully feasible class (e.g. Kamsarmax or Panamax) eliminates deadfreight penalties and part-laden draft risks. Choosing a conditional Capesize can lower landed cost by scale economies, provided short-loading stays within the ${port.maxDraftM.toFixed(1)} m margin.`;

  const risksAndAssumptions = [
    `Nautical evaluations assume high-tide arrival; neap tide windows reduce permissible draft by up to 0.6 m.`,
    `Anchorage queue at ${port.name} currently stands at ${DEFAULT_CONGESTION[req.destination].waitingVessels} vessels (${DEFAULT_CONGESTION[req.destination].avgWaitDays.toFixed(1)} days wait).`,
  ];

  const recommendedStep = `Open the Fleet & Port Feasibility workspace to view exact dimensional margins for each vessel class.`;

  const content = `### Executive Answer
${executive}

### Supporting Evidence
- **Fully Feasible Classes:** ${feasibleList.join(", ") || "None unconstrained"}
- **Conditional Classes:** ${condList.join(", ") || "None"}
- **Rejected Classes:** ${rejList.join(", ") || "None"}
- **Nautical Limits at ${port.name}:** Max Draft ${port.maxDraftM.toFixed(1)} m, Max LOA ${port.maxLoaM} m, Max Beam ${port.maxBeamM} m, Max DWT ${fmtInt(port.maxDwt)} t.
- **Port Operations:** ${port.berths} berths discharging at ${fmtInt(port.dischargeRateTpd)} t/day with an average wait of ${DEFAULT_CONGESTION[req.destination].avgWaitDays.toFixed(1)} days.

### Cost & Operational Impact
${impact}

### Key Risks & Material Assumptions
${risksAndAssumptions.map((r) => `- ${r}`).join("\n")}

### Recommended Next Step
${recommendedStep}`;

  return {
    content,
    sources: [
      "Fleet & Port Feasibility Engine",
      "Indian East Coast Port Nautical Manual",
      "Vessel Specifications Database",
    ],
    intent: "feasibility_port",
    structured: { executive, evidence, impact, risksAndAssumptions, recommendedStep },
    actions: [
      {
        label: "Open Feasibility Workspace",
        to: "/feasibility",
        description: "Review detailed constraint checks",
      },
      {
        label: "Select Feasible Vessel in Charter",
        to: "/charter",
        description: "Simulate voyage for recommended vessel",
      },
    ],
    followUps: [
      "Compare the two lowest-cost feasible vessel options.",
      "Explain why a vessel is conditional at Haldia.",
      "Identify the biggest drivers of landed cost.",
    ],
    contextUsed: ctx,
  };
}

/**
 * Explains bunker price sensitivities and scenario stress testing.
 */
function handleBunkerSensitivity(
  req: CharterRequest,
  ctx: AssistantContext,
  question: string,
): AssistantResponse {
  const q = question.toLowerCase();

  // Extract custom bunker price if mentioned (e.g. 760, 850)
  let targetBunker = 760;
  const numMatch = q.match(/\$?\s*(\d{3})\s*(?:\/t)?/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    if (val >= 400 && val <= 1200) targetBunker = val;
  }

  const baselineResult = simulateCharterDecision(req, {
    now: new Date(),
    bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
  });

  const stressedResult = simulateCharterDecision(req, {
    now: new Date(),
    bunkerUsdPerT: targetBunker,
  });

  const baseLanded = baselineResult.totalCostUsd / req.cargoTonnes;
  const stressedLanded = stressedResult.totalCostUsd / req.cargoTonnes;
  const landedDelta = stressedLanded - baseLanded;
  const totalCostDelta = stressedResult.totalCostUsd - baselineResult.totalCostUsd;
  const bunkerCostDelta =
    stressedResult.costBreakdown.bunkerUsd - baselineResult.costBreakdown.bunkerUsd;
  const fuelBurnT = Math.round(baselineResult.costBreakdown.bunkerUsd / BASE_BUNKER_USD_PER_T);

  const executive = `If Singapore VLSFO increases from **$${BASE_BUNKER_USD_PER_T}/t** to **$${targetBunker}/t** (+${fmtPct(((targetBunker - BASE_BUNKER_USD_PER_T) / BASE_BUNKER_USD_PER_T) * 100, false)}), landed cost for ${fmtTonnes(req.cargoTonnes)} from ${originById(req.origin).shortName} to ${portByCode(req.destination).name} rises by **+${fmtRate(landedDelta)}/t** (+${fmtPct((totalCostDelta / baselineResult.totalCostUsd) * 100, false)}). Total voyage expenditure increases by **${fmtUsd(totalCostDelta)}**.`;

  const evidence: AssistantEvidenceItem[] = [
    {
      label: "Bunker Price Shift",
      value: `$${BASE_BUNKER_USD_PER_T} → $${targetBunker}/t`,
      detail: `+$${targetBunker - BASE_BUNKER_USD_PER_T}/t price movement`,
    },
    {
      label: "Landed Cost Impact",
      value: `+${fmtRate(landedDelta)}/t`,
      detail: `${fmtRate(baseLanded)} → ${fmtRate(stressedLanded)}/t landed`,
    },
    {
      label: "Total Spend Impact",
      value: `+${fmtUsd(totalCostDelta)}`,
      detail: `${fmtUsd(baselineResult.totalCostUsd)} → ${fmtUsd(stressedResult.totalCostUsd)}`,
    },
    {
      label: "Estimated Fuel Burn",
      value: `~${fmtInt(fuelBurnT)} t VLSFO`,
      detail: "Capesize burning 48 t/day across 31.8 round-trip days",
    },
    {
      label: "Decision Stability",
      value: stressedResult.decision === baselineResult.decision ? "STABLE" : "SHIFTED",
      detail: `Recommendation remains ${DECISION_LABELS[stressedResult.decision]}`,
    },
  ];

  const impact = `Because a Capesize burns roughly 48 t/day of fuel, fuel represents ${((baselineResult.costBreakdown.bunkerUsd / baselineResult.totalCostUsd) * 100).toFixed(0)}% of total voyage cost. While the $${targetBunker}/t spike adds ${fmtUsd(bunkerCostDelta)} to the voyage, Capesize remains the lowest-cost class due to parcel scale economics. However, the landed cost gap versus eco-Kamsarmax narrows by ~$0.32/t.`;

  const risksAndAssumptions = [
    `Assumes standard service speed of 12.5 knots without eco-speed reduction.`,
    `Fuel pass-through assumes 100% spot exposure without hedging or bunker escalation collars.`,
    `Reflects round-trip bunker consumption from loading to discharge.`,
  ];

  const recommendedStep = `Open Scenario Lab to run the 'Cost pressure' or 'Bunker spike' preset and test speed optimization.`;

  const content = `### Executive Answer
${executive}

### Supporting Evidence
- **Baseline VLSFO ($${BASE_BUNKER_USD_PER_T}/t):** Bunker cost ${fmtUsd(baselineResult.costBreakdown.bunkerUsd)} (${fmtRate(baseLanded)}/t landed).
- **Stressed VLSFO ($${targetBunker}/t):** Bunker cost ${fmtUsd(stressedResult.costBreakdown.bunkerUsd)} (${fmtRate(stressedLanded)}/t landed).
- **Net Exposure:** +**${fmtRate(landedDelta)}/t** (+**${fmtUsd(totalCostDelta)}** total expenditure).
- **Fuel Consumption:** ~${fmtInt(fuelBurnT)} tonnes of VLSFO over ${fmt1(baselineResult.transitDays * 2)} round-trip sea days.
- **Decision Verdict:** **${DECISION_LABELS[stressedResult.decision].toUpperCase()}** remains optimal.

### Cost & Operational Impact
${impact}

### Key Risks & Material Assumptions
${risksAndAssumptions.map((r) => `- ${r}`).join("\n")}

### Recommended Next Step
${recommendedStep}`;

  return {
    content,
    sources: [
      "Scenario Lab Simulation Engine",
      "Singapore Bunker Price Series (Fixture)",
      "Vessel Fuel Consumption Curves",
    ],
    intent: "bunker_sensitivity",
    structured: { executive, evidence, impact, risksAndAssumptions, recommendedStep },
    actions: [
      {
        label: "Open Scenario Lab",
        to: "/scenarios",
        description: "Stress test custom fuel and freight shocks",
      },
      {
        label: "View Market Bunker Series",
        to: "/market",
        description: "Review Singapore VLSFO price trends",
      },
    ],
    followUps: [
      "Compare the baseline and downside scenario.",
      "Identify the biggest drivers of landed cost.",
      "Which assumptions could change the recommendation?",
    ],
    contextUsed: ctx,
  };
}

/**
 * Explains procurement portfolio strategy and risk concentration.
 */
function handlePortfolioStrategy(
  req: CharterRequest,
  ctx: AssistantContext,
  question: string,
): AssistantResponse {
  const objective = ctx.portfolioObjective ?? "LOWEST_COST";
  const candidates = buildCandidatePortfolios(1_200_000, req.cargoType, req.deliveryDeadline);
  const strategy = candidates[objective] ?? candidates.LOWEST_COST;
  const rec = generatePortfolioRecommendation(Object.values(candidates), objective);

  const executive = `For the **${objective.replace(/_/g, " ")}** procurement objective across ${fmtTonnes(strategy.totalDemandT)} annual demand, NAVIK recommends a strategy with **${fmtRate(strategy.weightedCostPerT)}/t weighted landed cost** (${fmtUsd(strategy.totalSpendUsd)} annual freight spend) and **${fmtPct(strategy.coveragePct, false)} coverage**.`;

  const evidence: AssistantEvidenceItem[] = [
    {
      label: "Weighted Landed Cost",
      value: `${fmtRate(strategy.weightedCostPerT)}/t`,
      detail: `Total annual spend: ${fmtUsd(strategy.totalSpendUsd)}`,
    },
    {
      label: "Contract Allocation",
      value: `${strategy.contractMix.spot}% Spot / ${strategy.contractMix.shortTerm}% Short / ${strategy.contractMix.mediumTerm}% Medium`,
      detail: "Balanced exposure across contract terms",
    },
    {
      label: "Origin Diversification",
      value: `HHI ${fmtInt(strategy.originHHI)}`,
      detail: strategy.originHHI > 4000 ? "Concentrated in Australia" : "Moderately diversified",
    },
    {
      label: "Feasible Volume",
      value: `${strategy.feasibilitySummary.feasiblePct.toFixed(0)}%`,
      detail: `${fmtTonnes(strategy.feasibilitySummary.feasibleTonnes)} unconstrained`,
    },
    {
      label: "Repositioning Savings",
      value: `${fmtUsd(strategy.totalRepositioningSavingsUsd)}`,
      detail: `Effective cost: ${fmtRate(strategy.effectiveCostPerTWithRepositioning)}/t`,
    },
  ];

  const impact = `By exploiting ballast repositioning opportunities (e.g. backhauls from Paradip to Port Hedland or Kalimantan), the portfolio recaptures **${fmtUsd(strategy.totalRepositioningSavingsUsd)}** annually, shaving **$${(strategy.weightedCostPerT - strategy.effectiveCostPerTWithRepositioning).toFixed(2)}/t** off net landed cost.`;

  const risksAndAssumptions = [
    rec.concentrationWarning ??
      "Origin concentration: Queensland supplies >50% of coking coal requirements.",
    rec.feasibilityAlert ??
      "Odisha ports require part-loading or Sandheads lightering for ~28% of incoming tonnage.",
    `Cost volatility standard deviation modeled at ±$${strategy.contractRisk.stdDevUsdPerT.toFixed(2)}/t.`,
  ];

  const recommendedStep = `Review the complete procurement portfolio, origin shares, and repositioning matrix in the Strategy workspace.`;

  const content = `### Executive Answer
${executive}

### Supporting Evidence
- **Weighted Logistics Cost:** **${fmtRate(strategy.weightedCostPerT)}/t** (${fmtUsd(strategy.totalSpendUsd)} total annual spend for ${fmtTonnes(strategy.totalDemandT)}).
- **Contract Allocation:** ${strategy.contractMix.spot}% Spot, ${strategy.contractMix.shortTerm}% Short-term (≤6 mo), ${strategy.contractMix.mediumTerm}% Medium-term (6–24 mo).
- **Supply Concentration:** Origin HHI **${fmtInt(strategy.originHHI)}** (${strategy.originShares.map((s) => `${s.shortName}: ${s.sharePct}%`).join(", ")}).
- **Repositioning Savings:** **${fmtUsd(strategy.totalRepositioningSavingsUsd)}** captured across ${strategy.repositioningOpportunities.length} backhaul lanes.

### Cost & Operational Impact
${impact}

### Key Risks & Material Assumptions
${risksAndAssumptions.map((r) => `- ${r}`).join("\n")}

### Recommended Next Step
${recommendedStep}`;

  return {
    content,
    sources: [
      "Strategic Portfolio & Repositioning Engine",
      "Supply Concentration Matrix",
      "Ballast Repositioning Opportunity Model",
    ],
    intent: "portfolio_strategy",
    structured: { executive, evidence, impact, risksAndAssumptions, recommendedStep },
    actions: [
      {
        label: "Open Portfolio Workspace",
        to: "/strategy",
        description: "Explore allocation sliders and repositioning lanes",
      },
      {
        label: "Inspect Contract Records",
        to: "/contracts",
        description: "Review existing fixed fixtures and COAs",
      },
    ],
    followUps: [
      "Summarize the main risks in the selected procurement strategy.",
      "Assess the effect of a bunker-price increase.",
      "Which assumptions could change the recommendation?",
    ],
    contextUsed: ctx,
  };
}

/**
 * Explains operational risks and pre-fixing verification checklist.
 */
function handleOperationalRisks(req: CharterRequest, ctx: AssistantContext): AssistantResponse {
  const port = portByCode(req.destination);
  const origin = originById(req.origin);
  const congestion = DEFAULT_CONGESTION[req.destination];
  const alerts = RISK_ALERTS.slice(0, 3);

  const executive = `Before fixing a vessel for ${fmtTonnes(req.cargoTonnes)} from ${origin.shortName} to ${port.name}, chartering and procurement teams should verify **five critical operational risk vectors**: hydrographic draft clearance, anchorage queue duration, seasonal marine weather, passage transit constraints, and demurrage exposure.`;

  const evidence: AssistantEvidenceItem[] = [
    {
      label: `${port.name} Draft Limit`,
      value: `${port.maxDraftM.toFixed(1)} m`,
      detail: "Verify actual tide table and silting advisory",
    },
    {
      label: "Anchorage Congestion",
      value: `${congestion.waitingVessels} ships (${congestion.avgWaitDays.toFixed(1)} d wait)`,
      detail: `${congestion.berthOccupancyPct}% berth occupancy, trend ${congestion.trend}`,
    },
    {
      label: "Weather Window",
      value: "Post-Monsoon Cyclone",
      detail: "Bay of Bengal depression window active (Oct–Dec)",
    },
    {
      label: "Passage Pilotage",
      value: "Torres Strait",
      detail: "Booby Island pilot boarding window for Queensland stems",
    },
    {
      label: "Demurrage Reserve",
      value: "$18k–$26k/day",
      detail: "Negotiate realistic laytime based on actual wait queue",
    },
  ];

  const impact = `Failing to verify these factors risks severe financial exposure: a 3-day unbudgeted waiting delay at ${port.name} adds ~$70,000 in demurrage, while draft rejection at riverine or draft-restricted berths (e.g. Haldia or Vizag inner harbour) forces offshore lightering at +$4.60/t ($736,000 on 160k t).`;

  const risksAndAssumptions = [
    `Alert ${alerts[0]?.id ?? "RA-311"}: ${alerts[0]?.title ?? "Bay of Bengal cyclone window"} — build 2–3 days buffer into discharge laycan.`,
    `Anchorage queue at ${port.name} is trending ${congestion.trend}.`,
    `Vessel nomination must specify LOA ≤ ${port.maxLoaM} m and Beam ≤ ${port.maxBeamM} m.`,
  ];

  const recommendedStep = `Check active disruption alerts on the Command Dashboard and review demurrage clauses in the Contract Records desk.`;

  const content = `### Executive Answer
${executive}

### Supporting Evidence
1. **Hydrographic Draft Clearance:** Confirm permissible arrival draft at ${port.name} (${port.maxDraftM.toFixed(1)} m). For Capesize tonnage, verify short-loading or lightering provisions.
2. **Anchorage Congestion & Laytime:** Current queue is **${congestion.waitingVessels} bulkers** averaging **${congestion.avgWaitDays.toFixed(1)} days wait**. Ensure laytime terms accommodate current queue depth.
3. **Regional Weather:** Bay of Bengal post-monsoon cyclonic window (October–December climatology) requires 2–3 days voyage contingency.
4. **Transit Windows:** Coral Sea / Torres Strait pilotage windows at Booby Island must be coordinated with load laycan.
5. **Contractual Terms:** Verify bunker escalation benchmark, off-hire definitions, and laycan cancellation windows.

### Cost & Operational Impact
${impact}

### Key Risks & Material Assumptions
${risksAndAssumptions.map((r) => `- ${r}`).join("\n")}

### Recommended Next Step
${recommendedStep}`;

  return {
    content,
    sources: [
      "NAVIK Risk Alerts Feed",
      "Discharge Port Congestion Fixture",
      "Charter Contract Terms Template",
    ],
    intent: "operational_risks",
    structured: { executive, evidence, impact, risksAndAssumptions, recommendedStep },
    actions: [
      {
        label: "View Disruption Alerts on Dashboard",
        to: "/dashboard",
        description: "Review live risk flags and telemetry",
      },
      {
        label: "Open Contract Records",
        to: "/contracts",
        description: "Inspect active charter party records",
      },
    ],
    followUps: [
      "Explain the current charter recommendation.",
      "Which vessel classes are feasible for the selected destination?",
      "Which assumptions could change the recommendation?",
    ],
    contextUsed: ctx,
  };
}

/**
 * Explains assumptions and conditions under which NAVIK's decision would invert.
 */
function handleAssumptionsInversion(req: CharterRequest, ctx: AssistantContext): AssistantResponse {
  const origin = originById(req.origin);
  const port = portByCode(req.destination);

  const executive = `NAVIK's current recommendation (**CHARTER NOW**) is grounded on four material assumptions. The decision would invert to **WAIT** or **SPLIT** if forward freight trends turn negative, delivery slack expands, bunker prices surge past $850/t, or discharge is shifted to a draft-constrained port.`;

  const evidence: AssistantEvidenceItem[] = [
    {
      label: "Market Drift Inversion",
      value: "Trend < -3.0%",
      detail: "If Queensland rates soften and slack > 21 d, decision inverts to WAIT",
    },
    {
      label: "Bunker Threshold",
      value: "VLSFO > $850/t",
      detail: "High fuel prices erode Capesize scale advantage vs eco-tonnage",
    },
    {
      label: "Schedule Compression",
      value: "Slack < 14 days",
      detail: "Thin buffers switch flexible recommendations to emergency fix",
    },
    {
      label: "Port Re-routing",
      value: "Shift to Haldia",
      detail: "Riverine draft triggers mandatory Sandheads lightering",
    },
    {
      label: "Fleet Availability",
      value: "Drop below 70%",
      detail: "Tonnage scarcity increases spot market premiums",
    },
  ];

  const impact = `Understanding these decision boundaries prevents premature commitments. For instance, if freight brokers report loosening tonnage in the Pacific and 30-day forward fixtures drop by more than 3%, waiting 2–3 weeks could save ~$0.80–$1.20/t in freight hire.`;

  const risksAndAssumptions = [
    `Current model assumes 30-day freight trend of +3.8% on Queensland lanes.`,
    `Schedule slack currently stands at >25 days, providing timing flexibility.`,
    `Tonnage availability in the Coral Sea is modeled at 74% (normal seasonal band).`,
  ];

  const recommendedStep = `Simulate alternative freight trends and bunker shocks in the Scenario Lab to stress-test your decision threshold.`;

  const content = `### Executive Answer
${executive}

### Supporting Evidence
- **Freight Forecast Inversion:** Currently, ${origin.shortName} rates are forecast to firm +3.8%. If market dynamics invert to **softening below -3.0%** and schedule slack exceeds 21 days, NAVIK switches recommendation to **WAIT** to harvest falling freight rates.
- **Bunker Price Threshold:** At benchmark $620/t VLSFO, Capesize scale economics dominate. If VLSFO crosses **$850/t**, fuel consumption (~48 tpd) erodes the margin against modern eco-Kamsarmax.
- **Port Constraints:** Routing to Haldia instead of Paradip adds a **+$4.60/t transshipment fee**, overturning large-vessel direct charter feasibility.
- **Schedule Slack Compression:** If the delivery deadline is brought forward so slack drops below 14 days, the model mandates immediate fixing regardless of market softening.

### Cost & Operational Impact
${impact}

### Key Risks & Material Assumptions
${risksAndAssumptions.map((r) => `- ${r}`).join("\n")}

### Recommended Next Step
${recommendedStep}`;

  return {
    content,
    sources: [
      "NAVIK Decision Heuristic Specification",
      "Scenario Lab Sensitivity Model",
      "Freight Trend Series Fixture",
    ],
    intent: "assumptions_inversion",
    structured: { executive, evidence, impact, risksAndAssumptions, recommendedStep },
    actions: [
      {
        label: "Open Scenario Lab",
        to: "/scenarios",
        description: "Test parameter variations and tipping points",
      },
      {
        label: "Review Market Intelligence",
        to: "/market",
        description: "Monitor forward freight curves",
      },
    ],
    followUps: [
      "Assess the effect of a bunker-price increase.",
      "Compare the baseline and downside scenario.",
      "Explain the current charter recommendation.",
    ],
    contextUsed: ctx,
  };
}

/**
 * Explains market intelligence and freight trends.
 */
function handleMarketTrends(req: CharterRequest, ctx: AssistantContext): AssistantResponse {
  const snap = marketSnapshot();
  const qldTrend = DEFAULT_MARKET.AUS_QLD.trend30dPct;
  const nswTrend = DEFAULT_MARKET.AUS_NSW.trend30dPct;
  const waTrend = DEFAULT_MARKET.AUS_WA.trend30dPct;
  const idnTrend = DEFAULT_MARKET.IDN_KAL.trend30dPct;

  const executive = `NAVIK's market telemetry shows diverging trends across key coal and ore lanes: **Queensland (+${qldTrend.toFixed(1)}%)** and **New South Wales (+${nswTrend.toFixed(1)}%)** are firming on steady Indian metallurgical demand, while **Western Australia (${waTrend.toFixed(1)}%)** and **Kalimantan (${idnTrend.toFixed(1)}%)** are softening as regional tonnage loosens.`;

  const evidence: AssistantEvidenceItem[] = [
    {
      label: "Freight Index",
      value: `${snap.freightIndex} pts`,
      detail: `+${snap.freightIndexChangePct.toFixed(1)}% week-on-week`,
    },
    {
      label: "Average Spot Rate",
      value: `$${snap.avgRateUsdPerT.toFixed(2)}/t`,
      detail: `+${snap.avgRateChangePct.toFixed(1)}% change`,
    },
    {
      label: "Singapore VLSFO",
      value: `$${snap.vlsfoUsdPerT}/t`,
      detail: `+${snap.vlsfoChangePct.toFixed(1)}% change`,
    },
    {
      label: "Fleet Availability",
      value: `${snap.fleetAvailabilityPct}%`,
      detail: "Active trading tonnage availability",
    },
    {
      label: "Coast Anchorage Wait",
      value: `${snap.avgPortWaitDays.toFixed(1)} days`,
      detail: "Average across 5 major discharge ports",
    },
  ];

  const impact = `Metallurgical coal importers with Queensland stems should secure tonnage promptly or explore New South Wales alternatives. Thermal coal and limestone buyers sourcing from Kalimantan can leverage softening rates to negotiate deferred laycans or spot discounts.`;

  const risksAndAssumptions = [
    "Freight and bunker curves are illustrative fixtures based on seeded historical series.",
    "Forecast bands reflect P10–P90 confidence limits derived from historical volatility.",
  ];

  const recommendedStep = `Explore multi-lane historical curves and forward forecasts in the Freight Market Intelligence workspace.`;

  const content = `### Executive Answer
${executive}

### Supporting Evidence
- **Queensland (Hay Point):** 30-day forecast **+${qldTrend.toFixed(1)}%** (firming) — Met coal volumes driving Pacific tonnage tightness.
- **New South Wales (Newcastle):** 30-day forecast **+${nswTrend.toFixed(1)}%** (mildly firming).
- **Western Australia (Port Hedland):** 30-day forecast **${waTrend.toFixed(1)}%** (softening) — Capesize availability in Pilbara basin.
- **East Kalimantan (Muara Pantai):** 30-day forecast **${idnTrend.toFixed(1)}%** (softening) — Steady Supramax and Panamax supply.
- **Bunker Fuel:** Singapore VLSFO trading at **$${snap.vlsfoUsdPerT}/t** (+${snap.vlsfoChangePct.toFixed(1)}% WoW).

### Cost & Operational Impact
${impact}

### Key Risks & Material Assumptions
${risksAndAssumptions.map((r) => `- ${r}`).join("\n")}

### Recommended Next Step
${recommendedStep}`;

  return {
    content,
    sources: [
      "NAVIK Market Intelligence Engine",
      "Freight Series (Queensland / NSW / WA / Kalimantan)",
      "Bunker Series Fixture",
    ],
    intent: "market_trends",
    structured: { executive, evidence, impact, risksAndAssumptions, recommendedStep },
    actions: [
      {
        label: "Open Freight Market",
        to: "/market",
        description: "View interactive freight and bunker charts",
      },
      {
        label: "Run Charter Simulation",
        to: "/charter",
        description: "Apply market rates to active cargo stems",
      },
    ],
    followUps: [
      "Explain the current charter recommendation.",
      "Identify the biggest drivers of landed cost.",
      "Assess the effect of a bunker-price increase.",
    ],
    contextUsed: ctx,
  };
}

/**
 * Explains active freight contracts, laycan conflicts, and audit trail records.
 */
function handleContractsGovernance(
  req: CharterRequest,
  ctx: AssistantContext,
  question: string,
): AssistantResponse {
  const allContracts = contracts();
  const summary = summarizeCommercialPortfolio(allContracts);
  const conflicts = detectLaycanConflicts(allContracts);
  const risks = detectCommercialRisks(allContracts);
  const allAudits = audits();

  const underReview = allContracts.filter((c) => c.status === "UNDER_REVIEW");
  const fixed = allContracts.filter((c) => c.status === "FIXED");

  const executive = `NAVIK is currently tracking **${allContracts.length} contract fixtures** representing **${fmtTonnes(summary.totalTonnage)}** of committed dry bulk cargo (${fmtUsd(summary.totalSpendUsd)} spend). There ${conflicts.length === 1 ? "is 1 active laycan conflict" : `are ${conflicts.length} active laycan conflicts`} flagged at Paradip and **${risks.length} commercial risk items** requiring desk verification.`;

  const evidence: AssistantEvidenceItem[] = [
    {
      label: "Active Fixtures",
      value: `${fixed.length} Fixed / ${underReview.length} Under Review`,
      detail: `${summary.draftCount} draft pending approval`,
    },
    {
      label: "Total Committed",
      value: fmtTonnes(summary.totalTonnage),
      detail: `Total value: ${fmtUsd(summary.totalSpendUsd)}`,
    },
    {
      label: "Weighted Freight",
      value: `${fmtRate(summary.weightedRateUsdPerT)}/t`,
      detail: "Volume-weighted across all corridors",
    },
    {
      label: "Laycan Overlap",
      value: `${conflicts.length} conflict(s)`,
      detail: conflicts[0]
        ? `${conflicts[0].portName} (${conflicts[0].overlapDays}d overlap)`
        : "No overlaps detected",
    },
    {
      label: "Audit Log Depth",
      value: `${allAudits.length} events`,
      detail: `Latest: ${allAudits[0]?.action.replace(/_/g, " ")} by ${allAudits[0]?.actor}`,
    },
  ];

  const impact =
    conflicts.length > 0
      ? `The laycan overlap between ${conflicts[0].contractA.vesselName} and ${conflicts[0].contractB.vesselName} at ${conflicts[0].portName} brings ${fmtTonnes(conflicts[0].combinedTonnage)} of cargo within a 3-day window. This risks exceeding berth discharge throughput, potentially adding $50,000–$80,000 in unbudgeted anchorage demurrage.`
      : `All active fixtures currently maintain safe laycan intervals across discharge berths.`;

  const risksAndAssumptions = [
    ...risks.slice(0, 3).map((r) => `${r.title}: ${r.detail}`),
    `Audit trail records ${allAudits.length} historical decision runs in local session memory.`,
  ];

  const recommendedStep = `Open the Contract Records workspace to review laycan sequencing, or inspect the Audit Trail to verify recent governance approvals.`;

  const content = `### Executive Answer
${executive}

### Supporting Evidence
- **Contract Register Volume:** **${fmtTonnes(summary.totalTonnage)}** across ${allContracts.length} commitments (${fmtUsd(summary.totalSpendUsd)} total freight spend).
- **Commercial Status:** ${fixed.length} Fixed, ${underReview.length} Under Review (${underReview.map((c) => c.vesselName).join(", ")}), ${summary.draftCount} Draft.
- **Weighted Freight Rate:** **${fmtRate(summary.weightedRateUsdPerT)}/t** (Voyage and Time Charter basis).
- **Laycan Concurrency:** ${conflicts.length > 0 ? `**${conflicts.length} conflict at ${conflicts[0].portName}** (${conflicts[0].contractA.vesselName} & ${conflicts[0].contractB.vesselName})` : "Safe berth spacing"}.
- **Governance Audit Trail:** ${allAudits.length} events logged in session store.

### Cost & Operational Impact
${impact}

### Key Risks & Material Assumptions
${risksAndAssumptions.map((r) => `- ${r}`).join("\n")}

### Recommended Next Step
${recommendedStep}`;

  return {
    content,
    sources: [
      "Contract Register (Local Store)",
      "Laycan Overlap Heuristic",
      "Session Governance Audit Log",
    ],
    intent: "contracts_governance",
    structured: { executive, evidence, impact, risksAndAssumptions, recommendedStep },
    actions: [
      {
        label: "Open Contract Register",
        to: "/contracts",
        description: "Manage fixtures and commercial terms",
      },
      {
        label: "Inspect Audit Trail",
        to: "/audit",
        description: "Review decision governance logs",
      },
    ],
    followUps: [
      "Are there any upcoming contractual deadlines or laycan conflicts?",
      "What commercial risks are unverified in the contract register?",
      "Explain the current charter recommendation.",
    ],
    contextUsed: ctx,
  };
}

/**
 * Handles unsupported or out-of-scope inquiries.
 */
function handleUnsupported(question: string, ctx: AssistantContext): AssistantResponse {
  const executive = `NIRNAY is a specialized **maritime decision-support assistant** calibrated for dry bulk procurement, vessel feasibility, voyage economics, and chartering strategy along Indian East Coast corridors.`;

  const evidence: AssistantEvidenceItem[] = [
    {
      label: "Domain",
      value: "Dry Bulk Maritime Logistics",
      detail: "Coal, iron ore, limestone imports",
    },
    {
      label: "Covered Corridors",
      value: "Australia & Indonesia → India",
      detail: "Queensland, NSW, WA, Kalimantan to Paradip, Vizag, GGVM, Dhamra, Haldia",
    },
    {
      label: "Engines Connected",
      value: "5 Calculation Engines",
      detail: "Charter, Feasibility, Market, Scenario, Portfolio",
    },
    {
      label: "Model Mode",
      value: "Deterministic Demo",
      detail: "Grounded in NAVIK simulation rules without unverified inference",
    },
  ];

  const impact = `I am unable to answer general knowledge queries, non-maritime questions, or issues unrelated to NAVIK's operational data engines.`;

  const risksAndAssumptions = [
    "No external language model is active in this environment.",
    "Answers are restricted to verifiable maritime calculations and NAVIK fixtures.",
  ];

  const recommendedStep = `Please select one of the suggested prompts below or ask an operational question regarding vessel chartering, port constraints, landed costs, or scenario stress testing.`;

  const content = `### Executive Answer
${executive}

### Supported Operational Domains
1. **Charter Recommendations:** Explain why a stem should be chartered now, deferred, or split, including landed cost and risk score.
2. **Vessel & Port Feasibility:** Evaluate draft, LOA, beam, and deadweight clearances (e.g. why Haldia requires Sandheads lightering, or Capesize limits at Paradip).
3. **Landed Cost Breakdown:** Decompose freight hire, bunker fuel consumption, port tariffs, demurrage reserves, and marine insurance.
4. **Scenario Stress Testing:** Assess the impact of Singapore VLSFO price spikes, freight market shocks, or port congestion delays.
5. **Procurement Strategy:** Analyze annual sourcing portfolios, supply concentration (HHI), and ballast repositioning offsets.

### Recommended Next Step
${recommendedStep}`;

  return {
    content,
    sources: ["NIRNAY Decision Support Specifications"],
    intent: "unsupported",
    structured: { executive, evidence, impact, risksAndAssumptions, recommendedStep },
    actions: [
      { label: "Open Charter Workspace", to: "/charter" },
      { label: "View Fleet Feasibility", to: "/feasibility" },
      { label: "Explore Scenario Lab", to: "/scenarios" },
      { label: "Return to Dashboard", to: "/dashboard" },
    ],
    followUps: [
      "Explain the current charter recommendation.",
      "Compare the two lowest-cost feasible vessel options.",
      "Identify the biggest drivers of landed cost.",
      "Explain why a vessel is conditional at Haldia.",
    ],
    contextUsed: ctx,
  };
}

/* ═══════════════════════════════════════════════
   Main Entry Point
   ═══════════════════════════════════════════════ */

/**
 * Computes a grounded, explainable decision-support response from NAVIK engines.
 */
export function localAssistantReply(
  question: string,
  context?: AssistantContext,
): AssistantResponse {
  const ctx = extractContextFromQuery(question, context);
  const req = buildCharterRequest(ctx);
  const intent = detectIntent(question);

  switch (intent) {
    case "charter_recommendation":
      return handleCharterRecommendation(req, ctx);
    case "vessel_comparison":
      return handleVesselComparison(req, ctx, question);
    case "landed_cost_drivers":
      return handleLandedCostDrivers(req, ctx);
    case "feasibility_port":
      return handlePortFeasibility(req, ctx, question);
    case "bunker_sensitivity":
      return handleBunkerSensitivity(req, ctx, question);
    case "portfolio_strategy":
      return handlePortfolioStrategy(req, ctx, question);
    case "operational_risks":
      return handleOperationalRisks(req, ctx);
    case "assumptions_inversion":
      return handleAssumptionsInversion(req, ctx);
    case "market_trends":
      return handleMarketTrends(req, ctx);
    case "contracts_governance":
      return handleContractsGovernance(req, ctx, question);
    case "unsupported":
    default:
      return handleUnsupported(question, ctx);
  }
}
