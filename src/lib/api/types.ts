/**
 * NAVIK API contract types.
 *
 * These mirror the shapes the Python backend is expected to return.
 * Keep them in sync with the backend's response schemas when wiring live mode.
 */

export type ApiMode = "demo" | "live";

/** Every payload carries provenance so the UI can be honest about where data came from. */
export interface Provenance {
  source: ApiMode;
  /** Human label, e.g. "Illustrative fixture" or "NAVIK forecast service v2". */
  label: string;
  /** ISO timestamp the data represents. */
  asOf: string;
}

export type OriginRegion = "AUS_QLD" | "AUS_NSW" | "AUS_WA" | "IDN_KAL";
export type PortCode = "PRDP" | "VIZG" | "GGVM" | "DHMR" | "HLDA";
export type CargoType = "COKING_COAL" | "THERMAL_COAL" | "IRON_ORE" | "LIMESTONE";
export type ContractPreference = "SPOT" | "SHORT_TERM" | "MEDIUM_TERM" | "FLEXIBLE";
export type Decision = "CHARTER_NOW" | "WAIT" | "SPLIT";
export type RiskLevel = "LOW" | "MODERATE" | "ELEVATED" | "HIGH";
export type VesselClassId =
  "SUPRAMAX" | "ULTRAMAX" | "PANAMAX" | "KAMSARMAX" | "CAPESIZE" | "NEWCASTLEMAX";
export type FeasibilityStatus = "FEASIBLE" | "CONDITIONAL" | "REJECTED";
export type Timeframe = "3M" | "6M" | "1Y" | "2Y";
export type Trend = "up" | "down" | "flat";

/* ---------- Reference data ---------- */

export interface OriginProfile {
  id: OriginRegion;
  name: string;
  shortName: string;
  loadPort: string;
  lon: number;
  lat: number;
}

export interface PortProfile {
  code: PortCode;
  name: string;
  state: string;
  lon: number;
  lat: number;
  maxDraftM: number;
  maxLoaM: number;
  maxBeamM: number;
  maxDwt: number;
  berths: number;
  dischargeRateTpd: number;
  portDuesUsdPerT: number;
  notes: string;
}

export interface VesselClassSpec {
  id: VesselClassId;
  name: string;
  dwtMin: number;
  dwtMax: number;
  loaM: number;
  beamM: number;
  ladenDraftM: number;
  serviceSpeedKn: number;
  dailyHireUsd: number;
  fuelTpd: number;
  availabilityPct: number;
}

/* ---------- Market ---------- */

export interface FreightPoint {
  date: string;
  /** USD per tonne, voyage basis */
  rate: number;
  forecast?: boolean;
  p10?: number;
  p90?: number;
}

export interface BunkerPoint {
  date: string;
  vlsfo: number;
  hsfo: number;
}

export interface CongestionIndicator {
  port: PortCode;
  waitingVessels: number;
  avgWaitDays: number;
  berthOccupancyPct: number;
  trend: Trend;
}

export interface FreightSeries {
  origin: OriginRegion;
  timeframe: Timeframe;
  points: FreightPoint[];
  changePct: number;
  provenance: Provenance;
}

export interface BunkerSeries {
  timeframe: Timeframe;
  points: BunkerPoint[];
  provenance: Provenance;
}

export interface MarketSnapshot {
  freightIndex: number;
  freightIndexChangePct: number;
  avgRateUsdPerT: number;
  avgRateChangePct: number;
  vlsfoUsdPerT: number;
  vlsfoChangePct: number;
  avgPortWaitDays: number;
  avgPortWaitChange: number;
  fleetAvailabilityPct: number;
  forecastBias: Trend;
  provenance: Provenance;
}

export interface RiskAlert {
  id: string;
  severity: RiskLevel;
  title: string;
  detail: string;
  region: string;
  issuedAt: string;
}

