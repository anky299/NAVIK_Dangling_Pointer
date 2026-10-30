/**
 * Typed NAVIK service functions.
 *
 * Each function has two paths:
 *  - demo: returns illustrative fixtures or frontend simulations (current default)
 *  - live: calls the Python backend via `http()` at API_CONFIG.baseUrl
 *
 * Endpoint paths below are the proposed contract; adjust to match the backend.
 */
import { API_CONFIG, FIXTURE_AS_OF, isDemoMode } from "./config";
import { http, sleep } from "./client";
import {
  CONTRACT_FIXTURES,
  DEMO_PROVENANCE,
  RECENT_DECISIONS,
  RISK_ALERTS,
  auditFixtures,
  bunkerHistory,
  congestionFixture,
  freightHistory,
  marketSnapshot,
  sliceTimeframe,
} from "./fixtures";
import { ORIGINS, PORTS, VESSEL_CLASSES } from "./reference";
import { BASE_BUNKER_USD_PER_T, simulateCharterDecision } from "@/lib/sim/charter";
import { simulateScenario } from "@/lib/sim/scenario";
import { computePortfolio } from "@/lib/sim/portfolio";
import { localAssistantReply, type AssistantContext } from "@/lib/sim/assistant";
import type {
  Allocation,
  AuditEvent,
  AuditDiff,
  BunkerSeries,
  CharterDecisionReport,
  CharterRequest,
  ChatMessage,
  CongestionReport,
  ContractRecord,
  DashboardBundle,
  FreightSeries,
  NewContract,
  OriginProfile,
  OriginRegion,
  PortProfile,
  PortfolioPlan,
  RiskPreference,
  ScenarioInput,
  ScenarioResult,
  Timeframe,
  VesselClassSpec,
} from "./types";

const demoDelay = () => sleep(API_CONFIG.demoLatencyMs);

/* ---------- Browser local storage / in-memory demo stores ---------- */
const CONTRACTS_KEY = "navik_contracts_v1";
const AUDIT_KEY = "navik_audit_v1";

function loadFromStorage<T>(
  key: string,
  fallback: () => T,
  validate?: (val: unknown) => boolean,
): T {
  if (typeof window === "undefined" || !window.localStorage) return fallback();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback();
    const parsed = JSON.parse(raw);
    if (validate && !validate(parsed)) return fallback();
    return parsed as T;
  } catch {
    return fallback();
  }
}

function saveToStorage<T>(key: string, data: T) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // storage disabled or quota exceeded
  }
}

let contractStore: ContractRecord[] | null = null;
let auditStore: AuditEvent[] | null = null;
let auditSeq = 9200;

export const contracts = (): ContractRecord[] => {
  if (!contractStore) {
    contractStore = loadFromStorage(
      CONTRACTS_KEY,
      () => [...CONTRACT_FIXTURES],
      (val) =>
        Array.isArray(val) &&
        val.length > 0 &&
        typeof (val[0] as Record<string, unknown>)?.reference === "string",
    );
  }
  return contractStore;
};

export const audits = (): AuditEvent[] => {
  if (!auditStore) {
    auditStore = loadFromStorage(
      AUDIT_KEY,
      () => auditFixtures(),
      (val) =>
        Array.isArray(val) &&
        val.length > 0 &&
        typeof (val[0] as Record<string, unknown>)?.id === "string",
    );
  }
  return auditStore;
};

export function recordAudit(e: Omit<AuditEvent, "id" | "timestamp" | "actor">): AuditEvent {
  const store = audits();
  const event: AuditEvent = {
    ...e,
    id: `AU-${++auditSeq}`,
    timestamp: new Date().toISOString(),
    actor: "you · desk lead",
  };
  store.unshift(event);
  saveToStorage(AUDIT_KEY, store);
  return event;
}

export function resetContractStore(): void {
  contractStore = [...CONTRACT_FIXTURES];
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(CONTRACTS_KEY);
    } catch {
      /* ignore storage clear error */
    }
  }
}

export function resetAuditStore(): void {
  auditStore = auditFixtures();
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(AUDIT_KEY);
    } catch {
      /* ignore storage clear error */
    }
  }
}

/**
 * Resets all local demo state (contracts and audit logs) back to pristine fixtures.
 */
