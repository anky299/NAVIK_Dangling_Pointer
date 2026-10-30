import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLOBE_RADIUS } from '../../utils/globeCoordinates';

/**
 * Centered Globe Camera Controller
 * 
 * Features:
 * - Immediately positions camera at optimal master orbital distance (zero zoom animation).
 * - Calibrated framing: Earth occupies ~60% viewport height with negative space, zero edge cropping.
 * - Responsive on desktop, tablet, and mobile portrait viewports.
 * - Subtle, organic resting orbital breathing drift (amplitude 0.015).
 * - Zero heap allocations per frame.
 */
export const GlobeCameraController = () => {
  const { camera, size } = useThree();
  const isInitializedRef = useRef(false);

  useFrame((state) => {
    const aspect = size.width / Math.max(1, size.height);
    const isMobile = aspect < 1.0;

    // Calculate responsive distance so Earth is framed at ~60% height on desktop, ~72% width on mobile
    const fovRad = (camera.fov * Math.PI) / 360;
    const tanFov = Math.tan(fovRad);

    const verticalDist = (GLOBE_RADIUS * 2) / (0.60 * 2 * tanFov);
    const horizontalDist = (GLOBE_RADIUS * 2) / (0.72 * aspect * 2 * tanFov);
    const masterDist = Math.max(verticalDist, isMobile ? horizontalDist : verticalDist);

    // Subtle, gentle floating orbital drift
    const time = state.clock.getElapsedTime();
    const driftX = Math.sin(time * 0.25) * 0.015;
    const driftY = Math.cos(time * 0.18) * 0.012;

    camera.position.set(
      driftX,
      (isMobile ? 0.35 : 0.10) + driftY,
      masterDist
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(0, isMobile ? 0.20 : 0.0, 0);

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
    }
  });

  return null;
};

export default GlobeCameraController;

