import React from 'react';
import { RotateCcw, TrendingUp, ShieldAlert, Navigation, Compass, ArrowRight } from 'lucide-react';

/**
 * NAVIK Rotating Globe Opening Overlay
 * 
 * Hierarchy:
 * 1. Dominant NAVIK Wordmark & Tagline
 * 2. High-contrast "GET STARTED" CTA (Opens Google Authentication)
 * 3. Left-Side Strategic Mission Introduction
 * 4. 4 Compact Information Panels communicating core platform pillars
 */
export const BrandRevealOverlay = ({
  onGetStarted,
  onRestart,
  onResetIntroSeen
}) => {
  const handleGetStartedClick = (e) => {
    e.preventDefault();
    if (onGetStarted) {
      onGetStarted();
    }
  };

  return (
    <div className="navik-brand-reveal-layer">
      {/* 1. Strategic Mission Introduction (Left-side Contextual Badge) */}
      <div className="navik-mission-statement visible" role="complementary" aria-label="Platform Mission">
        <div className="navik-section-tag">
          <span className="navik-tag-dot" />
          <span>GLOBAL FREIGHT INTELLIGENCE</span>
        </div>
        <p className="navik-mission-desc">
          NAVIK transforms freight forecasts, vessel availability, voyage risk and operational constraints into clearer chartering decisions.
        </p>
      </div>

      {/* 2. Central Brand Stack */}
      <div className="navik-brand-center-stack">
        {/* Large Cinematic NAVIK Wordmark */}
        <h1 className="navik-wordmark visible">
          NAVIK
        </h1>

        {/* Tagline directly beneath NAVIK */}
        <div className="navik-tagline-text visible">
          Predict. Optimize. Navigate.
        </div>

        {/* Minimal, High-Contrast "GET STARTED" CTA */}
        <div className="navik-cta-container visible">
          <button
            type="button"
            className="navik-cinematic-cta-btn"
            onClick={handleGetStartedClick}
            aria-label="Get Started with Google Authentication"
            id="navik-get-started-cta"
          >
            <span className="navik-cinematic-cta-text">GET STARTED</span>
            <ArrowRight size={15} className="navik-cinematic-cta-arrow" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 3. 4 Compact Information Panels (Core Capabilities) */}
      <div 
        className="navik-capabilities-row visible"
        role="region"
        aria-label="Core Capabilities"
      >
        {/* Card 01 */}
        <div className="navik-cap-card" tabIndex={0}>
          <div className="navik-card-header">
            <span className="navik-card-num">01</span>
            <TrendingUp size={15} className="navik-card-icon" aria-hidden="true" />
          </div>
          <div className="navik-card-title">FREIGHT FORECASTING</div>
          <div className="navik-card-desc">Forecast future freight-rate movements using historical and market signals.</div>
        </div>

        {/* Card 02 */}
        <div className="navik-cap-card" tabIndex={0}>
          <div className="navik-card-header">
            <span className="navik-card-num">02</span>
            <ShieldAlert size={15} className="navik-card-icon" aria-hidden="true" />
          </div>
          <div className="navik-card-title">DISRUPTION INTELLIGENCE</div>
          <div className="navik-card-desc">Identify weather, port, congestion and geopolitical risks affecting voyages.</div>
        </div>

        {/* Card 03 */}
        <div className="navik-cap-card" tabIndex={0}>
          <div className="navik-card-header">
            <span className="navik-card-num">03</span>
            <Navigation size={15} className="navik-card-icon" aria-hidden="true" />
          </div>
          <div className="navik-card-title">VESSEL & ROUTE OPTIMIZATION</div>
          <div className="navik-card-desc">Evaluate vessel, route and chartering options under operational constraints.</div>
        </div>

        {/* Card 04 */}
        <div className="navik-cap-card" tabIndex={0}>
          <div className="navik-card-header">
            <span className="navik-card-num">04</span>
            <Compass size={15} className="navik-card-icon" aria-hidden="true" />
          </div>
          <div className="navik-card-title">DECISION INTELLIGENCE</div>
          <div className="navik-card-desc">Combine forecast, risk, feasibility and cost into an actionable chartering decision.</div>
        </div>
      </div>

      {/* 4. Discrete Dev Controls (Bottom Corner) */}
      <div className="navik-dev-corner" aria-label="Controls">
        <button
          type="button"
          className="navik-dev-btn"
          onClick={onRestart}
          title="Re-center Earth"
          aria-label="Re-center view"
        >
          <RotateCcw size={12} aria-hidden="true" />
          <span>Reset</span>
        </button>

        <button
          type="button"
          className="navik-dev-btn"
          onClick={onResetIntroSeen}
          title="Clear authentication flag"
          aria-label="Clear session flag"
        >
          <span>Clear Auth</span>
        </button>
      </div>
    </div>
  );
};

export default BrandRevealOverlay;
