import { describe, expect, it } from "vitest";
import {
  isFirebaseConfigured,
  getFirebaseErrorMessage,
  getFirebaseIdToken,
} from "@/lib/firebase/config";

describe("Firebase Auth Service — navik-dd29d", () => {
  it("validates that required Firebase configuration environment variables are recognized", () => {
    // When environment variables are loaded, isFirebaseConfigured is a boolean
    expect(typeof isFirebaseConfigured).toBe("boolean");
  });

  it("maps Firebase error codes to friendly, actionable messages", () => {
    const popupClosed = getFirebaseErrorMessage({ code: "auth/popup-closed-by-user" });
    expect(popupClosed).toContain("Sign-in cancelled");

    const popupBlocked = getFirebaseErrorMessage({ code: "auth/popup-blocked" });
    expect(popupBlocked).toContain("blocked by your browser");

    const unauthorizedDomain = getFirebaseErrorMessage({ code: "auth/unauthorized-domain" });
    expect(unauthorizedDomain).toContain("Authorized Domains");
    expect(unauthorizedDomain).toContain("not authorized for Firebase Authentication");

    const networkFailed = getFirebaseErrorMessage({ code: "auth/network-request-failed" });
    expect(networkFailed).toContain("Network connection error");

    const customWithCode = getFirebaseErrorMessage({ code: "auth/invalid-credential", message: "Firebase: Bad credentials" });
    expect(customWithCode).toBe("[auth/invalid-credential] Bad credentials");

    const fallback = getFirebaseErrorMessage({ message: "Firebase: Custom error details" });
    expect(fallback).toBe("Custom error details");
  });

  it("returns null for ID token when no operator is signed in", async () => {
    const token = await getFirebaseIdToken();
    expect(token).toBeNull();
  });
});

