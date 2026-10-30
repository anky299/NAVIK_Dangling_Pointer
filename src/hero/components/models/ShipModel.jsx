import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Commercial Bulk Carrier Vessel (Optimized for Overhead Aerial & Orbital Views)
 * 
 * Authentically modeled dry bulk carrier (Capesize / Panamax profile):
 * - Submerged oxide-red boot-topping keel & dark naval steel topsides
 * - 5 bulk cargo holds with raised coamings & steel hatch covers along centerline
 * - 4 deck cargo handling cranes between hatches
 * - Forward radar mast & aft accommodation bridge tower with panoramic cyan windows
 * - Marine diesel exhaust funnel and IALA navigation lights
 * - High-contrast trailing Kelvin wake: central propeller wash + diverging V-wake arms
 * - Zero per-frame geometry recreation, zero GC allocations
 */
export const ProceduralBulkCarrier = ({ scale = 1.0 }) => {
  const wakeRef = useRef();

  useFrame((state) => {
    if (wakeRef.current) {
      const t = state.clock.getElapsedTime();
      // Gentle, subtle wash pulsation without geometry churn
      const pulse = 0.96 + Math.sin(t * 2.8) * 0.04;
      wakeRef.current.scale.set(1.0, 1.0, pulse);
    }
  });

  return (
    <group scale={scale} name="ProceduralBulkCarrier">
      {/* 1. Main Steel Hull Topsides (Dark Naval Maritime Enamel) */}
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[0.38, 0.14, 1.85]} />
        <meshStandardMaterial color="#0c192c" roughness={0.38} metalness={0.50} />
      </mesh>

      {/* 2. Submerged Oxide-Red Antifouling Boot-Topping Keel */}
      <mesh position={[0, -0.040, 0]}>
        <boxGeometry args={[0.36, 0.055, 1.82]} />
        <meshStandardMaterial color="#881b24" roughness={0.65} metalness={0.15} />
      </mesh>

      {/* 3. Tapered Bow Section with Bulbous Footprint */}
      <group position={[0, 0.045, 1.02]}>
        <mesh rotation={[0, Math.PI, 0]}>
          <cylinderGeometry args={[0.02, 0.19, 0.24, 3]} />
          <meshStandardMaterial color="#0c192c" roughness={0.38} metalness={0.50} />
        </mesh>
        {/* Forward Radar Mast */}
        <mesh position={[0, 0.16, -0.04]}>
          <cylinderGeometry args={[0.005, 0.008, 0.18, 8]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Masthead Forward Navigation Light */}
        <mesh position={[0, 0.25, -0.04]}>
          <sphereGeometry args={[0.010, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* 4. 5 Heavy Dry Bulk Cargo Holds with Steel Hatches */}
      {[-0.52, -0.26, 0.00, 0.26, 0.52].map((zPos, idx) => (
        <group key={`hold-${idx}`} position={[0, 0.125, zPos]}>
          {/* Raised hatch coaming */}
          <mesh>
            <boxGeometry args={[0.27, 0.035, 0.17]} />
            <meshStandardMaterial color="#1a2738" roughness={0.65} metalness={0.4} />
          </mesh>
          {/* Hatch cover top */}
          <mesh position={[0, 0.022, 0]}>
            <boxGeometry args={[0.25, 0.012, 0.15]} />
            <meshStandardMaterial color="#243447" roughness={0.55} metalness={0.5} />
          </mesh>
        </group>
      ))}

      {/* 5. 4 Deck Cargo Cranes (Between Cargo Holds) */}
      {[-0.39, -0.13, 0.13, 0.39].map((zPos, idx) => (
        <group key={`crane-${idx}`} position={[0.075, 0.14, zPos]}>
          {/* Crane pedestal */}
          <mesh>
            <cylinderGeometry args={[0.014, 0.016, 0.06, 8]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.35} />
          </mesh>
          {/* Crane boom / jib angled forward */}
          <mesh position={[0, 0.04, 0.04]} rotation={[0.45, 0, 0]}>
            <boxGeometry args={[0.008, 0.008, 0.11]} />
            <meshStandardMaterial color="#f1f5f9" roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* 6. Aft Accommodation Superstructure & Nav Bridge */}
      <group position={[0, 0.21, -0.68]}>
        {/* Multi-tier bridge block */}
        <mesh>
          <boxGeometry args={[0.30, 0.18, 0.24]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.28} metalness={0.25} />
        </mesh>
        {/* Navigation Bridge Panoramic Windows (Cyan Glint) */}
        <mesh position={[0, 0.05, 0.123]}>
          <boxGeometry args={[0.26, 0.035, 0.015]} />
          <meshStandardMaterial
            color="#0ea5e9"
            emissive="#0284c7"
            emissiveIntensity={0.8}
            roughness={0.15}
          />
        </mesh>
        {/* Bridge Wings Deck */}
        <mesh position={[0, 0.095, 0]}>
          <boxGeometry args={[0.35, 0.015, 0.26]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
        </mesh>
        {/* Marine Diesel Exhaust Funnel */}
        <mesh position={[0, 0.14, -0.07]}>
          <cylinderGeometry args={[0.028, 0.032, 0.12, 10]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.45} metalness={0.3} />
        </mesh>
        {/* Funnel Cap */}
        <mesh position={[0, 0.20, -0.07]}>
          <cylinderGeometry args={[0.029, 0.029, 0.015, 10]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
      </group>

      {/* 7. IALA Navigation Lights */}
      {/* Port Light (Red) */}
      <mesh position={[-0.17, 0.26, -0.58]}>
        <sphereGeometry args={[0.010, 8, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      {/* Starboard Light (Green) */}
      <mesh position={[0.17, 0.26, -0.58]}>
        <sphereGeometry args={[0.010, 8, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      {/* Stern Light (White) */}
      <mesh position={[0, 0.12, -0.92]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* 8. Trailing Kelvin Wake & Propeller Wash (Prominent from Overhead View) */}
      <group ref={wakeRef} position={[0, -0.002, -0.95]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* Immediate turbulent propeller wash */}
        <mesh position={[0, 0.35, 0]}>
          <planeGeometry args={[0.32, 0.70]} />
          <meshBasicMaterial
            color="#e0f2fe"
            transparent
            opacity={0.48}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Extended central bubbling foam trail */}
        <mesh position={[0, 1.10, 0]}>
          <planeGeometry args={[0.26, 1.50]} />
          <meshBasicMaterial
            color="#bae6fd"
            transparent
            opacity={0.32}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Port divergent Kelvin wake feather (angled at ~19.5°) */}
        <mesh position={[-0.24, 0.95, 0]} rotation={[0, 0, 0.28]}>
          <planeGeometry args={[0.16, 2.1]} />
          <meshBasicMaterial
            color="#94a3b8"
            transparent
            opacity={0.28}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Starboard divergent Kelvin wake feather (angled at ~19.5°) */}
        <mesh position={[0.24, 0.95, 0]} rotation={[0, 0, -0.28]}>
          <planeGeometry args={[0.16, 2.1]} />
          <meshBasicMaterial
            color="#94a3b8"
            transparent
            opacity={0.28}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* 9. Bow Wave Foam Curls */}
      <group position={[0, -0.002, 1.08]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh position={[-0.09, -0.09, 0]} rotation={[0, 0, -0.38]}>
          <planeGeometry args={[0.07, 0.28]} />
          <meshBasicMaterial
            color="#f0f9ff"
            transparent
            opacity={0.40}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0.09, -0.09, 0]} rotation={[0, 0, 0.38]}>
          <planeGeometry args={[0.07, 0.28]} />
          <meshBasicMaterial
            color="#f0f9ff"
            transparent
            opacity={0.40}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
};

export default ProceduralBulkCarrier;
