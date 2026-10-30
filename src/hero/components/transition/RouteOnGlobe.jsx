import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { getMaritimeGlobeCurve, GLOBE_RADIUS } from '../../utils/globeCoordinates';
import { timelineState } from '../../hooks/useContinuousTimeline';

/**
 * Route Line plotted directly on the planetary sphere
 * 
 * Features:
 * - Rotates in physical lockstep with Earth and connects into global network
 * - Real-world depth occlusion: hidden when on the back side of Earth
 * - High-efficiency zero-allocation rendering via setDrawRange()
 * - Restrained nautical cyan-slate styling (no neon laser lines)
 */
export const RouteOnGlobe = () => {
  const lineRef = useRef();
  const curve = useMemo(() => getMaritimeGlobeCurve(GLOBE_RADIUS, 0.014), []);

  // Pre-generate full route points ONCE to prevent buffer reallocation in useFrame
  const { geometry, totalPoints } = useMemo(() => {
    const NUM_SEGMENTS = 100;
    const points = [];
    for (let i = 0; i <= NUM_SEGMENTS; i++) {
      points.push(curve.getPoint(i / NUM_SEGMENTS));
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    return { geometry: geom, totalPoints: points.length };
  }, [curve]);

  useFrame(() => {
    if (!lineRef.current) return;

    // Read timeline progress directly from shared state (zero React re-render)
    const progress = timelineState.progress;

    // Route begins revealing after ship ingress is established (progress >= 0.24)
    if (progress < 0.24) {
      lineRef.current.visible = false;
      return;
    }

    lineRef.current.visible = true;

    // Calculate vessel progress mapping (0.0 to 1.0)
    const vesselT = Math.min(1.0, Math.max(0.0, (progress - 0.04) / 0.90));
    const visibleCount = Math.max(2, Math.floor(vesselT * totalPoints));

    // Zero-allocation draw range update
    lineRef.current.geometry.setDrawRange(0, visibleCount);

    // Smooth, restrained opacity fade-in
    const routeFade = Math.min(0.55, (progress - 0.24) * 2.2);
    lineRef.current.material.opacity = routeFade;
  });

  return (
    <group name="GlobalRouteLine">
      <line ref={lineRef} geometry={geometry} visible={false}>
        <lineBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.0}
          linewidth={1.2}
          depthTest={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </line>
    </group>
  );
};
