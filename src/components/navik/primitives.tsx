import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Decision, FeasibilityStatus, RiskLevel, Trend } from "@/lib/api/types";
import { DECISION_LABELS, RISK_LABELS } from "@/lib/api/reference";

type TagKind = "demo" | "simulated" | "local" | "live";

const TAG_TEXT: Record<TagKind, string> = {
  demo: "Demo data",
  simulated: "Simulated",
  local: "Local demo",
  live: "Live",
};

/** Discreet provenance label. Use on any fixture- or simulation-backed content. */
export function DemoTag({
  kind = "demo",
  className,
  title,
}: {
  kind?: TagKind;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={
        title ??
        (kind === "live"
          ? "Served by the NAVIK backend"
          : "Illustrative values — not live market data")
      }
      className={cn(
        "text-eyebrow inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[0.6rem] leading-none",
        kind === "live"
          ? "border-success/40 text-success"
          : kind === "simulated"
            ? "border-copper/45 text-copper"
            : "border-brass/40 text-brass",
        className,
      )}
    >
      <span
        className={cn(
          "size-1 rounded-full",
          kind === "live" ? "bg-success" : kind === "simulated" ? "bg-copper" : "bg-brass",
        )}
      />
      {TAG_TEXT[kind]}
    </span>
  );
}

export function Eyebrow({
  children,
  className,
  index,
}: {
  children: ReactNode;
  className?: string;
  index?: string;
}) {
  return (
    <p className={cn("text-eyebrow flex items-center gap-3 text-brass", className)}>
      {index && <span className="text-muted-foreground">{index}</span>}
      {index && <span className="h-px w-6 bg-current opacity-40" />}
      {children}
    </p>
  );
}

export function PageHeader({
  eyebrow,
  title,
  accent,
  description,
  actions,
  tag,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  description?: string;
  actions?: ReactNode;
  tag?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-6 pb-8 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <Eyebrow>{eyebrow}</Eyebrow>
          {tag}
        </div>
        <h1 className="text-display mt-4 text-[2.4rem] text-foreground sm:text-5xl lg:text-[3.5rem]">
          {title} {accent && <span className="serif-accent text-[#C88C78]">{accent}</span>}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-[0.95rem] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function TrendIcon({ trend, className }: { trend: Trend; className?: string }) {
  const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return <Icon className={cn("size-3.5", className)} aria-hidden />;
}

export function Delta({
  value,
  unit = "%",
  invert = false,
  className,
}: {
  value: number;
  unit?: string;
  invert?: boolean;
  className?: string;
}) {
  const good = invert ? value < 0 : value > 0;
  const trend: Trend = value > 0 ? "up" : value < 0 ? "down" : "flat";
  return (
    <span
      className={cn(
        "font-tabular inline-flex items-center gap-0.5 font-mono text-xs",
        value === 0 ? "text-muted-foreground" : good ? "text-success" : "text-copper",
        className,
      )}
    >
      <TrendIcon trend={trend} />
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}
      {unit}
    </span>
  );
}

export function Metric({
  label,
  value,
  unit,
  sub,
  className,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizes = { sm: "text-xl", md: "text-3xl", lg: "text-4xl", xl: "text-5xl sm:text-6xl" };
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-eyebrow text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-tabular mt-2 font-mono font-medium tracking-tight text-foreground",
          sizes[size],
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 font-sans text-[0.45em] font-medium tracking-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

const DECISION_STYLE: Record<Decision, string> = {
  CHARTER_NOW: "bg-[#B96F50] text-[#FAF5EC] font-bold shadow-[0_2px_8px_rgba(185,111,80,0.35)]",
  WAIT: "bg-[#382720] border border-[#D7B88C]/35 text-[#F2E6D5] font-semibold",
  SPLIT: "bg-[#D7B88C] text-[#382720] font-bold shadow-sm",
};

export function DecisionBadge({ decision, className }: { decision: Decision; className?: string }) {
  return (
    <span
      className={cn(
        "text-eyebrow inline-flex items-center rounded-sm px-2.5 py-1 text-[0.62rem] font-bold tracking-wider",
        DECISION_STYLE[decision],
        className,
      )}
    >
      {DECISION_LABELS[decision]}
    </span>
  );
}

const RISK_STYLE: Record<RiskLevel, string> = {
  LOW: "text-[#D7B88C] border-[#D7B88C]/40 bg-[#79513D]/25 font-semibold",
  MODERATE: "text-[#D7B88C] border-[#D7B88C]/50 bg-[#D7B88C]/15 font-semibold",
  ELEVATED: "text-[#C88C78] border-[#B96F50]/50 bg-[#B96F50]/15 font-semibold",
  HIGH: "text-crimson border-crimson/50 bg-crimson/15 font-bold",
};

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <span
      className={cn(
        "text-eyebrow inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[0.62rem] font-mono",
        RISK_STYLE[level],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
      {RISK_LABELS[level]}
    </span>
  );
}

const FEAS_STYLE: Record<FeasibilityStatus, string> = {
  FEASIBLE: "text-[#FAF5EC] border-[#D7B88C]/40 bg-[#79513D]/25 font-semibold",
  CONDITIONAL: "text-[#D7B88C] border-[#D7B88C]/50 bg-[#D7B88C]/15 font-semibold",
  REJECTED: "text-crimson border-crimson/50 bg-crimson/15 font-bold",
};

export function FeasibilityBadge({
  status,
  className,
}: {
  status: FeasibilityStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-eyebrow inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[0.58rem]",
        FEAS_STYLE[status],
        className,
      )}
    >
      {status === "FEASIBLE" ? "Feasible" : status === "CONDITIONAL" ? "Conditional" : "Rejected"}
    </span>
  );
}

export function PanelHeader({
  title,
  eyebrow,
  right,
  className,
}: {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-eyebrow text-muted-foreground">{eyebrow}</p>}
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-md border border-border p-0.5", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-[5px] px-3 py-1.5 font-mono text-[0.7rem] tracking-wider transition-colors",
              active
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
