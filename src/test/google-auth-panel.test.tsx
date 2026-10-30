import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { GoogleAuthPanel } from "@/components/navik/auth/GoogleAuthPanel";

describe("GoogleAuthPanel — Real Firebase Google Authentication UI", () => {
  it("renders minimal Google-only authentication UI with exact branding and copy", () => {
    const handleClose = vi.fn();
    const handleContinue = vi.fn();

    render(
      <GoogleAuthPanel
        isOpen={true}
        onClose={handleClose}
        onContinue={handleContinue}
        isAuthenticated={false}
        user={null}
      />,
    );

    // 1. Brand & Header
    expect(screen.getByText("NAVIK")).toBeInTheDocument();
    expect(screen.getByText("Welcome to NAVIK")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sign in or create an account to access your maritime intelligence workspace.",
      ),
    ).toBeInTheDocument();

    // 2. Primary Google Button
    const googleBtn = screen.getByRole("button", { name: /Continue with Google/i });
    expect(googleBtn).toBeInTheDocument();

    // 3. Privacy note
    expect(screen.getByText("Secure authentication powered by Google.")).toBeInTheDocument();

    // 4. Terms and Privacy dialog links
    expect(screen.getByRole("button", { name: "Terms of Service" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Privacy Policy" })).toBeInTheDocument();

    // 5. Strictly NO email/password, OTP, phone or other social buttons
    expect(screen.queryByPlaceholderText(/email/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/password/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/phone/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/otp/i)).toBeNull();
    expect(screen.queryByText(/github/i)).toBeNull();
    expect(screen.queryByText(/microsoft/i)).toBeNull();

    // 6. Strictly NO demo users or fake Continue button when unauthenticated
    expect(screen.queryByText(/Ankit Sharma/i)).toBeNull();
    expect(screen.queryByText(/Captain Vance/i)).toBeNull();
    expect(screen.queryByText(/Continue to NAVIK/i)).toBeNull();
  });

  it("triggers onGoogleSignIn when Continue with Google is clicked", async () => {
    const handleSignIn = vi.fn();

    render(
      <GoogleAuthPanel
        isOpen={true}
        onClose={vi.fn()}
        onGoogleSignIn={handleSignIn}
        isAuthenticated={false}
        user={null}
      />,
    );

    const googleBtn = screen.getByRole("button", { name: /Continue with Google/i });
    fireEvent.click(googleBtn);

    expect(handleSignIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Continue to NAVIK/i)).toBeNull();
  });

  it("displays error message cleanly when authentication error occurs", () => {
    render(
      <GoogleAuthPanel
        isOpen={true}
        onClose={vi.fn()}
        isAuthenticated={false}
        user={null}
        error="Sign-in cancelled: The Google authentication window was closed before completion."
      />,
    );

    expect(
      screen.getByText(/Sign-in cancelled: The Google authentication window was closed/i),
    ).toBeInTheDocument();
  });

  it("triggers onClose when close button is clicked", () => {
    const handleClose = vi.fn();

    render(
      <GoogleAuthPanel
        isOpen={true}
        onClose={handleClose}
        isAuthenticated={false}
        user={null}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: /Close and return to rotating globe/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("displays real authenticated profile and Continue button ONLY when authenticated", () => {
    const handleContinue = vi.fn();
    const handleSignOut = vi.fn();

    const realUser = {
      id: "usr_firebase_10928",
      email: "operator@freight-desk.com",
      name: "Marcus Vance",
      avatar_url: "https://lh3.googleusercontent.com/a/sample-photo",
      role: "USER" as const,
      account_status: "ACTIVE" as const,
      firebase_uid: "usr_firebase_10928",
    };

    render(
      <GoogleAuthPanel
        isOpen={true}
        onClose={vi.fn()}
        onContinue={handleContinue}
        onSignOut={handleSignOut}
        isAuthenticated={true}
        user={realUser}
      />,
    );

    // Shows real Google identity details
    expect(screen.getByText("Marcus Vance")).toBeInTheDocument();
    expect(screen.getByText("operator@freight-desk.com")).toBeInTheDocument();
    expect(screen.getByText("Google Verified Identity")).toBeInTheDocument();

    // Continue button is rendered and clickable
    const continueBtn = screen.getByRole("button", { name: /Continue to NAVIK/i });
    expect(continueBtn).toBeInTheDocument();
    fireEvent.click(continueBtn);
    expect(handleContinue).toHaveBeenCalledTimes(1);

    // Sign out button works
    const signOutBtn = screen.getByRole("button", { name: /Sign out/i });
    fireEvent.click(signOutBtn);
    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });
});
