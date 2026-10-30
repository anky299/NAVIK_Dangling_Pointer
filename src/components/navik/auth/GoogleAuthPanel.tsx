/**
 * NAVIK Minimal Google-Only Authentication Panel
 * Real Firebase Google Authentication & Session Presentation
 * 
 * Flow:
 * 1. Brand Wordmark & Close Button (returns to continuous rotating globe)
 * 2. Heading: "Welcome to NAVIK"
 * 3. Supporting text: "Sign in or create an account to access your maritime intelligence workspace."
 * 4. Primary Google Button: "Continue with Google" (Official Google "G" emblem)
 * 5. Real Firebase signInWithPopup(auth, googleProvider) execution
 * 6. Privacy Note: "Secure authentication powered by Google."
 * 7. Real Authenticated Operator Presentation (Google photo, display name, email, verified badge)
 * 8. "Continue to NAVIK" action (appears ONLY after real Firebase authentication)
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, AlertCircle, ArrowRight, ShieldCheck, LogOut, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { AuthUser } from "@/lib/auth/authTypes";
import { useAuth } from "@/lib/auth/AuthContext";

/** Official Google "G" Multi-Color Vector Emblem */
export const GoogleLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
      fill="#4285F4"
    />
    <path
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.36 7.33 24 12 24z"
      fill="#34A853"
    />
    <path
      d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.24C.45 8.14 0 9.99 0 12s.45 3.86 1.24 5.43l4.04-3.14z"
      fill="#FBBC05"
    />
    <path
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.57l4.04 3.14c.95-2.83 3.6-4.96 6.72-4.96z"
      fill="#EA4335"
    />
  </svg>
);

export interface GoogleAuthPanelProps {
  isOpen?: boolean;
  onClose: () => void;
  onContinue?: () => void;
  onGoogleSignIn?: () => Promise<void> | void;
  onSignOut?: () => Promise<void> | void;
  user?: AuthUser | null;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  error?: string | null;
}

