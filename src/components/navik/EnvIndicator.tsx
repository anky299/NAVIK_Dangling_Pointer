import { useState } from "react";
import { Server, ShieldCheck, Activity, RefreshCw, LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { API_CONFIG } from "@/lib/api/config";
import { backendHealthQuery } from "@/lib/api/queries";
import { fmtDateTime } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/AuthContext";

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
  const { user, signOut } = useAuth();

  const displayName = user?.name || "A. Menon";
  const displayRole = user?.role 
    ? `${user.role} · ${user.company_name || "Raw Material Intake"}`
    : "Operations Desk Lead · East Coast India";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Operator profile"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#24485C] bg-[#0D2233] font-mono text-[0.75rem] font-bold text-[#F3EEE5] transition-colors hover:border-[#35BFC3] hover:text-[#35BFC3] overflow-hidden"
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={displayName} className="size-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-76 border-[#24485C] bg-[#0D2233] text-[#F3EEE5] shadow-xl">
        <div className="flex items-center gap-3">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={displayName} className="size-10 rounded-full border border-[#35BFC3]/40 object-cover" />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-full border border-[#35BFC3]/40 bg-[#15364A] font-mono text-xs font-bold text-[#35BFC3]">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-[#F3EEE5]">{displayName}</p>
            <p className="truncate text-xs font-mono text-[#78958F]">{user?.email || "ops@navik.maritime"}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-[#35BFC3] font-mono">{displayRole}</p>
        <p className="mt-3 border-t border-[#24485C] pt-3 text-xs leading-relaxed text-[#D8E2E8]">
          Active operational session authenticated for Indian East Coast raw material intake desks.
        </p>
        {user && (
          <div className="mt-3 pt-2 border-t border-[#24485C] flex justify-end">
            <button
              type="button"
              onClick={() => {
                signOut();
                if (typeof window !== "undefined") {
                  window.location.href = "/";
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 transition-colors"
            >
              <LogOut className="size-3" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
