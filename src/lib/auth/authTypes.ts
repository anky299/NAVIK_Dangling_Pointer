/**
 * NAVIK Authentication Types
 * Standard OpenID identity model for Google-authenticated maritime operators.
 */

export type UserRole = "USER" | "ADMIN";
export type AccountStatus = "ACTIVE" | "SUSPENDED" | "PENDING";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  account_status: AccountStatus;
  avatar_url?: string | null;
  company_name?: string | null;
  google_sub?: string | null;
  firebase_uid?: string;
}

export interface AuthSession {
  session_token: string;
  expires_at: number;
  user: AuthUser;
}

export interface AuthConfigStatus {
  google_client_id_configured: boolean;
  google_client_id_hint: string | null;
  active_sessions_count: number;
}