export function resetDemoState(): void {
  resetContractStore();
  resetAuditStore();
}

/* ---------- Reference ---------- */
export async function getOrigins(): Promise<OriginProfile[]> {
  if (isDemoMode()) return ORIGINS;
  return http("/reference/origins");
}

export async function getPorts(): Promise<PortProfile[]> {
  if (isDemoMode()) return PORTS;
  return http("/ports");
}

export async function getVesselClasses(): Promise<VesselClassSpec[]> {
  if (isDemoMode()) return VESSEL_CLASSES;
  return http("/fleet/vessel-classes");
}

/* ---------- Market ---------- */
export async function getDashboard(): Promise<DashboardBundle> {
  if (isDemoMode()) {
    return {
      snapshot: marketSnapshot(),
      alerts: RISK_ALERTS,
      recent: RECENT_DECISIONS,
      provenance: DEMO_PROVENANCE,
    };
  }
  return http("/dashboard");
}

export async function getFreightSeries(
  origin: OriginRegion,
  timeframe: Timeframe,
): Promise<FreightSeries> {
  if (isDemoMode()) {
    const all = freightHistory(origin);
    const points = sliceTimeframe(all, timeframe, 8);
    const actual = points.filter((p) => !p.forecast);
    const first = actual[0]?.rate ?? 1;
    const lastRate = actual.at(-1)?.rate ?? first;
    const changePct = ((lastRate - first) / first) * 100;
    return {
      origin,
      timeframe,
      points,
      changePct: Math.round(changePct * 10) / 10,
      provenance: DEMO_PROVENANCE,
    };
  }
  return http("/market/freight", { query: { origin, timeframe } });
}

export async function getBunkerSeries(timeframe: Timeframe): Promise<BunkerSeries> {
  if (isDemoMode()) {
    return {
      timeframe,
      points: sliceTimeframe(bunkerHistory(), timeframe),
      provenance: DEMO_PROVENANCE,
    };
  }
  return http("/market/bunker", { query: { timeframe } });
}

export async function getCongestion(): Promise<CongestionReport> {
  if (isDemoMode()) return { ports: congestionFixture(), provenance: DEMO_PROVENANCE };
  return http("/market/congestion");
}

/* ---------- Charter decision ---------- */
export async function analyzeCharter(req: CharterRequest): Promise<CharterDecisionReport> {
  if (isDemoMode()) {
    await demoDelay();
    const report = simulateCharterDecision(req, {
      now: new Date(),
      bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
    });
    recordAudit({
      action: "ANALYSIS_RUN",
      entity: "Charter analysis",
      entityId: report.requestId,
      detail: `${Math.round(req.cargoTonnes / 1000)}k t · ${req.origin} → ${req.destination} · ${report.decision}`,
    });
    return report;
  }
  return http("/charter/analyze", { method: "POST", body: req });
}

/* ---------- Scenarios ---------- */
export async function runScenario(
  request: CharterRequest,
  input: ScenarioInput,
): Promise<ScenarioResult> {
  if (isDemoMode()) {
    await demoDelay();
    const result = simulateScenario(request, input, new Date(FIXTURE_AS_OF));
    recordAudit({
      action: "SCENARIO_RUN",
      entity: "Scenario",
      entityId: `SC-${Math.abs(input.freightShockPct)}-${input.congestionDays}`,
      detail: `Freight ${input.freightShockPct >= 0 ? "+" : ""}${input.freightShockPct}% · +${input.congestionDays} d wait · VLSFO $${input.bunkerUsdPerT}`,
    });
    return result;
  }
  return http("/scenarios/simulate", { method: "POST", body: { request, input } });
}

/* ---------- Strategy ---------- */
export async function getPortfolioPlan(
  preference: RiskPreference,
  allocation: Allocation,
): Promise<PortfolioPlan> {
  if (isDemoMode()) return computePortfolio(preference, allocation);
  return http("/strategy/portfolio", { method: "POST", body: { preference, allocation } });
}

