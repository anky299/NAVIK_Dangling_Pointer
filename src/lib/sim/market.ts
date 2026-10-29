/**
 * Market intelligence analysis engine.
 *
 * Pure functions that derive analyst-grade insights from the existing
 * fixture data and simulation logic. No live market data is used.
 * All outputs are labelled as demo/simulated.
 */
import type {
  BunkerPoint,
  CongestionIndicator,
  FreightPoint,
  MarketSnapshot,
  OriginRegion,
  PortCode,
  RiskAlert,
  Trend,
} from "@/lib/api/types";
import { ORIGINS, PORTS, DISTANCES_NM, originById, portByCode } from "@/lib/api/reference";
import { DEFAULT_MARKET, DEFAULT_CONGESTION, BASE_BUNKER_USD_PER_T } from "@/lib/sim/charter";

/* ---------- Route comparison ---------- */

export interface RouteComparison {
  origin: OriginRegion;
  originName: string;
  loadPort: string;
  destination: PortCode;
  destName: string;
  distanceNm: number;
  /** Estimated transit days at 12.5 kn Capesize reference speed */
  transitDays: number;
  currentRate: number;
  previousRate: number;
  changePct: number;
  trend: Trend;
  forecastRate: number | null;
  forecastTrend: Trend;
}

export function buildRouteComparisons(
  freightData: Record<OriginRegion, FreightPoint[]>,
  destination: PortCode,
): RouteComparison[] {
  const origins = Object.keys(freightData) as OriginRegion[];
  return origins.map((origin) => {
    const pts = freightData[origin];
    const actual = pts.filter((p) => !p.forecast);
    const forecasts = pts.filter((p) => p.forecast);
    const current = actual.at(-1)?.rate ?? 0;
    const previous = actual.at(-2)?.rate ?? current;
    const changePct = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const trend: Trend = changePct > 0.5 ? "up" : changePct < -0.5 ? "down" : "flat";
    const forecastRate = forecasts.at(-1)?.rate ?? null;
    const forecastTrend: Trend =
      forecastRate !== null && current > 0
        ? forecastRate > current * 1.01
          ? "up"
          : forecastRate < current * 0.99
            ? "down"
            : "flat"
        : "flat";
    const o = originById(origin);
    const p = portByCode(destination);
    const distanceNm = DISTANCES_NM[origin][destination];
    const transitDays = Math.round((distanceNm / (12.5 * 24)) * 10) / 10;
    return {
      origin,
      originName: o.shortName,
      loadPort: o.loadPort,
      destination,
      destName: p.name,
      distanceNm,
      transitDays,
      currentRate: current,
      previousRate: previous,
      changePct: Math.round(changePct * 10) / 10,
      trend,
      forecastRate,
      forecastTrend,
    };
  });
}

/* ---------- Bunker impact ---------- */

export interface BunkerImpact {
  currentVlsfo: number;
  previousVlsfo: number;
  vlsfoChangePct: number;
  currentHsfo: number;
  previousHsfo: number;
  hsfoChangePct: number;
  /** Incremental voyage cost impact (USD) for a reference Capesize, 4800nm, consuming 48 t/d */
  refVoyageImpactUsd: number;
  /** Per-tonne impact on a 160k t cargo */
  refImpactPerT: number;
}

export function computeBunkerImpact(bunkerPts: BunkerPoint[]): BunkerImpact {
  const current = bunkerPts.at(-1);
  const previous = bunkerPts.at(-2);
  if (!current || !previous) {
    return {
      currentVlsfo: 0,
      previousVlsfo: 0,
      vlsfoChangePct: 0,
      currentHsfo: 0,
      previousHsfo: 0,
      hsfoChangePct: 0,
      refVoyageImpactUsd: 0,
      refImpactPerT: 0,
    };
  }
  const vlsfoDelta = current.vlsfo - previous.vlsfo;
  const vlsfoChangePct = previous.vlsfo > 0 ? (vlsfoDelta / previous.vlsfo) * 100 : 0;
  const hsfoDelta = current.hsfo - previous.hsfo;
  const hsfoChangePct = previous.hsfo > 0 ? (hsfoDelta / previous.hsfo) * 100 : 0;

  // Reference Capesize: 48 t/d fuel, ~16 sea days for a 4800nm voyage
  const refSeaDays = 4800 / (12.5 * 24);
  const refFuelConsumption = 48 * refSeaDays * 2; // round trip
  const refVoyageImpactUsd = Math.round(vlsfoDelta * refFuelConsumption);
  const refImpactPerT = Math.round((refVoyageImpactUsd / 160_000) * 100) / 100;

  return {
    currentVlsfo: current.vlsfo,
    previousVlsfo: previous.vlsfo,
    vlsfoChangePct: Math.round(vlsfoChangePct * 10) / 10,
    currentHsfo: current.hsfo,
    previousHsfo: previous.hsfo,
    hsfoChangePct: Math.round(hsfoChangePct * 10) / 10,
    refVoyageImpactUsd,
    refImpactPerT,
  };
}

/* ---------- Analyst insights ---------- */

export interface MarketInsight {
  id: string;
  signal: string;
  metric: string;
  implication: string;
  route: string;
  severity: "info" | "warning" | "opportunity";
}

