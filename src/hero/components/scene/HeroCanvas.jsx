import React, { Suspense, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { TransitionScene } from '../transition/TransitionScene';
import { HeroLoader } from '../ui/HeroLoader';

/**
 * Scene Shader Pre-Warmer
 * Compiles all materials into GPU cache on mount, preventing shader compilation
 * freezes during camera movement and zoom-out transitions.
 */
const ShaderPrewarmer = () => {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    try {
      gl.compile(scene, camera);
    } catch (e) {
      // Graceful fallback if driver prevents manual pre-compile
    }
  }, [gl, scene, camera]);

  return null;
};

/**
 * Fullscreen Cinematic Canvas for NAVIK Maritime Experience
 * Calibrated for optimal performance, high contrast, and responsive viewports.
 * Wrapped in React.memo to guarantee zero re-renders from parent state changes.
 */
export const HeroCanvas = React.memo(() => {
  const [isTabVisible, setIsTabVisible] = useState(true);

  // Pause rendering when browser tab is hidden to save GPU/CPU
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // SSR Guard: WebGL Canvas must only mount in browser DOM
  if (typeof window === 'undefined') {
    return <div className="navik-hero-canvas-container" />;
  }

  return (
    <div className="navik-hero-canvas-container">
      <Canvas
        dpr={[1, typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.35) : 1.25]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.22
        }}
        shadows={false}
        frameloop={isTabVisible ? 'always' : 'never'}
      >
        {/* Pure Pitch-Black Space Environment */}
        <color attach="background" args={['#010409']} />

        <PerspectiveCamera
          makeDefault
          fov={42}
          near={0.1}
          far={300}
          position={[0, 0, 18]}
        />

        <Suspense fallback={null}>
          <ShaderPrewarmer />
          <TransitionScene />
        </Suspense>
      </Canvas>

      {/* Subtle telemetry progress overlay */}
      <HeroLoader />
    </div>
  );
});

export default HeroCanvas;
