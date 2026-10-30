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

export interface RouteMapProps {
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
  /** Visual theme for the map canvas. Defaults to "dark" for tactical ocean backdrops. */
  theme?: "dark" | "light";
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
  theme = "dark",
}: RouteMapProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const reduce = useReducedMotion();
  const fs = 11 * labelScale;
  const usedOrigins = new Set(lanes.map((l) => l.origin));
  const isDark = theme !== "light";

  const onKey = (code: PortCode) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPortSelect?.(code);
    }
  };

  return (
    <svg viewBox={viewBox} className={cn("h-auto w-full", className)} role="img" aria-label={title}>
      <defs>
        {/* Ocean Corridor Route Gradient — Primary Emphasized Corridor (Champagne Amber to Burnt Orange) */}
        <linearGradient id={`${uid}-lane`} x1="1" y1="1" x2="0" y2="0">
          <stop
            offset="0%"
            stopColor="#F2B653"
            stopOpacity={isDark ? 0.98 : 0.9}
          />
          <stop
            offset="60%"
            stopColor="#E87945"
            stopOpacity={0.92}
          />
          <stop
            offset="100%"
            stopColor="#15364A"
            stopOpacity={0.8}
          />
        </linearGradient>

        {/* Secondary Lane Gradient — Arctic Teal to Seafoam */}
        <linearGradient id={`${uid}-lane-sec`} x1="1" y1="1" x2="0" y2="0">
          <stop
            offset="0%"
            stopColor="#35BFC3"
            stopOpacity={0.85}
          />
          <stop
            offset="60%"
            stopColor="#78958F"
            stopOpacity={0.7}
          />
          <stop
            offset="100%"
            stopColor="#24485C"
            stopOpacity={0.4}
          />
        </linearGradient>

        {/* Tactical Bay of Bengal Fairway Radial Glow */}
        <radialGradient id={`${uid}-glow`}>
          <stop
            offset="0%"
            stopColor="#35BFC3"
            stopOpacity={isDark ? 0.16 : 0.10}
          />
          <stop
            offset="60%"
            stopColor="#F2B653"
            stopOpacity={isDark ? 0.08 : 0.04}
          />
          <stop
            offset="100%"
            stopColor="#081827"
            stopOpacity={0}
          />
        </radialGradient>

        {/* Luminous filter for emphasized routes */}
        <filter id={`${uid}-route-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Graticule coordinate lines */}
      {showGraticule && (
        <path
          d={GRATICULE_PATH}
          className="fill-none"
          stroke={isDark ? "rgba(36, 72, 92, 0.45)" : "rgba(36, 72, 92, 0.20)"}
          strokeWidth={0.5}
        />
      )}

      {/* Landmass Outlines (Australia, Indonesia, India) in Midnight Ocean */}
      <path
        d={LAND_PATH}
        fill={isDark ? "rgba(13, 34, 51, 0.95)" : "rgba(21, 54, 74, 0.25)"}
        stroke={isDark ? "#24485C" : "rgba(36, 72, 92, 0.60)"}
        strokeWidth={0.9}
        strokeLinejoin="round"
      />

      {/* Bay of Bengal approach ambient glow */}
      <circle cx={300} cy={130} r={75} fill={`url(#${uid}-glow)`} />

      {/* Nautical Compass Rose Watermark */}
      <g
        transform="translate(490, 260)"
        opacity={isDark ? 0.4 : 0.25}
        className="pointer-events-none"
      >
        <circle
          r={32}
          fill="none"
          stroke="#24485C"
          strokeWidth={0.8}
        />
        <circle
          r={24}
          fill="none"
          stroke="#F2B653"
          strokeWidth={0.5}
          strokeDasharray="2,3"
        />
        <path d="M0,-36 L3,-8 L0,0 L-3,-8 Z" fill="#F2B653" />
        <path d="M0,36 L3,8 L0,0 L-3,8 Z" fill="#15364A" />
        <path d="M36,0 L8,3 L0,0 L8,-3 Z" fill="#35BFC3" />
        <path d="M-36,0 L-8,3 L0,0 L-8,-3 Z" fill="#0D2233" />
        <text
          y={-40}
          textAnchor="middle"
          fontSize={8.5}
          fontFamily="monospace"
          fontWeight="bold"
          fill="#F2B653"
        >
          N
        </text>
      </g>

      {/* Independent Scattered Route Lanes */}
      {lanes.map((lane, i) => {
        const id = `${uid}-l${i}`;
        const d = smoothPath(laneTo(lane.origin, lane.port));
        const dim = highlightPort && highlightPort !== lane.port;
        const isEmphasized = lane.emphasis || highlightPort === lane.port;
        const laneDuration = 18 + (i % 3) * 4;
        const laneStagger = -(i * 4.3);

        return (
          <g key={id} opacity={dim ? 0.22 : 1} style={{ transition: "opacity 400ms" }}>
            {/* Step 1: Independent subtle base track */}
            <path
              d={d}
              fill="none"
              stroke={isEmphasized ? "rgba(242, 182, 83, 0.35)" : "rgba(53, 191, 195, 0.20)"}
              strokeWidth={isEmphasized ? 1.8 : 1.2}
              strokeDasharray={isEmphasized ? undefined : "3 4"}
              strokeLinecap="round"
            />

            {/* Luminous route under-glow for prominent lanes */}
            {isEmphasized && (
              <path
                d={d}
                fill="none"
                stroke="#F2B653"
                strokeWidth={isDark ? 4.5 : 3.5}
                strokeOpacity={isDark ? 0.35 : 0.20}
                strokeLinecap="round"
                filter={`url(#${uid}-route-glow)`}
              />
            )}

            {/* Step 2: Main corridor path */}
            <motion.path
              id={id}
              d={d}
              fill="none"
              stroke={isEmphasized ? `url(#${uid}-lane)` : `url(#${uid}-lane-sec)`}
              strokeWidth={isEmphasized ? 2.4 : 1.5}
              strokeLinecap="round"
              initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 2.2, delay: delay + i * 0.22, ease: [0.65, 0, 0.35, 1] }}
            />

            {/* Step 3: Independent travelling pulse along this specific route */}
            {!reduce && (
              <path
                d={d}
                fill="none"
                stroke={isEmphasized ? "#F3EEE5" : "#35BFC3"}
                strokeOpacity={isDark ? 0.9 : 0.75}
                strokeWidth={isEmphasized ? 1.5 : 1.0}
                className="lane-flow"
              />
            )}

            {/* Step 4: Moving Vessel Indicator along its own independent route */}
            {vessels && !reduce && (
              <g>
                {/* Luminous water pulse / halo around vessel */}
                <circle
                  r={7}
                  fill={isEmphasized ? "#F2B653" : "#35BFC3"}
                  fillOpacity={0.25}
                />
                {/* High-contrast bulk carrier vessel hull */}
                <path
                  d="M-7,-2.4 L4.5,-2.4 L8,0 L4.5,2.4 L-7,2.4 Z"
                  fill="#F3EEE5"
                  stroke="#081827"
                  strokeWidth={0.8}
                />
                {/* Bulk carrier bridge / superstructure */}
                <rect
                  x={-5}
                  y={-1.4}
                  width={2.8}
                  height={2.8}
                  fill="#15364A"
                />
                {/* Forward bow beacon */}
                <circle cx={7} cy={0} r={1.2} fill={isEmphasized ? "#F2B653" : "#35BFC3"} />
                <animateMotion
                  dur={`${laneDuration}s`}
                  begin={`${laneStagger}s`}
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

      {/* Origin Ports (Australia & Kalimantan) */}
      {ORIGINS.filter((o) => usedOrigins.has(o.id)).map((o) => {
        const [x, y] = originPoint(o.id);
        return (
          <g key={o.id}>
            {/* Outer beacon halo */}
            <circle
              cx={x}
              cy={y}
              r={6.5}
              className="fill-none"
              stroke="#78958F"
              strokeOpacity={0.65}
              strokeWidth={1}
            />
            {/* Inner origin node */}
            <circle
              cx={x}
              cy={y}
              r={3}
              fill="#35BFC3"
              stroke="#F3EEE5"
              strokeWidth={1.2}
            />
            {showOriginLabels && (
              <text
                x={x + 9}
                y={y + ORIGIN_LABEL_DY[o.id]}
                fontSize={fs * 0.92}
                fill="#F3EEE5"
                fontFamily="monospace"
                fontWeight="700"
                style={{
                  letterSpacing: "0.08em",
                  filter: isDark ? "drop-shadow(0 1px 3px rgba(0,0,0,0.95))" : undefined,
                }}
              >
                {o.loadPort.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}

      {/* Discharge Ports (Paradip, Dhamra, Haldia, Vizag, Gangavaram) */}
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
                className: "cursor-pointer outline-none",
              }
              : {})}
          >
            {/* Connector line from coast to callout */}
            {showPortLabels && (
              <line
                x1={x}
                y1={y}
                x2={label.x - 4}
                y2={label.y - fs * 0.35}
                stroke={active ? "#F2B653" : "rgba(36, 72, 92, 0.85)"}
                strokeWidth={active ? 1.5 : 0.8}
              />
            )}

            {/* Illuminated port beacon ping */}
            {!reduce && (
              <circle
                cx={x}
                cy={y}
                r={4.5}
                className="port-ping"
                fill={active ? "#F2B653" : "#35BFC3"}
                fillOpacity={0.65}
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={active ? 4.8 : 3.2}
              fill={active ? "#F2B653" : "#35BFC3"}
              stroke="#F3EEE5"
              strokeWidth={1.2}
            />

            {/* Port name & draft callout */}
            {showPortLabels && (
              <text
                x={label.x}
                y={label.y}
                fontSize={fs}
                fontFamily="sans-serif"
                fontWeight="700"
                fill={active ? "#F3EEE5" : "#D8E2E8"}
                style={{
                  filter: isDark ? "drop-shadow(0 1px 3px rgba(0,0,0,0.95))" : undefined,
                }}
              >
                {p.name}
                <tspan
                  dx={5}
                  fontSize={fs * 0.74}
                  fontFamily="monospace"
                  fontWeight="600"
                  fill={active ? "#F2B653" : "#35BFC3"}
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
