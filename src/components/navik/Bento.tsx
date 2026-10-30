import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/* =========================================================
   1. BentoGrid & BentoCard — Blue-Oriented Maritime Design System
   ========================================================= */

export interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 2 | 3 | 4 | 6 | 12;
}

export function BentoGrid({ cols = 12, className, children, ...props }: BentoGridProps) {
  const colStyles = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    6: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-6",
    12: "grid-cols-1 md:grid-cols-12",
  };

  return (
    <div className={cn("grid gap-4", colStyles[cols], className)} {...props}>
      {children}
    </div>
  );
}

export type BentoGlowColor =
  | "cyan"
  | "teal"
  | "amber"
  | "gold"
  | "coral"
  | "violet"
  | "steel"
  | "brass"
  | "bronze"
  | "copper"
  | "sage"
  | "walnut"
  | "charcoal"
  | "aubergine"
  | "powder"
  | "seafoam"
  | "peach"
  | "ice";

export type BentoCardVariant =
  | "default"
  | "ivory"
  | "secondary"
  | "muted"
  | "graphite"
  | "dark"
  | "ice"
  | "seafoam"
  | "peach"
  | "charcoal"
  | "teal"
  | "amber"
  | "coral";

export interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  glowColor?: BentoGlowColor;
  variant?: BentoCardVariant;
}

