/**
 * NAVIK Google-Only Authentication Screen Adapter
 * Wraps GoogleAuthPanel with AuthContext boundary.
 */
import React from "react";
import { GoogleAuthPanel, GoogleLogo } from "./GoogleAuthPanel";
import { useAuth } from "@/lib/auth/AuthContext";

export { GoogleLogo };

export interface GoogleAuthScreenProps {
  onContinue: () => void;
  onBackToGlobe: () => void;
}

export function GoogleAuthScreen({ onContinue, onBackToGlobe }: GoogleAuthScreenProps) {
  const { user, isAuthenticated, isLoading, error, signInWithGoogle, signOut } = useAuth();

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#081827]">
      <GoogleAuthPanel
        onClose={onBackToGlobe}
        onContinue={onContinue}
        onGoogleSignIn={signInWithGoogle}
        onSignOut={signOut}
        user={user}
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}

export default GoogleAuthScreen;
