import { motion, useReducedMotion } from "framer-motion";
import { useId, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { GRATICULE_PATH, LAND_PATH, laneTo, originPoint, portPoint, smoothPath } from "@/lib/geo";
import { ORIGINS, PORTS } from "@/lib/api/reference";
import type { OriginRegion, PortCode } from "@/lib/api/types";

export interface MapLane {
  origin: OriginRegion;
  port: PortCode;
  emphasis?: boolean;
}

/** Callout offsets (map units) so the five tightly clustered east-coast ports stay legible. */
const PORT_LABEL: Record<PortCode, { x: number; y: number }> = {
  HLDA: { x: 352, y: 78 },
  DHMR: { x: 360, y: 100 },
  PRDP: { x: 366, y: 122 },
  VIZG: { x: 318, y: 152 },
  GGVM: { x: 318, y: 174 },
};

const ORIGIN_LABEL_DY: Record<OriginRegion, number> = {
  AUS_QLD: 4,
  AUS_NSW: 4,
  AUS_WA: -10,
  IDN_KAL: -10,
};

export const ALL_LANES: MapLane[] = [
  { origin: "AUS_QLD", port: "PRDP", emphasis: true },
  { origin: "AUS_NSW", port: "GGVM" },
  { origin: "AUS_WA", port: "DHMR" },
  { origin: "IDN_KAL", port: "HLDA" },
  { origin: "AUS_QLD", port: "VIZG" },
];

interface RouteMapProps {
  title: string;
  lanes?: MapLane[];
  viewBox?: string;
  showPortLabels?: boolean;
  showOriginLabels?: boolean;
  showGraticule?: boolean;
  highlightPort?: PortCode | null;
  onPortSelect?: (code: PortCode) => void;
  vessels?: boolean;
  labelScale?: number;
  className?: string;
  /** Delay before the route-drawing sequence begins (s). */
  delay?: number;
}

/**
 * Schematic Australia / Indonesia → East Coast India route canvas.
 * Lanes are indicative illustrations, not navigational tracks or live AIS.
 */
export function RouteMap({
  title,
  lanes = ALL_LANES,
  viewBox = "180 30 680 620",
  showPortLabels = true,
  showOriginLabels = true,
  showGraticule = true,
  highlightPort = null,
  onPortSelect,
  vessels = true,
  labelScale = 1,
  className,
  delay = 0.2,
}: RouteMapProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const reduce = useReducedMotion();
  const fs = 11 * labelScale;
  const usedOrigins = new Set(lanes.map((l) => l.origin));

  const onKey = (code: PortCode) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPortSelect?.(code);
    }
  };

  return (
    <svg viewBox={viewBox} className={cn("h-auto w-full", className)} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${uid}-lane`} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="var(--color-brass)" stopOpacity="0.15" />
          <stop offset="55%" stopColor="var(--color-copper)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--color-copper-soft)" stopOpacity="1" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0%" stopColor="var(--color-copper)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--color-copper)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {showGraticule && (
        <path d={GRATICULE_PATH} className="fill-none stroke-foreground/[0.06]" strokeWidth={0.6} />
      )}
      <path
        d={LAND_PATH}
        className="fill-foreground/[0.07] stroke-foreground/25"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />

      {/* Bay of Bengal glow */}
      <circle cx={300} cy={130} r={70} fill={`url(#${uid}-glow)`} opacity={0.5} />

      {/* Nautical Compass Rose Watermark */}
      <g transform="translate(490, 260)" opacity={0.14} className="pointer-events-none">
        <circle r={32} fill="none" stroke="var(--color-copper)" strokeWidth={0.6} />
        <circle
          r={24}
          fill="none"
          stroke="var(--color-brass)"
          strokeWidth={0.4}
          strokeDasharray="2,3"
        />
        <path d="M0,-36 L3,-8 L0,0 L-3,-8 Z" fill="var(--color-copper)" />
        <path d="M0,36 L3,8 L0,0 L-3,8 Z" fill="var(--color-brass)" />
        <path d="M36,0 L8,3 L0,0 L8,-3 Z" fill="var(--color-copper)" />
        <path d="M-36,0 L-8,3 L0,0 L-8,-3 Z" fill="var(--color-brass)" />
        <text
          y={-40}
          textAnchor="middle"
          fontSize={8}
          fontFamily="monospace"
          fill="var(--color-copper)"
        >
          N
        </text>
      </g>

      {lanes.map((lane, i) => {
        const id = `${uid}-l${i}`;
        const d = smoothPath(laneTo(lane.origin, lane.port));
        const dim = highlightPort && highlightPort !== lane.port;
        return (
          <g key={id} opacity={dim ? 0.3 : 1} style={{ transition: "opacity 400ms" }}>
            <motion.path
              id={id}
              d={d}
              fill="none"
              stroke={`url(#${uid}-lane)`}
              strokeWidth={lane.emphasis ? 1.8 : 1.1}
              strokeLinecap="round"
              initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 2.4, delay: delay + i * 0.28, ease: [0.65, 0, 0.35, 1] }}
            />
            {!reduce && (
              <path
                d={d}
                fill="none"
                className="lane-flow stroke-brass/60"
                strokeWidth={lane.emphasis ? 1.2 : 0.8}
              />
            )}
            {vessels && !reduce && (
              <g>
                <circle r={5} className="fill-copper/20" />
                <path d="M-6,-1.9 L3.5,-1.9 L6.5,0 L3.5,1.9 L-6,1.9 Z" className="fill-fog" />
                <animateMotion
                  dur={`${22 + i * 5}s`}
                  begin={`${-(i * 4.3)}s`}
                  repeatCount="indefinite"
                  rotate="auto"
                  keyPoints="0;1"
                  keyTimes="0;1"
                  calcMode="linear"
                >
                  <mpath href={`#${id}`} />
                </animateMotion>
              </g>
            )}
          </g>
        );
      })}

      {/* Origins */}
      {ORIGINS.filter((o) => usedOrigins.has(o.id)).map((o) => {
        const [x, y] = originPoint(o.id);
        return (
          <g key={o.id}>
            <circle cx={x} cy={y} r={2.6} className="fill-brass" />
            <circle cx={x} cy={y} r={6} className="fill-none stroke-brass/40" strokeWidth={0.8} />
            {showOriginLabels && (
              <text
                x={x + 9}
                y={y + ORIGIN_LABEL_DY[o.id]}
                fontSize={fs * 0.92}
                className="fill-foreground/75 font-mono"
                style={{ letterSpacing: "0.08em" }}
              >
                {o.loadPort.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}

      {/* Discharge ports */}
      {PORTS.map((p) => {
        const [x, y] = portPoint(p.code);
        const label = PORT_LABEL[p.code];
        const active = highlightPort === p.code;
        const interactive = Boolean(onPortSelect);
        return (
          <g
            key={p.code}
            {...(interactive
              ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": `${p.name} port details`,
                  onClick: () => onPortSelect?.(p.code),
                  onKeyDown: onKey(p.code),
                  className: "cursor-pointer outline-none [&:focus-visible_text]:fill-brass",
                }
              : {})}
          >
            {showPortLabels && (
              <line
                x1={x}
                y1={y}
                x2={label.x - 4}
                y2={label.y - fs * 0.35}
                className={active ? "stroke-copper" : "stroke-foreground/30"}
                strokeWidth={0.6}
              />
            )}
            {!reduce && <circle cx={x} cy={y} r={3} className="port-ping fill-copper/50" />}
            <circle
              cx={x}
              cy={y}
              r={active ? 3.6 : 2.4}
              className={active ? "fill-copper" : "fill-copper-soft"}
            />
            {showPortLabels && (
              <text
                x={label.x}
                y={label.y}
                fontSize={fs}
                className={cn(
                  "font-sans font-semibold",
                  active ? "fill-copper-soft" : "fill-foreground",
                )}
              >
                {p.name}
                <tspan
                  dx={5}
                  fontSize={fs * 0.72}
                  className="fill-foreground/50 font-mono font-normal"
                >
                  {p.maxDraftM.toFixed(1)}m
                </tspan>
              </text>
            )}
            {interactive && (
              <circle cx={(x + label.x) / 2} cy={(y + label.y) / 2} r={16} fill="transparent" />
            )}
          </g>
        );
      })}
    </svg>
  );
}
