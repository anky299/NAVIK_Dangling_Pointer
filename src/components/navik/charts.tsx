import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared Recharts styling so every chart reads as one family. */
export const AXIS = {
  stroke: "var(--color-muted-foreground)",
  tick: { fill: "var(--color-muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" },
  tickLine: false,
  axisLine: false,
} as const;

export const GRID = {
  stroke: "var(--color-border)",
  strokeDasharray: "2 6",
  vertical: false,
} as const;

interface Row {
  label: string;
  value: ReactNode;
  color?: string;
}

/** Ink tooltip card used by every chart. */
export function TooltipCard({
  title,
  rows,
  note,
  className,
}: {
  title: ReactNode;
  rows: Row[];
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-[180px] rounded-md border border-border bg-popover/95 px-3 py-2.5 text-xs shadow-deep backdrop-blur-md",
        className,
      )}
    >
      <p className="text-eyebrow text-[0.58rem] text-muted-foreground">{title}</p>
      <div className="mt-2 space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {r.color && <span className="size-2 rounded-[2px]" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="font-tabular font-mono text-foreground">{r.value}</span>
          </div>
        ))}
      </div>
      {note && (
        <p className="mt-2 border-t border-border pt-1.5 text-[0.68rem] text-brass">{note}</p>
      )}
    </div>
  );
}

export function Legend({
  items,
  className,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.7rem] text-muted-foreground",
        className,
      )}
    >
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span
            className="h-[2px] w-4"
            style={
              i.dashed
                ? {
                    backgroundImage: `linear-gradient(90deg, ${i.color} 50%, transparent 50%)`,
                    backgroundSize: "6px 2px",
                  }
                : { background: i.color }
            }
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
