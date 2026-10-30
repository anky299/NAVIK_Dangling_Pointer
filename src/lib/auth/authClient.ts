/**
 * NAVIK Authentication API Client
 * Interacts with FastAPI `/api/v1/auth` endpoints.
 */
import { API_CONFIG } from "@/lib/api/config";
import type { AuthConfigStatus, AuthSession, AuthUser } from "./authTypes";

const SESSION_STORAGE_KEY = "navik_auth_session";

export async function getAuthConfigStatus(): Promise<AuthConfigStatus> {
  try {
    const base = API_CONFIG.baseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/api/v1/auth/config`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Failed to load auth config");
    return (await res.json()) as AuthConfigStatus;
  } catch {
    return {
      google_client_id_configured: false,
      google_client_id_hint: null,
      active_sessions_count: 0,
    };
  }
}

export async function authenticateWithGoogleBackend(payload: {
  credential?: string;
  access_token?: string;
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
}): Promise<AuthSession> {
  const base = API_CONFIG.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1/auth/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Authentication failed with status ${res.status}`);
  }

  const session = (await res.json()) as AuthSession;
  saveLocalSession(session);
  return session;
}

export async function verifyCurrentSession(sessionToken: string): Promise<AuthUser | null> {
  try {
    const base = API_CONFIG.baseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as AuthUser;
  } catch {
    return null;
  }
}

export async function logoutBackend(sessionToken?: string): Promise<void> {
  if (sessionToken) {
    try {
      const base = API_CONFIG.baseUrl.replace(/\/$/, "");
      await fetch(`${base}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          Accept: "application/json",
        },
      });
    } catch {
      // Best-effort backend notification
    }
  }
  clearLocalSession();
}

export function getSavedSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (session.expires_at && Date.now() / 1000 > session.expires_at) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveLocalSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    sessionStorage.setItem("navik_authenticated", "true");
  } catch {}
}

export function clearLocalSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem("navik_authenticated");
  } catch {}
}

