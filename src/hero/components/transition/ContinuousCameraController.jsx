import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getMaritimeGlobeCurve, GLOBE_RADIUS } from '../../utils/globeCoordinates';
import { timelineState } from '../../hooks/useContinuousTimeline';

// ============================================================================
// ZERO-ALLOCATION PRE-ALLOCATED MATH SCRATCH OBJECTS (Module Scope)
// Eliminates garbage collection churn on every frame at 60-120 FPS.
// ============================================================================
const _localShipPos = new THREE.Vector3();
const _localTangent = new THREE.Vector3();
const _worldShipPos = new THREE.Vector3();
const _worldPlanetCenter = new THREE.Vector3();
const _worldNormal = new THREE.Vector3();
const _worldTangent = new THREE.Vector3();
const _worldBitangent = new THREE.Vector3();
const _safeTangent = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetFocal = new THREE.Vector3();
const _targetUp = new THREE.Vector3();
const _masterCamPos = new THREE.Vector3();
const _masterFocal = new THREE.Vector3();
const _stage2CamPos = new THREE.Vector3();
const _stage2Focal = new THREE.Vector3();
const _tempOffset = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

// Quintic smootherstep (Perlin): guarantees C² continuity (continuous position, velocity, and acceleration)
function smootherstep(x) {
  const c = Math.min(1.0, Math.max(0.0, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

const TOTAL_TIMELINE_DURATION = 10.8; // seconds

/**
 * Top-Down Aerial Cargo Journey & Continuous Pullback Camera Controller
 * 
 * Performance & Motion Architecture:
 * 1. Single Authoritative Clock: Driven directly by Three.js state.clock.getElapsedTime(),
 *    eliminating out-of-sync multi-loop tickers and timing drift.
 * 2. Deterministic Mathematical Trajectory: Direct exact camera placement (C² smootherstep)
 *    eliminates elastic lerp lag, velocity spikes, and camera judder during zoom-out.
 * 3. Zero Memory Allocation: 100% pre-allocated module-level math scratchpad.
 * 4. Zero Mid-Flight React Re-Renders: Milestone listeners fire exclusively at milestone thresholds (>= 0.76).
 */
export const ContinuousCameraController = ({ planetGroupRef }) => {
  const { camera, size } = useThree();
  const curve = useMemo(() => getMaritimeGlobeCurve(GLOBE_RADIUS, 0.006), []);
  const startTimeRef = useRef(-1);
  const lastMilestoneRef = useRef(-1);

  // Hook into timelineState to allow Skip and Restart controls to command the clock
  useEffect(() => {
    timelineState.startTimeline = () => {
      startTimeRef.current = -1;
      lastMilestoneRef.current = -1;
      timelineState.progress = 0;
      timelineState.isFinished = false;
      timelineState.isPlaying = true;
    };

    timelineState.skipTimeline = () => {
      startTimeRef.current = -99999;
      timelineState.progress = 1.0;
      timelineState.isFinished = true;
      timelineState.isPlaying = false;
      timelineState.listeners.forEach((fn) => fn(1.0, 5));
    };

    return () => {
      timelineState.startTimeline = null;
      timelineState.skipTimeline = null;
    };
  }, []);

  useFrame((state) => {
    const isReduced = timelineState.reducedMotion;

    // 1. Authoritative Clock Advancement (Driven directly by R3F frame clock)
    let t = 0;
    if (isReduced || timelineState.isFinished) {
      t = 1.0;
      timelineState.progress = 1.0;
    } else if (!timelineState.isPlaying) {
      t = timelineState.progress;
    } else {
      if (startTimeRef.current < 0) {
        startTimeRef.current = state.clock.getElapsedTime();
      }
      const elapsed = state.clock.getElapsedTime() - startTimeRef.current;
      t = Math.min(1.0, Math.max(0.0, elapsed / TOTAL_TIMELINE_DURATION));
      timelineState.progress = t;

      if (t >= 1.0 && !timelineState.isFinished) {
        timelineState.isFinished = true;
        timelineState.isPlaying = false;
      }
    }

    // 2. Milestone Notification Gate (Fires ONLY when threshold is crossed, never per-frame)
    let currentMilestone = 0;
    if (t >= 0.96) currentMilestone = 5;
    else if (t >= 0.93) currentMilestone = 4;
    else if (t >= 0.90) currentMilestone = 3;
    else if (t >= 0.86) currentMilestone = 2;
    else if (t >= 0.82) currentMilestone = 1;

    if (currentMilestone !== lastMilestoneRef.current) {
      lastMilestoneRef.current = currentMilestone;
      timelineState.listeners.forEach((fn) => fn(t, currentMilestone));
    }

    // 3. Responsive Master Orbital Distance (Phase 4 Master View)
    const aspect = size.width / Math.max(1, size.height);
    const isMobile = aspect < 1.0;
    const fovRad = (camera.fov * Math.PI) / 360;
    const tanFov = Math.tan(fovRad);

    const verticalMasterDist = (GLOBE_RADIUS * 2) / (0.60 * 2 * tanFov);
    const horizontalMasterDist = (GLOBE_RADIUS * 2) / (0.72 * aspect * 2 * tanFov);
    const masterDistance = Math.max(verticalMasterDist, isMobile ? horizontalMasterDist : verticalMasterDist);

    const clockTime = state.clock.getElapsedTime();
    const driftX = (t >= 0.80 && !isReduced) ? Math.sin(clockTime * 0.28) * 0.016 : 0;
    const driftY = (t >= 0.80 && !isReduced) ? Math.cos(clockTime * 0.20) * 0.012 : 0;

    _masterCamPos.set(
      driftX,
      (isMobile ? 0.35 : 0.10) + driftY,
      masterDistance
    );
    _masterFocal.set(0, isMobile ? 0.20 : 0.0, 0);

    // Reduced motion shortcut
    if (isReduced) {
      camera.position.copy(_masterCamPos);
      camera.up.copy(_worldUp);
      camera.lookAt(_masterFocal);
      return;
    }

    // 4. Compute ship world coordinates on the rotating planet
    const vesselT = Math.min(0.999, Math.max(0.001, 0.04 + t * 0.92));
    curve.getPoint(vesselT, _localShipPos);
    curve.getTangent(vesselT, _localTangent).normalize();

    if (planetGroupRef?.current) {
      planetGroupRef.current.updateWorldMatrix(true, false);
      const worldMatrix = planetGroupRef.current.matrixWorld;

      _worldShipPos.copy(_localShipPos).applyMatrix4(worldMatrix);
      _worldPlanetCenter.set(0, 0, 0).applyMatrix4(worldMatrix);

      _worldNormal.subVectors(_worldShipPos, _worldPlanetCenter).normalize();
      _worldTangent.copy(_localTangent).transformDirection(worldMatrix).normalize();
      _worldBitangent.crossVectors(_worldNormal, _worldTangent).normalize();
      _safeTangent.crossVectors(_worldBitangent, _worldNormal).normalize();
    } else {
      _worldShipPos.copy(_localShipPos);
      _worldNormal.copy(_localShipPos).normalize();
      _safeTangent.copy(_localTangent);
    }

    // 5. C² Continuous Trajectory Mathematics (Direct, Deterministic, 100% Smooth)
    if (t < 0.24) {
      // -------------------------------------------------------------
      // STAGE 1: TOP-DOWN AERIAL CARGO SCENE (0 to ~2.6s)
      // Camera positioned vertically above vessel, looking directly down at ocean.
      // Up vector locked to forward heading. Zero spinning, zero gimbal flip.
      // -------------------------------------------------------------
      const p1 = t / 0.24;
      const ease1 = smootherstep(p1);

      // Subtle gentle drift while cruising
      const alt = 0.74 + ease1 * 0.04;

      _targetCamPos.copy(_worldShipPos).addScaledVector(_worldNormal, alt);
      _targetFocal.copy(_worldShipPos);
      _targetUp.copy(_safeTangent);
    } else if (t < 0.58) {
      // -------------------------------------------------------------
      // STAGE 2: TOP-DOWN SMOOTH PULLBACK & CURVATURE EMERGENCE (~2.6 to 6.2s)
      // Camera pulls back vertically; vessel shrinks, ocean expands,
      // and planetary curvature emerges with Perlin quintic acceleration.
      // -------------------------------------------------------------
      const u = (t - 0.24) / 0.34;
      const easeU = smootherstep(u);

      // Smooth altitude ascent from 0.78 to 5.8 units
      const alt = 0.78 + easeU * 5.02;

      if (u < 0.35) {
        // Early Stage 2: Pure vertical top-down pullback directly above the ship
        _targetCamPos.copy(_worldShipPos).addScaledVector(_worldNormal, alt);
        _targetFocal.copy(_worldShipPos);
        _targetUp.copy(_safeTangent);
      } else {
        // Late Stage 2: Planetary curvature emerges; blend position toward orbital angle
        const blend = (u - 0.35) / 0.65;
        const easeBlend = smootherstep(blend);

        // Vertical overhead position at this altitude
        _stage2CamPos.copy(_worldShipPos).addScaledVector(_worldNormal, alt);

        // Arched position lifting toward equatorial orbit
        _tempOffset.copy(_worldNormal).multiplyScalar(alt * 0.85)
          .subScaledVector(_safeTangent, alt * 0.35);
        _targetCamPos.copy(_worldShipPos).add(_tempOffset);

        // Quintic blend from overhead to arched position
        _targetCamPos.lerpVectors(_stage2CamPos, _targetCamPos, easeBlend);

        // Focal point gently broadens from ship toward planet center
        _targetFocal.lerpVectors(_worldShipPos, _worldPlanetCenter, easeBlend * 0.60);

        // Up vector smoothly transitions from ship forward heading toward world up
        _targetUp.lerpVectors(_safeTangent, _worldUp, easeBlend).normalize();
      }
    } else if (t < 0.80) {
      // -------------------------------------------------------------
      // STAGE 3: SPACE ELEVATION & FULL EARTH REVEAL (~6.2 to 8.6s)
      // Curvature closes into complete sphere against pitch-black space.
      // Rayleigh halo, stars, and maritime corridors ignite.
      // -------------------------------------------------------------
      const v = (t - 0.58) / 0.22;
      const easeV = smootherstep(v);

      // State at end of Stage 2 (alt = 5.8)
      const endAlt = 5.80;
      _tempOffset.copy(_worldNormal).multiplyScalar(endAlt * 0.85)
        .subScaledVector(_safeTangent, endAlt * 0.35);
      _stage2CamPos.copy(_worldShipPos).add(_tempOffset);
      _stage2Focal.lerpVectors(_worldShipPos, _worldPlanetCenter, 0.60);

      // Direct smooth blend into Master orbital camera position
      _targetCamPos.lerpVectors(_stage2CamPos, _masterCamPos, easeV);
      _targetFocal.lerpVectors(_stage2Focal, _masterFocal, easeV);
      _targetUp.lerpVectors(_safeTangent, _worldUp, Math.min(1.0, 0.65 + easeV * 0.35)).normalize();
    } else {
      // -------------------------------------------------------------
      // STAGE 4: MASTER COMPOSITION & CONTINUOUS ROTATION (~8.6s+)
      // Complete globe rotating smoothly with subtle breathing drift
      // -------------------------------------------------------------
      _targetCamPos.copy(_masterCamPos);
      _targetFocal.copy(_masterFocal);
      _targetUp.copy(_worldUp);
    }

    // 6. Direct Exact Camera Placement (ZERO LERP LAG, ZERO JITTER)
    camera.position.copy(_targetCamPos);
    camera.up.copy(_targetUp);
    camera.lookAt(_targetFocal);
  });

  return null;
};

export default ContinuousCameraController;