export interface RecentDecision {
  id: string;
  createdAt: string;
  cargoTonnes: number;
  cargoType: CargoType;
  origin: OriginRegion;
  destination: PortCode;
  decision: Decision;
  vesselClass: VesselClassId;
  rateUsdPerT: number;
  confidence: number;
}

export interface CongestionReport {
  ports: CongestionIndicator[];
  provenance: Provenance;
}

export interface DashboardBundle {
  snapshot: MarketSnapshot;
  alerts: RiskAlert[];
  recent: RecentDecision[];
  provenance: Provenance;
}

/* ---------- Charter decision ---------- */

export interface CharterRequest {
  cargoTonnes: number;
  cargoType: CargoType;
  origin: OriginRegion;
  destination: PortCode;
  /** ISO date (yyyy-mm-dd) */
  deliveryDeadline: string;
  contractPreference: ContractPreference;
}

export type PipelineStageId = "forecast" | "risk" | "feasibility" | "cost" | "optimize";

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  summary: string;
}

export interface VesselCheck {
  vesselClass: VesselClassId;
  status: FeasibilityStatus;
  reasons: string[];
  voyages: number;
  utilisationPct: number;
  transitDays: number;
  totalCostUsd: number;
  costPerT: number;
}

export interface CostBreakdown {
  freightUsd: number;
  bunkerUsd: number;
  portDuesUsd: number;
  demurrageReserveUsd: number;
  insuranceUsd: number;
}

export interface RiskDriver {
  label: string;
  direction: "up" | "down";
  weight: number;
}

export interface CharterDecisionReport {
  requestId: string;
  request: CharterRequest;
  decision: Decision;
  headline: string;
  vesselClass: VesselClassId | null;
  routeLabel: string;
  distanceNm: number;
  transitDays: number;
  port: PortCode;
  estimatedFreightUsdPerT: number;
  forecastRange: { p10: number; p50: number; p90: number };
  totalCostUsd: number;
  costBreakdown: CostBreakdown;
  riskLevel: RiskLevel;
  riskScore: number;
  confidence: number;
  slackDays: number;
  marketTrendPct: number;
  checks: VesselCheck[];
  split: { nowPct: number; laterPct: number; rationale: string } | null;
  reasoning: string[];
  riskDrivers: RiskDriver[];
  stages: PipelineStage[];
  provenance: Provenance;
}

/* ---------- Scenario lab ---------- */

export interface ScenarioInput {
  freightShockPct: number;
  congestionDays: number;
  bunkerUsdPerT: number;
  fleetAvailabilityPct: number;
  speedDeltaKn?: number;
}

export interface ScenarioOutcome {
  freightUsdPerT: number;
  totalCostUsd: number;
  costPerT: number;
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: number;
  demurrageUsd: number;
  bunkerCostUsd: number;
  decision: Decision;
  rationale: string;
  vesselClass?: VesselClassId | null;
  vesselClassName?: string;
  transitDays?: number;
  portWaitDays?: number;
  totalDurationDays?: number;
  slackDays?: number;
  costBreakdown?: CostBreakdown;
  checks?: VesselCheck[];
  feasibleCount?: number;
  conditionalCount?: number;
  rejectedCount?: number;
}

export interface ScenarioResult {
  input: ScenarioInput;
  baseline: ScenarioOutcome;
  simulated: ScenarioOutcome;
  provenance: Provenance;
}

export interface ScenarioDiff {
  totalCostUsd: number;
  totalCostPct: number;
  costPerTUsd: number;
  costPerTPct: number;
  freightUsdPerT: number;
  bunkerUsd: number;
  bunkerPct: number;
  demurrageUsd: number;
  freightHireUsd: number;
  portDuesUsd: number;
  insuranceUsd: number;
  durationDays: number;
  riskScore: number;
}

export interface WaterfallItem {
  category: string;
  deltaUsd: number;
  percentage: number;
  direction: "up" | "down" | "flat";
  cumulativeUsd: number;
}

export interface ScenarioInsight {
  id: string;
  category: "COST" | "SCHEDULE" | "FEASIBILITY" | "DECISION" | "METHODOLOGY";
  title: string;
  detail: string;
  impact: "positive" | "negative" | "neutral" | "warning";
}

