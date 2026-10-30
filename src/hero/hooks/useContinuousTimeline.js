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
  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [isFinished, setIsFinished] = useState(prefersReducedMotion);

  useEffect(() => {
    timelineState.reducedMotion = prefersReducedMotion;
    if (prefersReducedMotion) {
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

    return unsubscribe;
  }, [autoPlay, checkSeenFlag, prefersReducedMotion]);

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
    restart,
    skipToEnd,
    resetIntroSeen
  };
};

export default useContinuousTimeline;
