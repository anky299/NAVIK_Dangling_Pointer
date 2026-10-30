import type { ApiMode } from "./types";

/**
 * NAVIK API configuration.
 *
 * To connect the Python backend, set in `.env`:
 *   VITE_NAVIK_API_BASE_URL=https://your-backend.example.com/api/v1
 *   VITE_NAVIK_API_MODE=live
 *
 * Only public values belong here — never put secrets in VITE_ variables.
 * Until live mode is enabled every service returns clearly labelled demo fixtures.
 */
const env = import.meta.env as Record<string, string | undefined>;

export const API_CONFIG = {
  baseUrl: (env["VITE_NAVIK_API_BASE_URL"] ?? "http://localhost:8000").replace(/\/$/, ""),
  mode: (env["VITE_NAVIK_API_MODE"] === "live" ? "live" : "demo") as ApiMode,
  timeoutMs: 60_000,
  /** Artificial latency for demo calls that represent heavy computation (ms). */
  demoLatencyMs: 650,
} as const;

export const isDemoMode = () => API_CONFIG.mode === "demo";

/** Reference "now" for all demo fixtures, so the prototype is deterministic. */
export const FIXTURE_AS_OF = "2026-10-25T06:00:00Z";
