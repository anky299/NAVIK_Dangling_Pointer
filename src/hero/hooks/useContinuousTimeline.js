import { useState, useEffect, useCallback } from 'react';

const INTRO_STORAGE_KEY = 'navicIntroSeen';

/**
 * Authoritative mutable animation state.
 * Controlled directly by Three.js useFrame loop (sole authoritative clock)
 * without triggering React component tree re-renders.
 */
export const timelineState = {
  progress: 0,
  isFinished: false,
  isPlaying: true,
  isSceneReady: false,
  reducedMotion: false,
  listeners: new Set(),
  startTimeline: null,
  skipTimeline: null
};

export function subscribeTimeline(callback) {
  timelineState.listeners.add(callback);
  return () => timelineState.listeners.delete(callback);
}

/**
 * Master Continuous Timeline Controller
 * 
 * Performance Architecture:
 * - Single Clock: Driven entirely inside R3F render loop, removing redundant GSAP RAF tickers.
 * - Zero React Re-Renders: Eliminates component tree re-renders during the zoom-out animation.
 */
export const useContinuousTimeline = ({
  autoPlay = true,
  checkSeenFlag = false
} = {}) => {
  const [isFinished, setIsFinished] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    const isReduced = Boolean(mediaQuery && mediaQuery.matches);

    timelineState.reducedMotion = isReduced;
    setReducedMotion(isReduced);

    if (isReduced) {
      timelineState.progress = 1.0;
      timelineState.isFinished = true;
      setIsFinished(true);
      return;
    }

    if (checkSeenFlag) {
      try {
        const seen = localStorage.getItem(INTRO_STORAGE_KEY);
        if (seen === 'true') {
          timelineState.progress = 1.0;
          timelineState.isFinished = true;
          setIsFinished(true);
          return;
        }
      } catch (e) {}
    }

    timelineState.progress = 0;
    timelineState.isFinished = false;
    timelineState.isPlaying = autoPlay;

    const unsubscribe = subscribeTimeline((val) => {
      if (val >= 1.0) {
        setIsFinished(true);
        try {
          localStorage.setItem(INTRO_STORAGE_KEY, 'true');
        } catch (e) {}
      }
    });

    const handleChange = (e) => {
      const prefersReduced = Boolean(e.matches);
      timelineState.reducedMotion = prefersReduced;
      setReducedMotion(prefersReduced);
      if (prefersReduced) {
        timelineState.progress = 1.0;
        timelineState.isFinished = true;
        setIsFinished(true);
      }
    };

    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleChange);
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleChange);
      }
    }

    return () => {
      unsubscribe();
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === 'function') {
          mediaQuery.removeEventListener('change', handleChange);
        } else if (typeof mediaQuery.removeListener === 'function') {
          mediaQuery.removeListener(handleChange);
        }
      }
    };
  }, [autoPlay, checkSeenFlag]);

  const restart = useCallback(() => {
    timelineState.progress = 0;
    timelineState.isFinished = false;
    timelineState.isPlaying = true;
    setIsFinished(false);
    if (typeof timelineState.startTimeline === 'function') {
      timelineState.startTimeline();
    }
  }, []);

  const skipToEnd = useCallback(() => {
    timelineState.progress = 1.0;
    timelineState.isFinished = true;
    timelineState.isPlaying = false;
    setIsFinished(true);
    if (typeof timelineState.skipTimeline === 'function') {
      timelineState.skipTimeline();
    }
    try {
      localStorage.setItem(INTRO_STORAGE_KEY, 'true');
    } catch (e) {}
  }, []);

  const resetIntroSeen = useCallback(() => {
    try {
      localStorage.removeItem(INTRO_STORAGE_KEY);
    } catch (e) {}
    restart();
  }, [restart]);

  return {
    progress: timelineState.progress,
    isFinished,
    reducedMotion,
    restart,
    skipToEnd,
    resetIntroSeen
  };
};

export default useContinuousTimeline;