/* ---------- Assistant ---------- */
export async function askAssistant(
  history: ChatMessage[],
  question: string,
  context?: AssistantContext,
): Promise<ChatMessage> {
  if (isDemoMode()) {
    await sleep(400 + Math.min(question.length * 4, 400));
    const r = localAssistantReply(question, context);
    return {
      id: `m-${Date.now()}`,
      role: "assistant",
      content: r.content,
      sources: r.sources,
      structured: r.structured,
      actions: r.actions,
      followUps: r.followUps,
      intent: r.intent,
      createdAt: new Date().toISOString(),
    };
  }
  return http("/assistant/chat", { method: "POST", body: { history, question, context } });
}

/* ---------- Contracts ---------- */
export async function listContracts(): Promise<ContractRecord[]> {
  if (isDemoMode()) return [...contracts()];
  return http("/contracts");
}

export async function getContract(idOrRef: string): Promise<ContractRecord | null> {
  const all = await listContracts();
  return all.find((c) => c.id === idOrRef || c.reference === idOrRef) ?? null;
}

export async function createContract(input: NewContract): Promise<ContractRecord> {
  if (isDemoMode()) {
    await sleep(350);
    const n = contracts().length + 15;
    const prefix = input.type === "VOYAGE" ? "VC" : input.type === "TIME_CHARTER" ? "TC" : "COA";
    const record: ContractRecord = {
      ...input,
      id: `local-${Date.now()}`,
      reference: `NVK-${prefix}-2610-${String(n).padStart(3, "0")}`,
      createdAt: new Date().toISOString(),
    };
    contracts().unshift(record);
    saveToStorage(CONTRACTS_KEY, contracts());
    recordAudit({
      action: "CONTRACT_CREATED",
      entity: "Contract",
      entityId: record.reference,
      detail: `${record.counterparty} · ${record.vesselName} (${record.vesselClass})`,
      diff: [
        { field: "reference", previousValue: null, newValue: record.reference },
        { field: "status", previousValue: null, newValue: record.status },
        { field: "tonnage", previousValue: null, newValue: record.tonnage },
        { field: "rateUsdPerT", previousValue: null, newValue: record.rateUsdPerT },
      ],
      relatedPath: `/contracts?highlight=${record.reference}`,
    });
    return record;
  }
  return http("/contracts", { method: "POST", body: input });
}

export async function updateContract(
  id: string,
  updates: Partial<ContractRecord>,
  skipAudit = false,
): Promise<ContractRecord> {
  if (isDemoMode()) {
    await sleep(250);
    const store = contracts();
    const idx = store.findIndex((c) => c.id === id || c.reference === id);
    if (idx === -1) throw new Error(`Contract not found: ${id}`);

    const prev = store[idx];
    const prevRecord = prev as unknown as Record<string, unknown>;
    const updateRecord = updates as Record<string, unknown>;
    const diffs: AuditDiff[] = [];
    for (const [k, v] of Object.entries(updates)) {
      if (k !== "id" && k !== "createdAt" && prevRecord[k] !== v) {
        diffs.push({
          field: k,
          previousValue: (prevRecord[k] as string | number | boolean | null) ?? null,
          newValue: (v as string | number | boolean | null) ?? null,
        });
      }
    }

    const updated: ContractRecord = { ...prev, ...updates };
    store[idx] = updated;
    saveToStorage(CONTRACTS_KEY, store);

    if (!skipAudit) {
      const isStatus = updates.status && updates.status !== prev.status;
      recordAudit({
        action: isStatus ? "CONTRACT_STATUS_CHANGED" : "CONTRACT_UPDATED",
        entity: "Contract",
        entityId: updated.reference,
        detail: isStatus
          ? `Status moved from ${prev.status} to ${updated.status} (${updated.vesselName})`
          : `Updated commercial terms for ${updated.reference}`,
        diff: diffs.length > 0 ? diffs : undefined,
        relatedPath: `/contracts?highlight=${updated.reference}`,
      });
    }

    return updated;
  }
  return http(`/contracts/${id}`, { method: "PATCH", body: updates });
}

