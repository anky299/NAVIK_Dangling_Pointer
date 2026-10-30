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

// 1. Validate required environment variables without exposing secrets
const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string) || "";
const authDomain = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || "";
const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || "";
const storageBucket = (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || "";
const messagingSenderId = (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "";
const appId = (import.meta.env.VITE_FIREBASE_APP_ID as string) || "";

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
    "[NAVIK Firebase] Firebase configuration missing or incomplete. Ensure VITE_FIREBASE_* variables are set in .env.local."
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
    case "auth/unauthorized-domain":
      return "This domain is not authorized in Firebase Authentication Console. Please add your current domain to Firebase Console > Authentication > Settings > Authorized Domains.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email address under a different sign-in method.";
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled in Firebase Console. Please enable Google provider.";
    case "auth/user-disabled":
      return "This maritime operator account has been deactivated. Contact platform administration.";
    default:
      if ("message" in error && typeof error.message === "string") {
        // Return clean message if available without raw stack trace
        return error.message.replace(/^Firebase:\s*/i, "");
      }
      return "Google authentication failed. Please verify your credentials and try again.";
  }
}

/**
 * Trigger Real Google Authentication using Firebase signInWithPopup.
 * Supports both first-time account registration and returning operator login.
 */
export async function signInWithGoogle(): Promise<User> {
  if (!isFirebaseConfigured || !auth || !googleProvider) {
    throw new Error(
      "Firebase is not configured. Please ensure VITE_FIREBASE_* variables are set in .env.local."
    );
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    const friendlyMessage = getFirebaseErrorMessage(error);
    const mappedError = new Error(friendlyMessage);
    (mappedError as unknown as { code?: string }).code =
      (error as { code?: string })?.code;
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

