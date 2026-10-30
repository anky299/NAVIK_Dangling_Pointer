import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { TwinklingStars } from '../scene/TwinklingStars';
import { Earth } from './Earth';
import { GlobalMaritimeNetwork } from './GlobalMaritimeNetwork';
import { GlobeCameraController } from './GlobeCameraController';

/**
 * NAVIK Rotating Planetary Globe Scene
 * 
 * Features:
 * - High-visibility 4-point maritime celestial lighting
 * - Authentic 23.44° axial tilt with slow continuous polar rotation
 * - Photorealistic NASA Blue Marble Earth with Rayleigh atmospheric halo
 * - Curated global maritime shipping routes with gentle breathing luminance
 * - Pitch-black space depth with GPU twinkling starfield
 * - Zero cargo or ocean assets in memory; instant frame-1 rendering
 */
export const TransitionScene = () => {
  const planetGroupRef = useRef();

  // Slow, majestic continuous planetary rotation on its polar axis
  useFrame((state, delta) => {
    if (planetGroupRef.current) {
      planetGroupRef.current.rotation.y += delta * 0.024;
    }
  });

  return (
    <group name="NavikGlobeScene">
      {/* 1. Deep Ocean Maritime Ambient Fill */}
      <ambientLight intensity={0.95} color="#162e4a" />

      {/* 2. Soft Atmospheric Hemisphere Fill */}
      <hemisphereLight skyColor="#7dd3fc" groundColor="#081827" intensity={0.55} />

      {/* 3. Key Sunlight (Vivid natural sunlight illuminating continents, clouds & ocean glint) */}
      <directionalLight
        position={[-10, 8, 16]}
        intensity={3.0}
        color="#ffffff"
      />

      {/* 4. Cool Cyan Rim Light (Carves crisp luminous edge separation for the Earth limb) */}
      <directionalLight
        position={[14, -6, -10]}
        intensity={2.2}
        color="#38bdf8"
      />

      {/* 5. Subtle Backfill for Atmospheric Horizon */}
      <directionalLight
        position={[0, 14, -6]}
        intensity={0.65}
        color="#bae6fd"
      />

      {/* 6. Realistic Twinkling Star Field in Pitch-Black Space */}
      <TwinklingStars count={1800} innerRadius={55} outerRadius={150} />

      {/* 7. Planetary System with 23.44° Axial Tilt */}
      <group 
        name="PlanetaryAxialTilt" 
        rotation={[0.06, 0, 0.409]} /* 23.44° true axial tilt */
      >
        <group ref={planetGroupRef} name="SpinningEarthSystem">
          {/* Photorealistic NASA Blue Marble Earth Globe */}
          <Earth />

          {/* Curated Global Maritime Shipping Corridors */}
          <GlobalMaritimeNetwork />
        </group>
      </group>

      {/* 8. Master Orbital Camera Controller (Framed & Centered from Frame 1) */}
      <GlobeCameraController />
    </group>
  );
};

export default TransitionScene;
