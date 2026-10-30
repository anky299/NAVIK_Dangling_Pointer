/**
 * NAVIK Authentication Context
 * Real Firebase Google Authentication & Session Persistence
 * 
 * Strict Application Rules:
 * - Real Firebase Modular SDK (navik-dd29d)
 * - Session restoration via onAuthStateChanged
 * - No fake authentication, no demo users, no localStorage token faking
 * - Clean service boundary for future backend FastAPI token verification
 */
import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { User } from "firebase/auth";
import type { AuthUser } from "./authTypes";
import {
  signInWithGoogle,
  signOutUser,
  getFirebaseIdToken,
  subscribeToAuthState,
  isFirebaseConfigured,
} from "@/lib/firebase/config";

export interface AuthContextValue {
  user: AuthUser | null;
  firebaseUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthenticating: boolean;
  error: string | null;
  isFirebaseConfigured: boolean;
  signInWithGoogle: () => Promise<AuthUser>;
  signInWithGoogleCredential?: (credential: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirebaseUser(fbUser: User): AuthUser {
  return {
    id: fbUser.uid,
    name: fbUser.displayName || (fbUser.email ? fbUser.email.split("@")[0] : "Maritime Operator"),
    email: fbUser.email || "",
    avatar_url: fbUser.photoURL || null,
    role: "USER",
    account_status: "ACTIVE",
    google_sub: fbUser.providerData[0]?.uid || fbUser.uid,
    firebase_uid: fbUser.uid,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to real Firebase Auth State changes (session persistence)
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToAuthState((fbUser) => {
      if (!isMounted) return;

      if (fbUser) {
        const mappedUser = mapFirebaseUser(fbUser);
        setUser(mappedUser);
        setFirebaseUser(fbUser);
      } else {
        setUser(null);
        setFirebaseUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Real Google Sign-in via Firebase popup
  const handleSignInWithGoogle = useCallback(async (): Promise<AuthUser> => {
    if (isAuthenticating) {
      throw new Error("Authentication request already in progress.");
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const fbUser = await signInWithGoogle();
      const mappedUser = mapFirebaseUser(fbUser);
      setUser(mappedUser);
      setFirebaseUser(fbUser);
      return mappedUser;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google authentication failed";
      setError(message);
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  }, [isAuthenticating]);

  // Real Firebase Sign-out
  const handleSignOut = useCallback(async () => {
    setError(null);
    try {
      await signOutUser();
      setUser(null);
      setFirebaseUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-out failed";
      setError(message);
    }
  }, []);

  // Retrieve Firebase ID Token for future backend verification
  const handleGetIdToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    return await getFirebaseIdToken(forceRefresh);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value: AuthContextValue = {
    user,
    firebaseUser,
    isAuthenticated: Boolean(user),
    isLoading,
    isAuthenticating,
    error,
    isFirebaseConfigured,
    signInWithGoogle: handleSignInWithGoogle,
    signOut: handleSignOut,
    getIdToken: handleGetIdToken,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
