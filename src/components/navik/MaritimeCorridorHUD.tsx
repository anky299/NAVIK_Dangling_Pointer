/**
 * Interactive Tactical Maritime Corridor HUD for Landing & Overview contexts.
 *
 * Allows commercial decision-makers to inspect the 5 East Coast India ports,
 * assess draft limits vs. Capesize laden drafts, view transit distances,
 * and test route feasibility directly before entering deeper workspaces.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Anchor,
  ArrowRight,
  Compass,
  Gauge,
  Navigation,
  ShieldAlert,
  Ship,
  Sparkles,
  Waves,
} from "lucide-react";
import { RouteMap } from "./RouteMap";
import { PORTS, ORIGINS, DISTANCES_NM } from "@/lib/api/reference";
import { evaluatePortFleetFeasibility } from "@/lib/sim/feasibility";
import type { PortCode, OriginRegion } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const PORT_COORDINATES: Record<PortCode, string> = {
  HLDA: "22°01'N · 88°04'E",
  DHMR: "20°48'N · 86°58'E",
  PRDP: "20°15'N · 86°40'E",
  VIZG: "17°41'N · 83°17'E",
  GGVM: "17°37'N · 83°14'E",
};

export function MaritimeCorridorHUD({ className }: { className?: string }) {
  const [selectedPort, setSelectedPort] = useState<PortCode>("PRDP");
  const [selectedOrigin, setSelectedOrigin] = useState<OriginRegion>("AUS_QLD");

  const port = PORTS.find((p) => p.code === selectedPort) ?? PORTS[0];
  const origin = ORIGINS.find((o) => o.id === selectedOrigin) ?? ORIGINS[0];
  const distance = DISTANCES_NM[selectedOrigin]?.[selectedPort] ?? 4200;

  // Feasibility summary for chosen port
  const feasibility = evaluatePortFleetFeasibility(selectedPort);
  const capeCheck = feasibility.reports.find((r) => r.vesselClass.id === "CAPESIZE");
  const isConditional = capeCheck?.status === "CONDITIONAL";
  const speedKnots = 12.5;
  const transitDays = (distance / (speedKnots * 24)).toFixed(1);

  return (
    <div
      className={cn(
        "surface-bridge relative overflow-hidden rounded-xl border border-border/80 p-5 lg:p-7 shadow-deep",
        className,
      )}
    >
      {/* Background nautical subtle coordinate crosshair */}
      <div className="nautical-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-copper/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 size-80 rounded-full bg-sea/10 blur-3xl" />

      {/* Top Console Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-2 rounded-full bg-copper animate-pulse" />
          <span className="text-eyebrow text-[0.68rem] text-brass tracking-wider">
            Maritime Corridor Telemetry Console
          </span>
          <span className="hidden sm:inline-block font-mono text-[0.62rem] text-muted-foreground/80">
            [SYS.VER 2.4 · BAY OF BENGAL FAIRWAY]
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[0.65rem] text-muted-foreground bg-abyss/80 px-2.5 py-1 rounded border border-border/60">
          <Compass className="size-3 text-copper-soft" />
          <span>PORT: {PORT_COORDINATES[selectedPort]}</span>
        </div>
      </div>

      {/* Main HUD Body: Route Canvas & Tactical Telemetry */}
      <div className="relative z-10 grid gap-6 pt-5 lg:grid-cols-12 lg:gap-8 items-center">
        {/* Left: Interactive Vector Route Canvas with Port Selector */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="relative rounded-lg border border-border/70 bg-abyss/70 p-3 overflow-hidden shadow-inner">
            <div className="absolute top-2.5 left-3 flex items-center gap-2 font-mono text-[0.62rem] text-muted-foreground/80 z-20">
              <span className="size-1.5 rounded-full bg-sea" />
              <span>ACTIVE DISCHARGE BEACON: {port.name.toUpperCase()}</span>
            </div>

            <RouteMap
              title="Tactical maritime route canvas"
              highlightPort={selectedPort}
              onPortSelect={(p) => setSelectedPort(p)}
              labelScale={1.05}
              className="max-h-[340px] w-full"
            />

            <div className="absolute bottom-2.5 right-3 text-[0.6rem] font-mono text-muted-foreground/70 z-20">
              Click any port marker to inspect draft
            </div>
          </div>

          {/* Port Selector Pills */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="text-eyebrow text-[0.6rem] text-muted-foreground mr-1">
              Discharge:
            </span>
            {PORTS.map((p) => {
              const active = p.code === selectedPort;
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => setSelectedPort(p.code)}
                  className={cn(
                    "rounded px-2.5 py-1 font-mono text-xs transition-all flex items-center gap-1.5 border",
                    active
                      ? "bg-copper/20 border-copper text-copper-soft shadow-copper-subtle font-semibold"
                      : "bg-surface/50 border-border/70 text-foreground/75 hover:bg-surface hover:text-foreground",
                  )}
                >
                  <span>{p.name}</span>
                  <span
                    className={cn(
                      "text-[0.62rem]",
                      active ? "text-brass" : "text-muted-foreground",
                    )}
                  >
                    {p.maxDraftM.toFixed(1)}m
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Tactical Port Telemetry & Feasibility Breakdown */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedPort + selectedOrigin}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Origin Selection */}
              <div className="space-y-1.5">
                <span className="text-eyebrow text-[0.6rem] text-muted-foreground">
                  Load Terminal
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {ORIGINS.map((o) => {
                    const active = o.id === selectedOrigin;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setSelectedOrigin(o.id)}
                        className={cn(
                          "rounded border px-2.5 py-1.5 text-left transition-all",
                          active
                            ? "border-brass/70 bg-brass/10 text-foreground"
                            : "border-border/60 bg-surface/30 text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                        )}
                      >
                        <p className="font-mono text-[0.68rem] font-medium leading-none">
                          {o.loadPort}
                        </p>
                        <p className="text-[0.6rem] text-muted-foreground mt-0.5">{o.shortName}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Voyage Metrics Cards */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="rounded border border-border/60 bg-abyss/60 p-3">
                  <p className="text-eyebrow text-[0.58rem] text-muted-foreground">Sea Distance</p>
                  <p className="mt-1 font-mono text-xl font-semibold text-foreground">
                    {distance.toLocaleString()}{" "}
                    <span className="text-xs font-sans font-normal text-muted-foreground">nm</span>
                  </p>
                  <p className="mt-0.5 font-mono text-[0.62rem] text-muted-foreground">
                    ~{transitDays} sailing days @ 12.5k
                  </p>
                </div>

                <div className="rounded border border-border/60 bg-abyss/60 p-3">
                  <p className="text-eyebrow text-[0.58rem] text-muted-foreground">
                    Max Draft Limit
                  </p>
                  <p
                    className={cn(
                      "mt-1 font-mono text-xl font-semibold",
                      port.maxDraftM < 10 ? "text-danger" : "text-sea-soft",
                    )}
                  >
                    {port.maxDraftM.toFixed(1)}{" "}
                    <span className="text-xs font-sans font-normal text-muted-foreground">m</span>
                  </p>
                  <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
                    {port.maxDraftM < 10 ? "Riverine shallow draft" : "Deep-water tidal berth"}
                  </p>
                </div>
              </div>

              {/* Capesize Vessel Clearance Status Box */}
              <div
                className={cn(
                  "rounded-md border p-3.5 space-y-2",
                  isConditional
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-emerald-500/40 bg-emerald-500/10",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Ship
                      className={cn(
                        "size-4",
                        isConditional ? "text-amber-400" : "text-emerald-400",
                      )}
                    />
                    <span className="font-semibold text-xs text-foreground">
                      Capesize Clearance (18.1m Laden)
                    </span>
                  </div>
                  <span
                    className={cn(
                      "font-mono text-[0.62rem] font-bold px-1.5 py-0.5 rounded uppercase border",
                      isConditional
                        ? "border-amber-400/50 text-amber-300 bg-amber-950/60"
                        : "border-emerald-400/50 text-emerald-300 bg-emerald-950/60",
                    )}
                  >
                    {capeCheck?.status ?? "FEASIBLE"}
                  </span>
                </div>

                <p className="text-[0.72rem] leading-relaxed text-foreground/80">
                  {isConditional
                    ? selectedPort === "HLDA"
                      ? "Direct berthing impossible due to 8.5m river draft. Requires Sandheads anchorage lightering (+$4.20/t surcharge, +3.4 days delay)."
                      : `Draft limit of ${port.maxDraftM}m requires short-loading or tidal high-water transit window.`
                    : `${port.name} features deep-water access (${port.maxDraftM}m permissible draft). Capesize bulkers berth fully laden without lightering.`}
                </p>
              </div>

              {/* Direct Link to Charter Workspace with preselected port */}
              <Link
                to="/charter"
                className="group flex w-full items-center justify-center gap-2 rounded-md bg-copper py-2.5 px-4 text-xs font-semibold text-primary-foreground shadow-copper transition hover:bg-copper-soft"
              >
                <span>Simulate Charter for {port.name}</span>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