export interface VesselScenarioComparison {
  vesselClass: VesselClassId;
  name: string;
  baselineStatus: FeasibilityStatus;
  simulatedStatus: FeasibilityStatus;
  baselineCostPerT: number;
  simulatedCostPerT: number;
  costPerTDiff: number;
  statusChanged: boolean;
  baselineSelected: boolean;
  simulatedSelected: boolean;
  reasons: string[];
}

export interface ScenarioComparison {
  id: string;
  name: string;
  description?: string;
  input: ScenarioInput;
  baseline: ScenarioOutcome;
  simulated: ScenarioOutcome;
  diff: ScenarioDiff;
  waterfall: WaterfallItem[];
  insights: ScenarioInsight[];
  vesselComparisons: VesselScenarioComparison[];
}

/* ---------- Strategy & Portfolio ---------- */

export type RiskPreference = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";

export type ProcurementObjective =
  "LOWEST_COST" | "BALANCED_RESILIENCE" | "SCHEDULE_RELIABILITY" | "MINIMIZE_CONGESTION" | "CUSTOM";

export interface Allocation {
  spot: number;
  shortTerm: number;
  mediumTerm: number;
}

export interface OpportunityLane {
  id: string;
  from: string;
  to: string;
  cargo: string;
  ballastNm: number;
  idleDaysSaved: number;
  revenueOffsetUsd: number;
}

export interface PortfolioPlan {
  preference: RiskPreference;
  allocation: Allocation;
  expectedCostUsdPerT: number;
  stdDevUsdPerT: number;
  idleDaysPerQuarter: number;
  annualVolumeT: number;
  lanes: OpportunityLane[];
  provenance: Provenance;
}

export interface SourcingStem {
  id: string;
  origin: OriginRegion;
  destination: PortCode;
  tonnes: number;
  vesselClass: VesselClassId;
  contractPreference: ContractPreference;
  voyages: number;
  freightUsdPerT: number;
  landedCostPerT: number;
  totalCostUsd: number;
  transitDays: number;
  etaDays: number;
  feasibilityStatus: FeasibilityStatus;
  feasibilityReasons: string[];
  riskLevel: RiskLevel;
  riskScore: number;
  costBreakdown?: CostBreakdown;
}

export interface OriginShare {
  origin: OriginRegion;
  name: string;
  shortName: string;
  tonnes: number;
  sharePct: number;
  spendUsd: number;
}

export interface PortShare {
  port: PortCode;
  name: string;
  tonnes: number;
  sharePct: number;
  spendUsd: number;
}

export interface PortfolioStrategy {
  id: string;
  name: string;
  objective: ProcurementObjective;
  description: string;
  totalDemandT: number;
  allocatedT: number;
  coveragePct: number;
  totalSpendUsd: number;
  weightedCostPerT: number;
  totalVoyages: number;
  avgTransitDays: number;
  originHHI: number;
  portHHI: number;
  originShares: OriginShare[];
  portShares: PortShare[];
  vesselClassShares: {
    vesselClass: VesselClassId;
    name: string;
    tonnes: number;
    voyages: number;
    sharePct: number;
  }[];
  feasibilitySummary: {
    feasibleTonnes: number;
    conditionalTonnes: number;
    rejectedTonnes: number;
    feasiblePct: number;
    conditionalPct: number;
  };
  contractMix: Allocation;
  contractRisk: {
    expectedCostUsdPerT: number;
    stdDevUsdPerT: number;
    idleDaysPerQuarter: number;
  };
  repositioningOpportunities: {
    lane: OpportunityLane;
    applicableVoyages: number;
    potentialSavingsUsd: number;
  }[];
  totalRepositioningSavingsUsd: number;
  effectiveCostPerTWithRepositioning: number;
  stems: SourcingStem[];
  recommendationScore: number;
}

