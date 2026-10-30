import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, ArrowRight, X, Lock } from 'lucide-react';

/**
 * Google "G" Multi-Color SVG Emblem
 */
const GoogleLogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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

const AUTH_STORAGE_KEY = 'navik_google_auth';

export const GoogleAuthModal = ({ isOpen, onClose, onContinue }) => {
  const [authState, setAuthState] = useState('initial'); // 'initial' | 'authenticating' | 'authenticated'
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      name: 'Ankit Goswami',
      email: 'ankitgoswami2444@gmail.com',
      avatarUrl: '',
      role: 'Charter Operations Desk · Lead Maritime Operator',
      org: 'NAVIK Global Freight Intelligence',
      verified: true
    };
  });

  useEffect(() => {
    // Check if session is already active
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        setAuthState('authenticated');
      }
    } catch (e) {}
  }, []);

  if (!isOpen) return null;

  const handleSignIn = () => {
    setAuthState('authenticating');
    setTimeout(() => {
      const profile = {
        name: 'Ankit Goswami',
        email: 'ankitgoswami2444@gmail.com',
        avatarUrl: '',
        role: 'Charter Operations Desk · Lead Maritime Operator',
        org: 'NAVIK Global Freight Intelligence',
        verified: true,
        authenticatedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
        sessionStorage.setItem('navik_authenticated', 'true');
      } catch (e) {}
      setUserProfile(profile);
      setAuthState('authenticated');
    }, 950);
  };

  const handleContinue = () => {
    try {
      sessionStorage.setItem('navik_authenticated', 'true');
    } catch (e) {}
    if (onContinue) {
      onContinue();
    }
  };

  return (
    <div className="navik-auth-backdrop" role="dialog" aria-modal="true" aria-label="Google Authentication">
      <div className="navik-auth-card">
        {/* Close Button */}
        <button
          type="button"
          className="navik-auth-close-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="navik-auth-header">
          <div className="navik-auth-logo-badge">
            <GoogleLogo />
          </div>
          <h2 className="navik-auth-title">
            {authState === 'authenticated' ? 'Account Verified' : 'Sign in with Google'}
          </h2>
          <p className="navik-auth-subtitle">
            {authState === 'authenticated' 
              ? 'Authorized session active for NAVIK Maritime Intelligence'
              : 'Choose an account to continue to NAVIK Freight Compass'}
          </p>
        </div>

        {/* Content Body */}
        {authState === 'initial' && (
          <div className="navik-auth-body">
            <button
              type="button"
              className="navik-auth-account-row"
              onClick={handleSignIn}
              aria-label={`Sign in as ${userProfile.name}`}
            >
              <div className="navik-auth-avatar">
                <span>AG</span>
              </div>
              <div className="navik-auth-account-info">
                <div className="navik-auth-account-name">Ankit Goswami</div>
                <div className="navik-auth-account-email">ankitgoswami2444@gmail.com</div>
              </div>
              <ShieldCheck size={18} className="navik-auth-verified-icon" />
            </button>

            <div className="navik-auth-terms">
              <Lock size={12} className="inline mr-1 text-[#38bdf8]" />
              <span>
                To continue, Google will share your verified name, email address, and security token with NAVIK.
              </span>
            </div>

            <button
              type="button"
              className="navik-auth-primary-btn"
              onClick={handleSignIn}
            >
              <span>Continue with Google</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {authState === 'authenticating' && (
          <div className="navik-auth-body navik-auth-loading-state">
            <div className="navik-auth-spinner" />
            <p className="navik-auth-loading-text">Connecting to Google Identity Services...</p>
            <p className="navik-auth-loading-sub">Verifying operator security credentials</p>
          </div>
        )}

        {authState === 'authenticated' && (
          <div className="navik-auth-body">
            <div className="navik-auth-profile-box">
              <div className="navik-auth-profile-header">
                <div className="navik-auth-avatar navik-auth-avatar-lg">
                  <span>AG</span>
                </div>
                <div>
                  <div className="navik-auth-profile-name">{userProfile.name}</div>
                  <div className="navik-auth-profile-email">{userProfile.email}</div>
                </div>
              </div>

              <div className="navik-auth-profile-details">
                <div className="navik-auth-detail-badge">
                  <CheckCircle2 size={13} className="text-[#10b981]" />
                  <span>Verified Google OAuth 2.0</span>
                </div>
                <div className="navik-auth-role-tag">
                  {userProfile.role}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="navik-auth-continue-btn"
              onClick={handleContinue}
              id="navik-auth-continue-cta"
            >
              <span>Continue to NAVIK</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="navik-auth-footer">
          <span>Protected by Google Identity · End-to-End Maritime TLS Encrypted</span>
        </div>
      </div>
    </div>
  );
};

export default GoogleAuthModal;