export async function verifyContractCheck(
  contractId: string,
  checkId: string,
): Promise<ContractRecord> {
  const store = contracts();
  const contract = store.find((c) => c.id === contractId || c.reference === contractId);
  if (!contract) throw new Error(`Contract not found: ${contractId}`);

  const checks = contract.outstandingChecks ? [...contract.outstandingChecks] : [];
  const chkIdx = checks.findIndex((chk) => chk.id === checkId);
  if (chkIdx === -1) throw new Error(`Check not found: ${checkId}`);

  const targetCheck = checks[chkIdx];
  checks[chkIdx] = { ...targetCheck, status: "PASSED" };

  const allPassed = checks.every((c) => c.status === "PASSED");

  recordAudit({
    action: "VERIFICATION_COMPLETED",
    entity: "Contract",
    entityId: contract.reference,
    detail: `Verified check: "${targetCheck.label}" (${contract.vesselName})`,
    diff: [
      {
        field: `check:${targetCheck.label}`,
        previousValue: targetCheck.status,
        newValue: "PASSED",
      },
    ],
    relatedPath: `/contracts?highlight=${contract.reference}`,
  });

  return updateContract(
    contract.id,
    {
      outstandingChecks: checks,
      verificationStatus: allPassed ? "VERIFIED" : contract.verificationStatus,
    },
    true,
  );
}

/* ---------- Audit ---------- */
export async function listAuditEvents(): Promise<AuditEvent[]> {
  if (isDemoMode()) return [...audits()];
  return http("/audit");
}

/* ---------- Insurance Intelligence ---------- */
export async function getInsuranceOverview(): Promise<import("./insurance-types").InsuranceOverviewMetrics> {
  if (isDemoMode()) {
    const { getOverviewMetrics } = await import("@/lib/sim/insurance");
    return getOverviewMetrics();
  }
  return http("/insurance/overview");
}

export async function createInsuranceEstimate(
  request: import("./insurance-types").InsuranceEstimateRequest,
): Promise<import("./insurance-types").InsuranceEstimateResult> {
  if (isDemoMode()) {
    await sleep(API_CONFIG.demoLatencyMs);
    const { calculateInsuranceEstimate } = await import("@/lib/sim/insurance");
    return calculateInsuranceEstimate(request);
  }
  return http("/insurance/estimates", { method: "POST", body: request });
}

export async function getInsuranceEstimate(
  id: string,
): Promise<import("./insurance-types").InsuranceEstimateResult> {
  if (isDemoMode()) {
    const { getEstimateById } = await import("@/lib/sim/insurance");
    const found = getEstimateById(id);
    if (!found) throw new Error(`Insurance estimate not found: ${id}`);
    return found;
  }
  return http(`/insurance/estimates/${id}`);
}

export async function listInsuranceEstimates(): Promise<import("./insurance-types").InsuranceEstimateResult[]> {
  if (isDemoMode()) {
    const { getEstimationHistory } = await import("@/lib/sim/insurance");
    return getEstimationHistory();
  }
  return http("/insurance/estimates");
}

export async function getInsuranceHistoricalRecords(
  filters?: import("./insurance-types").HistoricalRecordsFilter,
): Promise<import("./insurance-types").PaginatedHistoricalRecords> {
  if (isDemoMode()) {
    const { getHistoricalRecords } = await import("@/lib/sim/insurance");
    return getHistoricalRecords(filters);
  }
  return http("/insurance/records", { query: filters as Record<string, string | number | boolean | undefined> });
}

export async function getInsuranceAnalytics(
  filters?: {
    commodity?: import("./insurance-types").InsuranceCommodity | "ALL";
    origin?: OriginRegion | "ALL";
    destination?: PortCode | "ALL";
    clause?: import("./insurance-types").CoverageClause | "ALL";
  },
): Promise<import("./insurance-types").InsuranceAnalyticsBundle> {
  if (isDemoMode()) {
    const { getInsuranceAnalyticsBundle } = await import("@/lib/sim/insurance");
    return getInsuranceAnalyticsBundle(filters);
  }
  return http("/insurance/analytics", { query: filters as Record<string, string | number | boolean | undefined> });
}

export async function getInsuranceReferenceData() {
  if (isDemoMode()) {
    const { SUPPORTED_COMMODITIES, COVERAGE_CLAUSES, SUPPORTED_CURRENCIES } = await import(
      "@/lib/sim/insurance"
    );
    return {
      commodities: SUPPORTED_COMMODITIES,
      coverageClauses: COVERAGE_CLAUSES,
      currencies: SUPPORTED_CURRENCIES,
      origins: ORIGINS,
      ports: PORTS,
    };
  }
  return http("/insurance/reference-data");
}