export interface PortfolioSensitivityPoint {
  shockLabel: string;
  shockDescription: string;
  freightShockPct: number;
  bunkerUsdPerT: number;
  congestionDays: number;
  fleetAvailabilityPct: number;
  weightedCostPerT: number;
  totalSpendUsd: number;
  costDeltaUsdPerT: number;
  costDeltaPct: number;
}

export interface PortfolioRecommendation {
  preferredStrategyId: string;
  preferredStrategyName: string;
  objective: ProcurementObjective;
  headline: string;
  primaryAdvantage: string;
  keyTradeoff: string;
  feasibilityAlert?: string;
  concentrationWarning?: string;
  sensitivityNote: string;
  decisionCriteria?: string;
  assumptionsThatCouldChangeRecommendation?: string;
}

/* ---------- Assistant ---------- */

export interface AssistantActionLink {
  label: string;
  to: string;
  description?: string;
}

export interface AssistantEvidenceItem {
  label: string;
  value: string;
  detail?: string;
}

export interface StructuredAnswer {
  executive: string;
  evidence: AssistantEvidenceItem[];
  impact: string;
  risksAndAssumptions: string[];
  recommendedStep: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: string[];
  structured?: StructuredAnswer;
  actions?: AssistantActionLink[];
  followUps?: string[];
  intent?: string;
}

/* ---------- Contracts & audit ---------- */

export type ContractType = "VOYAGE" | "TIME_CHARTER" | "COA";
export type ContractStatus = "DRAFT" | "UNDER_REVIEW" | "FIXED" | "COMPLETED";
export type VerificationStatus = "VERIFIED" | "UNVERIFIED" | "PENDING_REVIEW";

export interface DemurrageTerms {
  rateUsdPerDay: number;
  despatchUsdPerDay?: number;
  laytimeHours?: number;
  laytimeTerms?: string;
}

export interface ContractDeadline {
  id: string;
  label: string;
  dueDate: string;
  category: "LAYCAN" | "NOMINATION" | "DOCUMENTARY" | "PAYMENT" | "NOTICE" | "COMMERCIAL";
  isCompleted: boolean;
  notes?: string;
}

export interface OutstandingCheck {
  id: string;
  label: string;
  category: "PORT_NAUTICAL" | "VESSEL_SPEC" | "COMMERCIAL" | "REGULATORY";
  status: "PASSED" | "FAILED" | "PENDING";
  detail?: string;
}

export interface ContractRecord {
  id: string;
  reference: string;
  counterparty: string;
  vesselName: string;
  vesselClass: VesselClassId;
  type: ContractType;
  origin: OriginRegion;
  destination: PortCode;
  tonnage: number;
  rateUsdPerT: number;
  laycanStart: string;
  laycanEnd: string;
  status: ContractStatus;
  createdAt: string;

  // Rich commercial fields
  commodity?: CargoType;
  dailyHireUsd?: number;
  demurrageTerms?: DemurrageTerms;
  deadlines?: ContractDeadline[];
  outstandingChecks?: OutstandingCheck[];
  linkedDecisionId?: string;
  verificationStatus?: VerificationStatus;
  assumptions?: string[];
  isIllustrative?: boolean;
  notes?: string;
}

export type NewContract = Omit<ContractRecord, "id" | "reference" | "createdAt">;

export type AuditAction =
  | "ANALYSIS_RUN"
  | "SCENARIO_RUN"
  | "CONTRACT_CREATED"
  | "CONTRACT_UPDATED"
  | "CONTRACT_STATUS_CHANGED"
  | "DECISION_APPROVED"
  | "DECISION_OVERRIDDEN"
  | "DATA_REFRESH"
  | "SETTINGS_CHANGED"
  | "VERIFICATION_COMPLETED"
  | "PORTFOLIO_RUN";

export interface AuditDiff {
  field: string;
  previousValue: string | number | null;
  newValue: string | number | null;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  actor: string;
  detail: string;
  diff?: AuditDiff[];
  provenance?: Provenance;
  relatedPath?: string;
}
