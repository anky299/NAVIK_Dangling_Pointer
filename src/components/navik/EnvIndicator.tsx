import { Server, ShieldCheck } from "lucide-react";
import { API_CONFIG, FIXTURE_AS_OF, isDemoMode } from "@/lib/api/config";
import { fmtDateTime } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function EnvIndicator({ className }: { className?: string }) {
  const demo = isDemoMode();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Environment: ${demo ? "demo" : "live"}. Show connection details`}
          className={cn(
            "text-eyebrow inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[0.6rem] transition-colors hover:bg-accent",
            demo ? "border-brass/40 text-brass" : "border-success/40 text-success",
            className,
          )}
        >
          <span className="relative flex size-1.5">
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-60",
                demo ? "bg-brass" : "bg-success",
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-1.5 rounded-full",
                demo ? "bg-brass" : "bg-success",
              )}
            />
          </span>
          <span className="hidden sm:inline">{demo ? "Demo env" : "Live"}</span>
          <span className="sm:hidden">{demo ? "Demo" : "Live"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 border-border bg-popover p-0">
        <div className="border-b border-border p-4">
          <p className="text-eyebrow text-brass">
            {demo ? "Demo environment" : "Live environment"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {demo
              ? "Every figure in this prototype comes from illustrative fixtures or frontend simulations. No live market feed or model inference is connected."
              : "Data is served by the NAVIK backend."}
          </p>
        </div>
        <dl className="space-y-3 p-4 text-xs">
          <div className="flex items-start gap-3">
            <Server className="mt-0.5 size-3.5 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-muted-foreground">API base URL</dt>
              <dd className="mt-0.5 break-all font-mono text-foreground">{API_CONFIG.baseUrl}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-3.5 text-muted-foreground" />
            <div>
              <dt className="text-muted-foreground">Mode</dt>
              <dd className="mt-0.5 font-mono text-foreground">
                {API_CONFIG.mode}{" "}
                {demo && (
                  <span className="text-muted-foreground">· set VITE_NAVIK_API_MODE=live</span>
                )}
              </dd>
            </div>
          </div>
          {demo && (
            <p className="border-t border-border pt-3 text-muted-foreground">
              Fixtures as of {fmtDateTime(FIXTURE_AS_OF)}
            </p>
          )}
        </dl>
      </PopoverContent>
    </Popover>
  );
}

export function OperatorBadge() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Operator profile"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-gradient-to-br from-ink to-abyss font-mono text-[0.7rem] font-medium text-brass transition-colors hover:border-brass/50"
        >
          AM
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 border-border bg-popover">
        <p className="text-sm font-semibold">A. Menon</p>
        <p className="text-xs text-muted-foreground">Chartering desk · demo operator</p>
        <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          Placeholder profile. Sign-in and role enforcement will be handled by the NAVIK backend
          once it is connected.
        </p>
      </PopoverContent>
    </Popover>
  );
}
