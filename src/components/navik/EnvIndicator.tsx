import { useState } from "react";
import { Server, ShieldCheck, Activity, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { API_CONFIG } from "@/lib/api/config";
import { backendHealthQuery } from "@/lib/api/queries";
import { fmtDateTime } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function EnvIndicator({ className }: { className?: string }) {
  const { data: health, isLoading, isError, refetch } = useQuery(backendHealthQuery());
  const [isRetrying, setIsRetrying] = useState(false);

  const isConnected = !isLoading && !isError && health?.status === "ok";

  const handleRetry = async () => {
    setIsRetrying(true);
    await refetch();
    setTimeout(() => setIsRetrying(false), 500);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Environment: ${isConnected ? "Backend Connected" : "Local Calibrated"}. Show connection details`}
          className={cn(
            "text-eyebrow inline-flex items-center gap-2 rounded-lg border border-[#24485C] bg-[#0D2233] px-3 py-1.5 text-[0.68rem] font-medium text-[#F3EEE5] transition-colors hover:bg-[#15364A]",
            className,
          )}
        >
          <span className="relative flex size-2">
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-60",
                isConnected ? "bg-[#35BFC3]" : "bg-[#F2B653]",
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                isConnected ? "bg-[#35BFC3]" : "bg-[#F2B653]",
              )}
            />
          </span>
          <span className="hidden sm:inline">
            {isConnected ? "Backend Connected" : "Local Engine"}
          </span>
          <span className="sm:hidden">{isConnected ? "Live" : "Local"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-84 border-[#24485C] bg-[#0D2233] text-[#F3EEE5] p-0 shadow-xl">
        <div className="border-b border-[#24485C] p-4">
          <div className="flex items-center justify-between">
            <p className={cn("text-eyebrow font-semibold", isConnected ? "text-[#35BFC3]" : "text-[#F2B653]")}>
              {isConnected ? "Freight Intelligence API Connected" : "Local Intelligence Engine"}
            </p>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider",
                isConnected
                  ? "bg-[#35BFC3]/15 text-[#35BFC3] border border-[#35BFC3]/30"
                  : "bg-[#F2B653]/15 text-[#F2B653] border border-[#F2B653]/30",
              )}
            >
              {isConnected ? "LIVE (200 OK)" : "FALLBACK"}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#D8E2E8]">
            {isConnected
              ? "Live communication established with Python FastAPI backend. Real-time LightGBM quantile forecasts, MILP procurement optimizer, and historical market data active."
              : "Backend currently unreachable. Fallback deterministic simulation engines active with full historical calibration."}
          </p>
        </div>
        <dl className="space-y-3 p-4 text-xs">
          <div className="flex items-start gap-3">
            <Server className="mt-0.5 size-3.5 text-[#78958F]" />
            <div className="min-w-0">
              <dt className="text-[#78958F]">API Endpoint</dt>
              <dd className="mt-0.5 break-all font-mono text-[#F3EEE5]">{API_CONFIG.baseUrl}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Activity className="mt-0.5 size-3.5 text-[#78958F]" />
            <div>
              <dt className="text-[#78958F]">Model Version & Engine</dt>
              <dd className="mt-0.5 font-mono text-[#F3EEE5]">
                {health?.model_version ?? "LightGBM Quantile Ensemble"}
              </dd>
            </div>
          </div>
          {health?.data_last_updated && (
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-3.5 text-[#78958F]" />
              <div>
                <dt className="text-[#78958F]">Data Ingestion Timestamp</dt>
                <dd className="mt-0.5 font-mono text-[#F3EEE5]">
                  {fmtDateTime(health.data_last_updated)}
                </dd>
              </div>
            </div>
          )}
          {typeof health?.cache_age_seconds === "number" && (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 size-3.5 flex items-center justify-center text-[0.65rem] text-[#78958F]">⏱</span>
              <div>
                <dt className="text-[#78958F]">Cache Freshness</dt>
                <dd className="mt-0.5 font-mono text-[#F3EEE5]">
                  {Math.round(health.cache_age_seconds)}s ago
                </dd>
              </div>
            </div>
          )}
          <div className="pt-2 border-t border-[#24485C] flex items-center justify-between">
            <span className="text-[0.7rem] text-[#78958F]">Port 8000 · FastAPI</span>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-1.5 rounded bg-[#15364A] hover:bg-[#24485C] px-2.5 py-1 text-[0.7rem] font-medium text-[#35BFC3] transition-colors"
            >
              <RefreshCw className={cn("size-3", isRetrying && "animate-spin")} />
              <span>{isRetrying ? "Checking..." : "Retry Connection"}</span>
            </button>
          </div>
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
