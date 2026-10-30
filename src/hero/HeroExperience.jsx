import React, { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HeroCanvas } from './components/scene/HeroCanvas';
import { BrandRevealOverlay } from './components/ui/BrandRevealOverlay';
import { GoogleAuthPanel } from '../components/navik/auth/GoogleAuthPanel';
import { useAuth } from '../lib/auth/AuthContext';
import { useContinuousTimeline } from './hooks/useContinuousTimeline';
import './styles/hero.css';

/**
 * NAVIK Rotating Globe Hero & Google Authentication Experience
 * 
 * Strict Application Architecture:
 * 1. Rotating Globe Screen (Earth visible immediately, slow continuous rotation).
 * 2. When the user clicks "GET STARTED":
 *    - The user remains on the SAME page (NO route changes, NO page reload).
 *    - The rotating globe remains visible in the background and CONTINUES rotating.
 *    - GoogleAuthPanel smoothly fades in over the globe.
 * 3. When the user closes the authentication panel:
 *    - Panel fades out, BrandRevealOverlay returns.
 *    - Globe rotation is completely uninterrupted.
 * 4. When real authentication succeeds in the future:
 *    - Continue button appears and calls onEnterNavik (handoff to landing page).
 */
export const HeroExperience = ({
  autoPlay = true,
  onEnterNavik,
  checkSeenFlag = false
}) => {
  const [overlayState, setOverlayState] = useState('intro'); // 'intro' | 'auth'
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    error, 
    signInWithGoogle, 
    signOut 
  } = useAuth();

  const {
    progress,
    restart,
    skipToEnd,
    resetIntroSeen
  } = useContinuousTimeline({
    autoPlay,
    loop: false,
    checkSeenFlag
  });

  const handleOpenAuth = useCallback(() => {
    setOverlayState('auth');
  }, []);

  const handleCloseAuth = useCallback(() => {
    setOverlayState('intro');
  }, []);

  const handleResetAuthAndSeen = useCallback(() => {
    resetIntroSeen();
    if (signOut) signOut();
  }, [resetIntroSeen, signOut]);

  return (
    <div className="navik-hero-wrapper">
      {/* 1. Continuous 3D WebGL Canvas Layer (Pure rotating Earth globe) */}
      <HeroCanvas />

      {/* 2. Cinematic Vignette Gradient */}
      <div className="navik-hero-vignette" />

      {/* 3. Initial Brand Reveal Overlay (Wordmark, Tagline, Capabilities, Get Started CTA) */}
      <AnimatePresence>
        {overlayState === 'intro' && (
          <motion.div
            key="hero-brand-overlay"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-10 pointer-events-none"
          >
            <BrandRevealOverlay
              progress={progress}
              onGetStarted={handleOpenAuth}
              onSkip={skipToEnd}
              onRestart={restart}
              onResetIntroSeen={handleResetAuthAndSeen}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Minimal Google-Only Authentication Panel (Over the rotating Earth globe) */}
      <AnimatePresence>
        {overlayState === 'auth' && (
          <GoogleAuthPanel
            isOpen={true}
            onClose={handleCloseAuth}
            onContinue={onEnterNavik}
            onGoogleSignIn={signInWithGoogle}
            onSignOut={signOut}
            user={user}
            isAuthenticated={isAuthenticated}
            isLoading={isLoading}
            error={error}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default HeroExperience;
