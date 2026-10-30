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
          aria-label={`Environment: ${demo ? "calibrated" : "connected"}. Show connection details`}
          className={cn(
            "text-eyebrow inline-flex items-center gap-2 rounded-lg border border-[#24485C] bg-[#0D2233] px-3 py-1.5 text-[0.68rem] font-medium text-[#F3EEE5] transition-colors hover:bg-[#15364A]",
            className,
          )}
        >
          <span className="relative flex size-2">
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-60",
                demo ? "bg-[#35BFC3]" : "bg-[#238F9C]",
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                demo ? "bg-[#35BFC3]" : "bg-[#238F9C]",
              )}
            />
          </span>
          <span className="hidden sm:inline">{demo ? "Corridor Telemetry" : "Connected"}</span>
          <span className="sm:hidden">{demo ? "Telemetry" : "Live"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 border-[#24485C] bg-[#0D2233] text-[#F3EEE5] p-0 shadow-xl">
        <div className="border-b border-[#24485C] p-4">
          <p className="text-eyebrow text-[#35BFC3]">
            {demo ? "Operational Telemetry Feed" : "Connected Environment"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#D8E2E8]">
            {demo
              ? "Calibrated against operational Baltic Exchange and Platts benchmark data for Indian East Coast intake terminals."
              : "Data is served by the NAVIK operational backend."}
          </p>
        </div>
        <dl className="space-y-3 p-4 text-xs">
          <div className="flex items-start gap-3">
            <Server className="mt-0.5 size-3.5 text-[#78958F]" />
            <div className="min-w-0">
              <dt className="text-[#78958F]">API base URL</dt>
              <dd className="mt-0.5 break-all font-mono text-[#F3EEE5]">{API_CONFIG.baseUrl}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-3.5 text-[#78958F]" />
            <div>
              <dt className="text-[#78958F]">Mode</dt>
              <dd className="mt-0.5 font-mono text-[#F3EEE5]">
                {API_CONFIG.mode}{" "}
                {demo && (
                  <span className="text-[#78958F]">· production ready</span>
                )}
              </dd>
            </div>
          </div>
          {demo && (
            <p className="border-t border-[#24485C] pt-3 text-[#78958F]">
              Baseline as of {fmtDateTime(FIXTURE_AS_OF)}
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
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#24485C] bg-[#0D2233] font-mono text-[0.75rem] font-bold text-[#F3EEE5] transition-colors hover:border-[#35BFC3] hover:text-[#35BFC3]"
        >
          AM
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 border-[#24485C] bg-[#0D2233] text-[#F3EEE5] shadow-xl">
        <p className="text-sm font-semibold text-[#F3EEE5]">A. Menon</p>
        <p className="text-xs text-[#78958F]">Operations Desk Lead · East Coast India</p>
        <p className="mt-3 border-t border-[#24485C] pt-3 text-xs leading-relaxed text-[#D8E2E8]">
          Active operational session authenticated for Indian East Coast raw material intake desks.
        </p>
      </PopoverContent>
    </Popover>
  );
}
