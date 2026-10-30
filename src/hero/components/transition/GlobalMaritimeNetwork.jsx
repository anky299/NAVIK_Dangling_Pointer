import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { 
  GLOBAL_MARITIME_NETWORK, 
  createSphericalArc, 
  GLOBE_RADIUS 
} from '../../utils/globeCoordinates';

/**
 * Global Maritime Shipping Network Component
 * 
 * Features:
 * - Rotates in physical lockstep with the Earth
 * - Natural depth occlusion: back-side routes disappear behind the opaque Earth sphere
 * - Progressive staggered reveal sequence (0.58 -> 0.82) coordinated with planetary elevation
 * - Subtle alive luminance breathing in the final global view
 */
export const GlobalMaritimeNetwork = () => {
  const lineRefs = useRef([]);

  // Pre-generate spherical arc geometries for all corridors
  const corridorGeometries = useMemo(() => {
    return GLOBAL_MARITIME_NETWORK.map((corridor) => {
      const points = createSphericalArc(corridor.points, GLOBE_RADIUS, 0.015, 24);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      return {
        id: corridor.id,
        tier: corridor.tier,
        geometry,
        totalPoints: points.length
      };
    });
  }, []);

  // Continuous subtle alive breathing luminance
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const pulseFactor = 0.52 + Math.sin(time * 1.5) * 0.08;

    corridorGeometries.forEach((item, idx) => {
      const line = lineRefs.current[idx];
      if (!line) return;
      line.visible = true;
      line.geometry.setDrawRange(0, item.totalPoints);
      line.material.opacity = pulseFactor;
    });
  });

  return (
    <group name="GlobalMaritimeNetwork">
      {corridorGeometries.map((item, idx) => (
        <line 
          key={item.id} 
          ref={(el) => (lineRefs.current[idx] = el)} 
          geometry={item.geometry}
          visible={false}
        >
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
      ))}
    </group>
  );
};