export function generateInsights(
  snapshot: MarketSnapshot,
  routeComparisons: RouteComparison[],
  congestion: CongestionIndicator[],
  bunkerImpact: BunkerImpact,
  alerts: RiskAlert[],
): MarketInsight[] {
  const insights: MarketInsight[] = [];
  let id = 1;

  // Freight index direction
  if (snapshot.freightIndexChangePct > 2) {
    insights.push({
      id: `MI-${id++}`,
      signal: "Freight market firming",
      metric: `Index up ${snapshot.freightIndexChangePct.toFixed(1)}% period-on-period`,
      implication:
        "Consider fixing forward commitments before rates climb further. Capesize and Kamsarmax classes are tightening.",
      route: "All routes",
      severity: "warning",
    });
  } else if (snapshot.freightIndexChangePct < -2) {
    insights.push({
      id: `MI-${id++}`,
      signal: "Freight market softening",
      metric: `Index down ${Math.abs(snapshot.freightIndexChangePct).toFixed(1)}%`,
      implication:
        "Deferring non-urgent fixtures may capture lower rates. Monitor for bottom signals.",
      route: "All routes",
      severity: "opportunity",
    });
  }

  // Identify the strongest-moving route
  const sorted = [...routeComparisons].sort(
    (a, b) => Math.abs(b.changePct) - Math.abs(a.changePct),
  );
  const strongest = sorted[0];
  if (strongest && Math.abs(strongest.changePct) > 1) {
    insights.push({
      id: `MI-${id++}`,
      signal: `${strongest.originName} rates ${strongest.trend === "up" ? "rising" : "falling"} fastest`,
      metric: `${strongest.changePct > 0 ? "+" : ""}${strongest.changePct.toFixed(1)}% week-on-week to $${strongest.currentRate.toFixed(2)}/t`,
      implication:
        strongest.trend === "up"
          ? `${strongest.originName} → ${strongest.destName} voyages are becoming more expensive. Consider alternative origins if schedule allows.`
          : `${strongest.originName} → ${strongest.destName} offers improving rates. Opportunity window for spot fixtures.`,
      route: `${strongest.loadPort} → ${strongest.destName}`,
      severity: strongest.trend === "up" ? "warning" : "opportunity",
    });
  }

  // Bunker fuel impact
  if (Math.abs(bunkerImpact.vlsfoChangePct) > 3) {
    insights.push({
      id: `MI-${id++}`,
      signal: `VLSFO ${bunkerImpact.vlsfoChangePct > 0 ? "up" : "down"} ${Math.abs(bunkerImpact.vlsfoChangePct).toFixed(1)}%`,
      metric: `$${bunkerImpact.currentVlsfo}/t (was $${bunkerImpact.previousVlsfo}/t)`,
      implication: `Adds ~$${Math.abs(bunkerImpact.refImpactPerT).toFixed(2)}/t to a reference Capesize voyage on Queensland–Paradip routes. ${bunkerImpact.vlsfoChangePct > 0 ? "Factor higher bunker pass-through into rate negotiations." : "Landed costs should ease slightly."}`,
      route: "All routes (bunker)",
      severity: bunkerImpact.vlsfoChangePct > 3 ? "warning" : "opportunity",
    });
  }

  // Port congestion
  const congested = congestion.filter((c) => c.avgWaitDays >= 2.5 && c.trend === "up");
  for (const port of congested) {
    const p = portByCode(port.port);
    insights.push({
      id: `MI-${id++}`,
      signal: `${p.name} congestion increasing`,
      metric: `${port.waitingVessels} vessels waiting, avg ${port.avgWaitDays.toFixed(1)} days, ${port.berthOccupancyPct}% berth utilisation`,
      implication: `Demurrage exposure rising. Build ${Math.ceil(port.avgWaitDays)} days of buffer into laycan planning for ${p.name} discharges.`,
      route: p.name,
      severity: "warning",
    });
  }

  // Forecast direction
  const forecastUp = routeComparisons.filter((r) => r.forecastTrend === "up");
  if (forecastUp.length > 0 && snapshot.forecastBias === "up") {
    insights.push({
      id: `MI-${id++}`,
      signal: "Simulated forecast skews upward",
      metric: `${forecastUp.length} of ${routeComparisons.length} routes show rising forecast trajectory`,
      implication:
        "If the upward bias persists, early fixtures on the firming lanes will be cheaper than waiting. Review Queensland and NSW rates.",
      route: forecastUp.map((r) => r.originName).join(", "),
      severity: "warning",
    });
  }

  // Fleet availability
  if (snapshot.fleetAvailabilityPct < 80) {
    insights.push({
      id: `MI-${id++}`,
      signal: "Fleet availability tightening",
      metric: `${snapshot.fleetAvailabilityPct}% of tonnage open in the next laycan window`,
      implication:
        "Reduced availability supports firmer hire rates. Secure preferred vessel classes early to avoid premium pricing.",
      route: "All routes",
      severity: "warning",
    });
  }

  return insights;
}

/* ---------- Timeframe label helper ---------- */

export const TIMEFRAME_OPTIONS = [
  { value: "3M" as const, label: "3M" },
  { value: "6M" as const, label: "6M" },
  { value: "1Y" as const, label: "1Y" },
  { value: "2Y" as const, label: "2Y" },
];
