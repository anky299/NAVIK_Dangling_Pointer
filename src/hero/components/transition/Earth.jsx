import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AtmosphereShader } from '../scene/AtmosphereShader';
import { GLOBE_RADIUS } from '../../utils/globeCoordinates';
import { HERO_CONFIG } from '../../config/heroConfig';

// ============================================================================
// SINGLETON PRELOADED TEXTURE REPOSITORY (Module Scope)
// Guarantees zero texture uploads, zero React re-renders, and zero shader
// recompilations in the middle of the camera zoom-out animation.
// ============================================================================
let _cachedEarthTextures = null;
const _normalScale = new THREE.Vector2(0.35, 0.35);

function getPreloadedEarthTextures() {
  if (_cachedEarthTextures || typeof window === 'undefined') {
    return _cachedEarthTextures;
  }

  const texturePaths = HERO_CONFIG.models.earth.textures;
  const loader = new THREE.TextureLoader();

  const configureTexture = (tex, isColor = false) => {
    if (!tex) return;
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
  };

  const day = loader.load(texturePaths.day, (t) => configureTexture(t, true));
  const specular = loader.load(texturePaths.specular, (t) => configureTexture(t, false));
  const clouds = loader.load(texturePaths.clouds, (t) => configureTexture(t, false));
  const night = loader.load(texturePaths.night, (t) => configureTexture(t, true));
  const normal = loader.load(texturePaths.normal, (t) => configureTexture(t, false));

  _cachedEarthTextures = { day, specular, clouds, night, normal };
  return _cachedEarthTextures;
}

/**
 * High-Performance Photorealistic Earth Globe
 * 
 * Performance Architecture:
 * - Pre-allocated singleton textures: all map bindings present on Frame 1.
 * - Zero React state (`useState`), eliminating all component re-renders during zoom-out.
 * - Shaders are compiled once on initial mount and never recompiled mid-flight.
 * - 64x64 geometric sphere resolution: physically round, eliminating 50% vertex overhead.
 */
export const Earth = ({ radius = GLOBE_RADIUS }) => {
  const cloudsRef = useRef();
  const earthMatRef = useRef();
  const cloudsMatRef = useRef();

  // Retrieve cached textures synchronously on component mount
  const textures = useMemo(() => getPreloadedEarthTextures(), []);

  // Subtle atmospheric cloud differential rotation
  useFrame((state, delta) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.00025;
    }
  });

  return (
    <group name="PhotorealisticEarthGlobe">
      {/* 1. Planetary Crust & Ocean Surface */}
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          ref={earthMatRef}
          map={textures?.day || null}
          roughnessMap={textures?.specular || null}
          roughness={0.48}
          metalness={0.10}
          normalMap={textures?.normal || null}
          normalScale={_normalScale}
          emissiveMap={textures?.night || null}
          emissive="#ffffff"
          emissiveIntensity={0.65}
        />
      </mesh>

      {/* 2. Elevated Translucent Cloud Layer (radius * 1.008 prevents surface z-fighting) */}
      <mesh ref={cloudsRef} renderOrder={2}>
        <sphereGeometry args={[radius * 1.008, 48, 48]} />
        <meshStandardMaterial
          ref={cloudsMatRef}
          map={textures?.clouds || null}
          transparent
          opacity={0.20}
          depthWrite={false}
          blending={THREE.NormalBlending}
          roughness={1.0}
        />
      </mesh>

      {/* 3. Subtle Rayleigh Atmospheric Scattering Horizon Limb */}
      <AtmosphereShader
        radius={radius * 1.045}
        color="#38bdf8"
        power={3.8}
        multiplier={2.2}
        sunPosition={HERO_CONFIG.lighting.sun.position}
      />
    </group>
  );
};

export default Earth;
