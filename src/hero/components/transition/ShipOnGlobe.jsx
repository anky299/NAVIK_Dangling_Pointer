import React, { useRef, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { getMaritimeGlobeCurve, GLOBE_RADIUS } from '../../utils/globeCoordinates';
import { HERO_CONFIG } from '../../config/heroConfig';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { ProceduralBulkCarrier } from '../models/ShipModel';
import { timelineState } from '../../hooks/useContinuousTimeline';

// ============================================================================
// ZERO-ALLOCATION PRE-ALLOCATED MATH SCRATCH OBJECTS (Module Scope)
// Eliminates garbage collection churn on every frame at 60-120 FPS.
// ============================================================================
const _shipPos = new THREE.Vector3();
const _shipTangent = new THREE.Vector3();
const _shipNormal = new THREE.Vector3();
const _shipBitangent = new THREE.Vector3();
const _shipOrthoTangent = new THREE.Vector3();
const _shipRotMatrix = new THREE.Matrix4();

/**
 * GLTF Model Normalizer & PBR Material Enhancer
 */
const NormalizedGLTFShip = ({ path }) => {
  const { scene } = useGLTF(path);

  const normalizedScene = useMemo(() => {
    const clone = scene.clone();

    // Compute accurate bounding box of original model
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Target length on globe: length ≈ 0.28 units (Capesize scale, highly recognizable)
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetScale = maxDim > 0 ? 0.280 / maxDim : 0.14;

    clone.scale.setScalar(targetScale);

    // Waterline alignment
    const waterlineModelOffset = 35.0;
    clone.position.x = -center.x * targetScale;
    clone.position.y = waterlineModelOffset * targetScale;
    clone.position.z = -center.z * targetScale;

    clone.traverse((child) => {
      if (child.isMesh) {
        if (child.material) {
          if (child.material.map) {
            child.material.map.colorSpace = THREE.SRGBColorSpace;
          }
          child.material.roughness = 0.45;
          child.material.metalness = 0.35;
        }
      }
    });

    return clone;
  }, [scene]);

  return <primitive object={normalizedScene} />;
};

/**
 * High-Performance Localized Ocean Water Disc
 * 
 * Performance Architecture:
 * - 4-vertex planar disc at the waterline (Zero CPU vertex loops, Zero computeVertexNormals)
 * - Deep maritime navy PBR surface with calm specular sheen
 * - GPU-level opacity fade between 0.26 and 0.52 as camera pulls back and globe ocean takes over
 */
const LocalOceanWater = () => {
  const meshRef = useRef();
  const geometry = useMemo(() => new THREE.PlaneGeometry(3.6, 3.6), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const progress = timelineState.progress;

    // Smoothly fade out as camera pulls back into space
    const fade = progress < 0.26
      ? 0.94
      : Math.max(0.0, 0.94 * (1.0 - (progress - 0.26) / 0.24));

    if (meshRef.current.material) {
      meshRef.current.material.opacity = fade;
      meshRef.current.visible = fade > 0.01;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.003, 0]}
    >
      <meshStandardMaterial
        color="#03162a"
        roughness={0.16}
        metalness={0.30}
        transparent
        opacity={0.94}
        depthWrite={false}
      />
    </mesh>
  );
};

/**
 * ShipOnGlobe Component
 * Positions and animates the commercial bulk carrier on the globe surface.
 * 
 * Guarantees:
 * - Completely stable heading along the spherical navigation corridor
 * - Zero sideways sliding, zero erratic Euler rotations
 * - Zero per-frame memory allocation
 * - Consistent forward cruising speed
 */
export const ShipOnGlobe = () => {
  const shipGroupRef = useRef();
  const curve = useMemo(() => getMaritimeGlobeCurve(GLOBE_RADIUS, 0.006), []);
  const config = HERO_CONFIG.models.ship;

  useFrame(() => {
    if (!shipGroupRef.current) return;

    // Read timeline progress directly from shared state (zero React re-render)
    const progress = timelineState.progress;

    // Vessel progression along route (continuous steady cruising)
    const vesselT = Math.min(0.999, Math.max(0.001, 0.04 + progress * 0.92));
    curve.getPoint(vesselT, _shipPos);
    curve.getTangent(vesselT, _shipTangent).normalize();

    // Orthonormal basis on the spherical globe surface
    _shipNormal.copy(_shipPos).normalize();
    _shipBitangent.crossVectors(_shipNormal, _shipTangent).normalize();
    _shipOrthoTangent.crossVectors(_shipBitangent, _shipNormal).normalize();

    // Basis matrix: X = bitangent (starboard), Y = normal (up), Z = orthoTangent (forward bow)
    _shipRotMatrix.makeBasis(_shipBitangent, _shipNormal, _shipOrthoTangent);

    // Apply calm, stable world transform
    shipGroupRef.current.position.copy(_shipPos);
    shipGroupRef.current.setRotationFromMatrix(_shipRotMatrix);
  });

  return (
    <group ref={shipGroupRef} name="ShipOnGlobeGroup" renderOrder={10}>
      {/* 1. High-Performance Local Ocean Surface */}
      <LocalOceanWater />

      {/* 2. Commercial Bulk Carrier Vessel */}
      <ErrorBoundary fallback={<ProceduralBulkCarrier scale={0.15} />}>
        <Suspense fallback={<ProceduralBulkCarrier scale={0.15} />}>
          <NormalizedGLTFShip path={config.path} />
        </Suspense>
      </ErrorBoundary>
    </group>
  );
};

export default ShipOnGlobe;
