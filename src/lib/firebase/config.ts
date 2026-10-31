/**
 * NAVIK Central Firebase Configuration & Authentication Service
 * 
 * Modular Firebase JavaScript SDK (v11+)
 * Project: navik-dd29d
 * Google Authentication enabled
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
  type Unsubscribe,
} from "firebase/auth";

export interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * Helper to defensively clean environment variables against common Vercel/dashboard
 * formatting issues (e.g. accidentally pasting 'VAR_NAME=value' or extra newlines/quotes).
 */
function cleanEnvValue(val: unknown): string {
  if (typeof val !== "string") return "";
  let trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx !== -1 && /^[A-Za-z0-9_]+=\s*/.test(trimmed)) {
    trimmed = trimmed.slice(eqIdx + 1).trim();
  }
  if (trimmed.includes("\n") || trimmed.includes("\r")) {
    const lines = trimmed
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const validLine = lines.find((l) => !l.includes("=")) || lines[lines.length - 1];
    trimmed = (validLine || "").trim();
  }
  return trimmed;
}

// 1. Validate required environment variables without exposing secrets
const apiKey = cleanEnvValue(import.meta.env.VITE_FIREBASE_API_KEY);
const authDomain = cleanEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
const projectId = cleanEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID);
const storageBucket = cleanEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
const messagingSenderId = cleanEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
const appId = cleanEnvValue(import.meta.env.VITE_FIREBASE_APP_ID);

export const isFirebaseConfigured = Boolean(
  apiKey &&
  authDomain &&
  projectId &&
  appId &&
  !apiKey.startsWith("YOUR_") &&
  apiKey !== "placeholder"
);

if (!isFirebaseConfigured && typeof window !== "undefined") {
  console.warn(
    "[NAVIK Firebase] Firebase configuration missing or incomplete. Ensure VITE_FIREBASE_* variables are set in .env.local or Vercel Environment Variables."
  );
}

const firebaseConfig: FirebaseEnvConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

// 2. Initialize Firebase exactly once (SSR safe)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (typeof window !== "undefined" && isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    // Prompt Google account chooser every time for clear multi-operator selection
    googleProvider.setCustomParameters({
      prompt: "select_account",
    });
  } catch (error) {
    console.error("[NAVIK Firebase] Initialization error:", error);
  }
}

export { app, auth, googleProvider };

/**
 * Friendly error message mapper for Firebase Authentication errors.
 * Hides low-level technical internals while giving clear instructions to maritime operators.
 */
export function getFirebaseErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "An unexpected authentication error occurred. Please try again.";
  }

  const code = "code" in error ? String((error as { code: unknown }).code) : "";

  switch (code) {
    case "auth/popup-closed-by-user":
      return "Sign-in cancelled: The Google authentication window was closed before completion.";
    case "auth/popup-blocked":
      return "The Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.";
    case "auth/cancelled-popup-request":
      return "Authentication was cancelled because another sign-in request was initiated.";
    case "auth/network-request-failed":
      return "Network connection error. Please verify your internet connection and try again.";
    case "auth/unauthorized-domain": {
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "navik-dangling-pointer.vercel.app";
      return `Domain "${currentHost}" is not authorized for Firebase Authentication. Please add "${currentHost}" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`;
    }
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email address under a different sign-in method.";
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled in Firebase Console. Please enable Google provider.";
    case "auth/user-disabled":
      return "This maritime operator account has been deactivated. Contact platform administration.";
    default: {
      const rawMessage =
        "message" in error && typeof (error as { message: unknown }).message === "string"
          ? String((error as { message: unknown }).message).replace(/^Firebase:\s*/i, "")
          : "Google authentication failed. Please verify your credentials and try again.";
      return code ? `[${code}] ${rawMessage}` : rawMessage;
    }
  }
}

/**
 * Trigger Real Google Authentication using Firebase signInWithPopup.
 * Supports both first-time account registration and returning operator login.
 */
export async function signInWithGoogle(): Promise<User> {
  if (!isFirebaseConfigured || !auth || !googleProvider) {
    const missing: string[] = [];
    if (!apiKey) missing.push("VITE_FIREBASE_API_KEY");
    if (!authDomain) missing.push("VITE_FIREBASE_AUTH_DOMAIN");
    if (!projectId) missing.push("VITE_FIREBASE_PROJECT_ID");
    if (!appId) missing.push("VITE_FIREBASE_APP_ID");
    console.error("[NAVIK Firebase] Firebase is not configured. Missing variables:", missing);
    throw new Error(
      `Firebase is not configured. Missing variables: ${missing.join(", ") || "Configuration incomplete"}. Ensure these are set in Vercel Environment Variables.`
    );
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "unknown";
    console.error(`[NAVIK Firebase] Google authentication error [code: ${code}]:`, error);
    const friendlyMessage = getFirebaseErrorMessage(error);
    const mappedError = new Error(friendlyMessage);
    (mappedError as unknown as { code?: string }).code = code;
    throw mappedError;
  }
}

/**
 * Sign out the currently active Firebase user.
 */
export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

/**
 * Retrieve the current Firebase user's ID token for future backend API authorization.
 * Phase 8: Clean service boundary for future FastAPI token verification.
 */
export async function getFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth || !auth.currentUser) return null;
  return await auth.currentUser.getIdToken(forceRefresh);
}

/**
 * Subscribe to Firebase Auth state changes with automatic session restoration.
 */
export function subscribeToAuthState(
  callback: (user: User | null) => void
): Unsubscribe {
  if (!auth) {
    // If auth is not ready (e.g. during SSR), immediately report null
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