export function GoogleAuthPanel({
  isOpen = true,
  onClose,
  onContinue,
  onGoogleSignIn,
  onSignOut,
  user: propUser,
  isAuthenticated: propIsAuthenticated,
  isLoading: propIsLoading,
  error: propError,
}: GoogleAuthPanelProps) {
  // Use AuthContext as fallback if props are not explicitly provided
  let authContext: ReturnType<typeof useAuth> | null = null;
  try {
    authContext = useAuth();
  } catch {
    // In standalone tests where AuthProvider is not rendered
  }

  const user = propUser !== undefined ? propUser : authContext?.user ?? null;
  const isAuthenticated = propIsAuthenticated !== undefined ? propIsAuthenticated : authContext?.isAuthenticated ?? false;
  const isLoading = propIsLoading !== undefined ? propIsLoading : authContext?.isLoading ?? false;
  const isAuthenticating = authContext?.isAuthenticating ?? false;
  const error = propError !== undefined ? propError : authContext?.error ?? null;
  const isFirebaseConfigured = authContext?.isFirebaseConfigured ?? true;

  const [activeModal, setActiveModal] = useState<"terms" | "privacy" | null>(null);
  const [localConfigNotice, setLocalConfigNotice] = useState(false);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Primary Google authentication trigger
  const handleGoogleClick = useCallback(async () => {
    setLocalConfigNotice(false);

    if (!isFirebaseConfigured) {
      setLocalConfigNotice(true);
      return;
    }

    try {
      setLocalSubmitting(true);
      if (onGoogleSignIn) {
        await onGoogleSignIn();
      } else if (authContext?.signInWithGoogle) {
        await authContext.signInWithGoogle();
      }
    } catch {
      // Error message is caught and set in AuthContext or propError
    } finally {
      setLocalSubmitting(false);
    }
  }, [isFirebaseConfigured, onGoogleSignIn, authContext]);

  const handleSignOutClick = useCallback(async () => {
    if (onSignOut) {
      await onSignOut();
    } else if (authContext?.signOut) {
      await authContext.signOut();
    }
  }, [onSignOut, authContext]);

  const isBusy = isLoading || isAuthenticating || localSubmitting;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 sm:p-6 pointer-events-auto bg-[#010409]/45 backdrop-blur-[2px]">
      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to NAVIK authentication"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[420px] rounded-2xl border border-[#15364A]/90 bg-[#0D2233]/85 p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-[#F3EEE5] selection:bg-[#35BFC3]/30"
      >
        {/* 1. Header with NAVIK Branding & Close Action */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded border border-[#35BFC3]/40 bg-[#081827] text-[#35BFC3] font-mono text-[0.68rem] font-bold">
              N
            </div>
            <span className="font-mono text-xs tracking-widest text-[#D8E2E8] font-semibold">
              NAVIK
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[#D8E2E8]/60 hover:text-[#F3EEE5] hover:bg-[#15364A]/60 transition-colors focus:outline-none focus:ring-1 focus:ring-[#35BFC3]"
            aria-label="Close and return to rotating globe"
            title="Return to globe"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 2. Heading and Supporting Text */}
        <div className="text-center mb-6">
          <h2 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#F3EEE5] mb-2">
            Welcome to NAVIK
          </h2>
          <p className="font-sans text-xs sm:text-sm text-[#D8E2E8]/75 leading-relaxed">
            {isAuthenticated
              ? "Signed in with Google. Proceed to your maritime workspace."
              : "Sign in or create an account to access your maritime intelligence workspace."}
          </p>
        </div>

        {/* Error notification banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-200"
          >
            <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
            <span className="flex-1 leading-snug">{error}</span>
          </motion.div>
        )}

        {/* 3. Primary Authentication Content */}
        {!isAuthenticated ? (
          <div className="flex flex-col gap-3">
            {/* Primary Google Action Button */}
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={isBusy}
              id="navik-google-auth-button"
              aria-label="Continue with Google"
              className="group relative flex w-full items-center justify-center gap-3 rounded-lg border border-[#D8E2E8]/30 bg-white px-4 py-3 text-sm font-medium text-[#1f2937] shadow-md transition-all hover:bg-[#F3EEE5] hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              <GoogleLogo size={18} />
              <span>
                {isBusy ? "Connecting to Google..." : "Continue with Google"}
              </span>
              <ArrowRight className="size-4 opacity-40 transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* Privacy Note */}
            <div className="flex items-center justify-center gap-1.5 text-[0.70rem] text-[#78958F] font-mono mt-1">
              <Lock className="size-3 text-[#35BFC3]" />
              <span>Secure authentication powered by Google.</span>
            </div>

            {/* Missing Firebase configuration notice */}
            {localConfigNotice && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-lg border border-[#35BFC3]/30 bg-[#081827]/90 p-3 text-left"
              >
                <div className="flex items-center gap-1.5 font-mono text-[0.70rem] font-semibold text-[#35BFC3] mb-1">
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>Firebase Configuration Missing</span>
                </div>
                <p className="text-[0.68rem] text-[#D8E2E8]/80 leading-relaxed font-sans">
                  Ensure all six <code className="font-mono text-[#35BFC3]">VITE_FIREBASE_*</code> environment variables are present in <code className="font-mono text-[#35BFC3]">.env.local</code>.
                </p>
              </motion.div>
            )}
          </div>
        ) : (
          /* 4. Real Authenticated Operator State (Phase 5) */
          user && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-[#35BFC3]/30 bg-[#081827]/70 p-3.5">
                <div className="flex items-center gap-3">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="size-11 rounded-full border border-[#35BFC3]/50 object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex size-11 items-center justify-center rounded-full border border-[#35BFC3]/50 bg-[#15364A] text-sm font-bold text-[#35BFC3]">
                      {user.name ? user.name.slice(0, 2).toUpperCase() : "OP"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-[#F3EEE5]">{user.name}</span>
                      <ShieldCheck className="size-3.5 text-[#35BFC3] shrink-0" />
                    </div>
                    <p className="truncate text-xs font-mono text-[#D8E2E8]/80">{user.email}</p>
                    <div className="mt-1 flex items-center gap-1 text-[0.66rem] text-[#35BFC3] font-mono">
                      <CheckCircle2 className="size-3" />
                      <span>Google Verified Identity</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#15364A] flex items-center justify-between text-[0.70rem] text-[#78958F]">
                  <span>Status: <strong className="text-[#35BFC3]">AUTHENTICATED</strong></span>
                  <button
                    type="button"
                    onClick={handleSignOutClick}
                    className="inline-flex items-center gap-1 text-[#78958F] hover:text-red-300 transition-colors cursor-pointer"
                    title="Sign out of Google session"
                  >
                    <LogOut className="size-3" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>

              {/* Continue button appears ONLY after successful authentication */}
              <button
                type="button"
                onClick={onContinue}
                id="navik-auth-continue-cta"
                className="group flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#15364A] via-[#35BFC3] to-[#15364A] p-[1px] shadow-lg shadow-[#35BFC3]/20 transition-all hover:shadow-[#35BFC3]/40 cursor-pointer"
              >
                <div className="flex w-full items-center justify-center gap-2 rounded-[7px] bg-[#0D2233] px-4 py-3.5 text-sm font-semibold text-[#F3EEE5] transition-colors group-hover:bg-[#15364A]">
                  <span>Continue to NAVIK</span>
                  <ArrowRight className="size-4 text-[#35BFC3] transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            </div>
          )
        )}

        {/* 5. Terms of Service and Privacy Policy Links */}
        <div className="mt-6 border-t border-[#15364A]/70 pt-4 text-center">
          <p className="text-[0.68rem] text-[#78958F]">
            By continuing, you agree to our{" "}
            <button
              type="button"
              onClick={() => setActiveModal("terms")}
              className="text-[#35BFC3] underline underline-offset-2 hover:text-[#F3EEE5] transition-colors cursor-pointer"
            >
              Terms of Service
            </button>{" "}
            and{" "}
            <button
              type="button"
              onClick={() => setActiveModal("privacy")}
              className="text-[#35BFC3] underline underline-offset-2 hover:text-[#F3EEE5] transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            .
          </p>
        </div>
      </motion.div>

      {/* Internal Modal Dialogs for Terms & Privacy */}
      <Dialog open={activeModal !== null} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-md border-[#15364A] bg-[#0D2233] text-[#F3EEE5]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-[#F3EEE5]">
              {activeModal === "terms" ? "Terms of Service" : "Privacy Policy"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#78958F]">
              NAVIK Freight Compass · Maritime Charter Intelligence Platform
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto text-xs text-[#D8E2E8] space-y-3 pr-2">
            {activeModal === "terms" ? (
              <>
                <p>
                  1. <strong>Scope of Service:</strong> NAVIK provides decision intelligence and freight forecasting tools for Australia–East Coast India bulk shipping lanes.
                </p>
                <p>
                  2. <strong>Account Security:</strong> Access is restricted to authorized maritime operators. Google Identity credentials via Firebase Authentication are used solely for identity verification and workspace access.
                </p>
                <p>
                  3. <strong>Data Usage:</strong> Proprietary fixtures, cargo allocations and voyage plans remain confidential to your organization.
                </p>
              </>
            ) : (
              <>
                <p>
                  1. <strong>Information Collected:</strong> When you authenticate via Google, NAVIK receives your verified name, email address, and profile picture from Google Identity Services.
                </p>
                <p>
                  2. <strong>Usage:</strong> Your credentials are used exclusively to authenticate your session and authorize access to freight intelligence workflows.
                </p>
                <p>
                  3. <strong>Security:</strong> All tokens are transmitted over TLS-encrypted connections and validated in compliance with OAuth 2.0 standards.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GoogleAuthPanel;