export function BentoCard({
  glow = true,
  glowColor = "cyan",
  variant = "default",
  className,
  children,
  ...props
}: BentoCardProps) {
  const glowGradients: Record<BentoGlowColor, string> = {
    cyan: "radial-gradient(280px circle at top right, rgba(53, 191, 195, 0.28), transparent 70%)",
    teal: "radial-gradient(280px circle at top right, rgba(53, 191, 195, 0.28), transparent 70%)",
    amber: "radial-gradient(280px circle at top right, rgba(242, 182, 83, 0.28), transparent 70%)",
    gold: "radial-gradient(280px circle at top right, rgba(242, 182, 83, 0.28), transparent 70%)",
    coral: "radial-gradient(280px circle at top right, rgba(232, 121, 69, 0.28), transparent 70%)",
    violet: "radial-gradient(280px circle at top right, rgba(167, 139, 250, 0.25), transparent 70%)",
    steel: "radial-gradient(280px circle at top right, rgba(36, 72, 92, 0.40), transparent 70%)",
    brass: "radial-gradient(280px circle at top right, rgba(242, 182, 83, 0.28), transparent 70%)",
    bronze: "radial-gradient(280px circle at top right, rgba(242, 182, 83, 0.24), transparent 70%)",
    copper: "radial-gradient(280px circle at top right, rgba(232, 121, 69, 0.24), transparent 70%)",
    sage: "radial-gradient(280px circle at top right, rgba(120, 149, 143, 0.26), transparent 70%)",
    walnut: "radial-gradient(280px circle at top right, rgba(21, 54, 74, 0.40), transparent 70%)",
    charcoal: "radial-gradient(280px circle at top right, rgba(13, 34, 51, 0.50), transparent 70%)",
    aubergine: "radial-gradient(280px circle at top right, rgba(167, 139, 250, 0.25), transparent 70%)",
    powder: "radial-gradient(280px circle at top right, rgba(53, 191, 195, 0.28), transparent 70%)",
    seafoam: "radial-gradient(280px circle at top right, rgba(120, 149, 143, 0.26), transparent 70%)",
    peach: "radial-gradient(280px circle at top right, rgba(242, 182, 83, 0.22), transparent 70%)",
    ice: "radial-gradient(280px circle at top right, rgba(36, 72, 92, 0.30), transparent 70%)",
  };

  const hoverGlowShadow: Record<BentoGlowColor, string> = {
    cyan: "hover:shadow-[0_8px_24px_rgba(53,191,195,0.25)] hover:border-[#35BFC3]/70",
    teal: "hover:shadow-[0_8px_24px_rgba(53,191,195,0.25)] hover:border-[#35BFC3]/70",
    amber: "hover:shadow-[0_8px_24px_rgba(242,182,83,0.25)] hover:border-[#F2B653]/70",
    gold: "hover:shadow-[0_8px_24px_rgba(242,182,83,0.25)] hover:border-[#F2B653]/70",
    coral: "hover:shadow-[0_8px_24px_rgba(232,121,69,0.25)] hover:border-[#E87945]/70",
    violet: "hover:shadow-[0_8px_24px_rgba(167,139,250,0.22)] hover:border-[#A78BFA]/70",
    steel: "hover:shadow-[0_8px_24px_rgba(36,72,92,0.40)] hover:border-[#35BFC3]/50",
    brass: "hover:shadow-[0_8px_24px_rgba(242,182,83,0.25)] hover:border-[#F2B653]/70",
    bronze: "hover:shadow-[0_8px_24px_rgba(242,182,83,0.22)] hover:border-[#F2B653]/60",
    copper: "hover:shadow-[0_8px_24px_rgba(232,121,69,0.22)] hover:border-[#E87945]/60",
    sage: "hover:shadow-[0_8px_24px_rgba(120,149,143,0.22)] hover:border-[#78958F]/70",
    walnut: "hover:shadow-[0_8px_24px_rgba(21,54,74,0.30)] hover:border-[#35BFC3]/40",
    charcoal: "hover:shadow-[0_8px_24px_rgba(13,34,51,0.45)] hover:border-[#24485C]",
    aubergine: "hover:shadow-[0_8px_24px_rgba(167,139,250,0.22)] hover:border-[#A78BFA]/70",
    powder: "hover:shadow-[0_8px_24px_rgba(53,191,195,0.22)] hover:border-[#35BFC3]/70",
    seafoam: "hover:shadow-[0_8px_24px_rgba(120,149,143,0.22)] hover:border-[#78958F]/70",
    peach: "hover:shadow-[0_8px_24px_rgba(242,182,83,0.20)] hover:border-[#F2B653]/60",
    ice: "hover:shadow-[0_8px_24px_rgba(36,72,92,0.30)] hover:border-[#35BFC3]/40",
  };

  const variantStyles: Record<BentoCardVariant, string> = {
    default:
      "bg-[#15364A] border-[#24485C] text-[#F3EEE5] shadow-[0_4px_20px_rgba(0,0,0,0.4)]",
    ivory:
      "bg-[#24485C] border-[#24485C] text-[#F3EEE5] shadow-[0_4px_20px_rgba(0,0,0,0.45)]",
    secondary:
      "bg-[#0D2233] border-[#24485C] text-[#F3EEE5] shadow-[0_4px_16px_rgba(0,0,0,0.35)]",
    muted:
      "bg-[#0D2233] border-[#24485C] text-[#D8E2E8] shadow-[0_4px_16px_rgba(0,0,0,0.35)]",
    graphite:
      "bg-gradient-to-b from-[#24485C] via-[#15364A] to-[#0D2233] border-[#24485C] text-[#F3EEE5] shadow-deep",
    dark:
      "bg-gradient-to-b from-[#24485C] via-[#15364A] to-[#081827] border-[#24485C] text-[#F3EEE5] shadow-deep",
    ice:
      "bg-[#0D2233] border-[#24485C] text-[#F3EEE5] shadow-sm",
    seafoam:
      "bg-[#15364A] border-[#78958F]/40 text-[#F3EEE5] shadow-sm",
    peach:
      "bg-[#15364A] border-[#F2B653]/40 text-[#F3EEE5] shadow-sm",
    charcoal:
      "bg-[#0D2233] border-[#24485C] text-[#F3EEE5] shadow-deep",
    teal:
      "bg-[#15364A] border-[#35BFC3]/40 text-[#F3EEE5] shadow-sm",
    amber:
      "bg-[#15364A] border-[#F2B653]/40 text-[#F3EEE5] shadow-sm",
    coral:
      "bg-[#15364A] border-[#E87945]/40 text-[#F3EEE5] shadow-sm",
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-5 backdrop-blur-md transition-all duration-300 motion-safe:hover:-translate-y-0.5",
        variantStyles[variant],
        hoverGlowShadow[glowColor],
        className,
      )}
      {...props}
    >
      {/* Top ambient glow on hover */}
      {glow && (
        <div
          className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: glowGradients[glowColor] }}
          aria-hidden="true"
        />
      )}
      {/* Subtle top hairline highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#35C9D0]/30 to-transparent"
        aria-hidden="true"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* =========================================================
   2. BentoCard Header & Meta
   ========================================================= */

export function BentoHeader({
  eyebrow,
  title,
  action,
  icon: Icon,
  className,
}: {
  eyebrow?: string;
  title?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 mb-3.5", className)}>
      <div className="space-y-0.5 min-w-0">
        {eyebrow && (
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#D8E2E8] font-semibold flex items-center gap-1.5">
            {Icon && <Icon className="size-3.5 text-[#35BFC3] shrink-0" />}
            <span className="truncate">{eyebrow}</span>
          </p>
        )}
        {title && (
          <div className="text-sm font-semibold tracking-tight text-[#F3EEE5] truncate">
            {title}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* =========================================================
   3. Inline SVG Sparkline Micro-chart
   ========================================================= */

export function BentoSparkline({
  data,
  color = "#39C6D8",
  height = 36,
  width = 120,
  fill = true,
  className,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  fill?: boolean;
  className?: string;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const usableHeight = height - padding * 2;
  const usableWidth = width;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * usableWidth;
    const y = height - padding - ((val - min) / range) * usableHeight;
    return [x, y] as [number, number];
  });

  // Generate smooth SVG curve using cubic bezier control points
  let pathD = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i !== points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }

  const fillD = `${pathD} L ${usableWidth} ${height} L 0 ${height} Z`;
  const gradientId = React.useId();

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && <path d={fillD} fill={`url(#${gradientId})`} />}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Latest value dot */}
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r="2.5"
        fill={color}
        className="animate-pulse"
      />
    </svg>
  );
}

/* =========================================================
   4. Bento KPI Tile with Sparkline & Delta
   ========================================================= */

export function BentoKpi({
  label,
  value,
  unit,
  changePct,
  changeLabel = "7D",
  sparklineData,
  sparklineColor = "#39C6D8",
  icon: Icon,
  accentColor = "brass",
  variant = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  changePct?: number;
  changeLabel?: string;
  sparklineData?: number[];
  sparklineColor?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accentColor?: BentoGlowColor;
  variant?: BentoCardVariant;
  className?: string;
}) {
  const isPositive = typeof changePct === "number" && changePct > 0;
  const isNegative = typeof changePct === "number" && changePct < 0;

  return (
    <BentoCard
      glowColor={accentColor}
      variant={variant}
      className={cn("p-4 flex flex-col justify-between", className)}
    >
      <div>
        <div className="flex items-center justify-between text-xs text-[#D8E2E8] mb-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#D8E2E8] font-semibold flex items-center gap-1.5">
            {Icon && <Icon className="size-3.5 text-[#35BFC3]" />}
            {label}
          </span>
          {typeof changePct === "number" && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold border",
                isPositive
                  ? "border-[#35BFC3]/50 bg-[#35BFC3]/15 text-[#35BFC3]"
                  : isNegative
                    ? "border-[#E87945]/50 bg-[#E87945]/15 text-[#E87945]"
                    : "border-[#24485C] bg-[#0D2233] text-[#D8E2E8]",
              )}
            >
              {isPositive ? (
                <ArrowUpRight className="size-3 text-[#35BFC3]" />
              ) : isNegative ? (
                <ArrowDownRight className="size-3 text-[#E87945]" />
              ) : (
                <Minus className="size-3" />
              )}
              {isPositive ? "+" : ""}
              {changePct.toFixed(1)}% {changeLabel}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="font-mono text-2xl lg:text-[1.75rem] font-bold text-[#F3EEE5] tracking-tight">
            {value}
          </span>
          {unit && (
            <span className="font-sans text-xs font-normal text-[#D8E2E8]">{unit}</span>
          )}
        </div>
      </div>

      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-3 pt-2.5 border-t border-[#263D50] flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#718397] font-medium">
            Trend
          </span>
          <BentoSparkline data={sparklineData} color={sparklineColor} height={28} width={110} />
        </div>
      )}
    </BentoCard>
  );
}

/* =========================================================
   5. Circular Fleet / Berth Progress Gauge
   ========================================================= */

export function BentoGauge({
  value,
  max = 100,
  label,
  sublabel,
  color = "#35CBB0",
  trackColor = "#192A3A",
  size = 110,
  strokeWidth = 9,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  trackColor?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center justify-center text-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg] overflow-visible">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center metric */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-bold text-[#F3EEE5] leading-none">
            {Math.round(pct)}%
          </span>
          {label && (
            <span className="mt-1 font-mono text-[9px] uppercase tracking-wider text-[#D8E2E8] font-semibold">
              {label}
            </span>
          )}
        </div>
      </div>
      {sublabel && (
        <p className="mt-2 text-xs text-[#D8E2E8] font-mono leading-tight max-w-[140px]">
          {sublabel}
        </p>
      )}
    </div>
  );
}

/* =========================================================
   6. Mirrored Trade Inflow Distribution Bar
   ========================================================= */

export function BentoFlowBar({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  unit = "t",
  leftColor = "#35BFC3",
  rightColor = "#E87945",
  className,
}: {
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
  unit?: string;
  leftColor?: string;
  rightColor?: string;
  className?: string;
}) {
  const total = leftValue + rightValue || 1;
  const leftPct = Math.round((leftValue / total) * 100);
  const rightPct = 100 - leftPct;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-[#F3EEE5] font-semibold flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: leftColor }} />
          {leftLabel} ({leftPct}%)
        </span>
        <span className="text-[#F3EEE5] font-semibold flex items-center gap-1.5">
          {rightLabel} ({rightPct}%)
          <span className="size-2 rounded-full" style={{ background: rightColor }} />
        </span>
      </div>

      {/* Segmented bar */}
      <div className="h-2.5 w-full rounded-full bg-[#0D2233] overflow-hidden flex border border-[#24485C]">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${leftPct}%`, background: leftColor }}
        />
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${rightPct}%`, background: rightColor }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-[#D8E2E8]">
        <span>
          {leftValue.toLocaleString()} {unit}
        </span>
        <span>
          {rightValue.toLocaleString()} {unit}
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   7. Bento Segmented Control (Pill Switcher)
   ========================================================= */

export function BentoSegmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string; badge?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-[#24485C] bg-[#0D2233] p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold transition-all duration-200",
              isSelected
                ? "bg-[#15364A] text-[#F3EEE5] shadow-sm border border-[#35BFC3]/40"
                : "text-[#D8E2E8] hover:text-[#F3EEE5] hover:bg-[#15364A]/50",
            )}
          >
            {opt.label}
            {opt.badge && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.2 text-[9px] font-bold",
                  isSelected
                    ? "bg-[#35BFC3]/20 text-[#35BFC3]"
                    : "bg-[#24485C] text-[#D8E2E8]",
                )}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
