import { useMemo } from 'react';
import * as THREE from 'three';
import { torsoProfile, dressProfile, skirtProfile, latheGeometryFromProfile } from '../utils/bodyGeometry.js';
import { armPoints, legPoints, lerp3 } from '../utils/limbPoints.js';
import Segment from './Segment.jsx';

function toVec2Points(profile) {
  return latheGeometryFromProfile(profile).map((p) => new THREE.Vector2(p.x, p.y));
}

function TorsoPiece({ metrics, hemY, ease, color, segments = 36 }) {
  const geo = useMemo(() => {
    const profile = torsoProfile(metrics, { hemY, ease });
    return new THREE.LatheGeometry(toVec2Points(profile), segments);
  }, [metrics, hemY, ease, segments]);

  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshPhysicalMaterial color={color} roughness={0.84} metalness={0} sheen={0.22} sheenRoughness={0.78} side={THREE.DoubleSide} />
    </mesh>
  );
}

function DressPiece({ metrics, color, hemY, flareR, ease }) {
  const geo = useMemo(() => {
    const profile = dressProfile(metrics, { hemY, flareR, ease });
    return new THREE.LatheGeometry(toVec2Points(profile), 36);
  }, [metrics, hemY, flareR, ease]);

  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshPhysicalMaterial color={color} roughness={0.8} sheen={0.24} sheenRoughness={0.76} side={THREE.DoubleSide} />
    </mesh>
  );
}

function SkirtPiece({ metrics, color, hemY, ease }) {
  const geo = useMemo(() => {
    const profile = skirtProfile(metrics, { hemY, ease });
    return new THREE.LatheGeometry(toVec2Points(profile), 36);
  }, [metrics, hemY, ease]);

  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshPhysicalMaterial color={color} roughness={0.83} sheen={0.2} sheenRoughness={0.8} side={THREE.DoubleSide} />
    </mesh>
  );
}

function TeeCollar({ metrics, ease, color }) {
  return (
    <mesh
      position={[0, metrics.y.neckBase + 0.002, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      scale={[1, 0.72, 1]}
      castShadow
    >
      <torusGeometry args={[metrics.neckR * 0.9 * ease, 0.006, 10, 48]} />
      <meshPhysicalMaterial color={color} roughness={0.82} sheen={0.2} />
    </mesh>
  );
}

/** Short sleeve — covers roughly the top 60% of the upper arm. */
function TeeSleeve({ metrics, side, ease, color }) {
  const { shoulder, elbow } = armPoints(metrics, side);
  const hem = lerp3(shoulder, elbow, 0.6);
  return (
    <Segment a={shoulder} b={hem} rTop={metrics.arm.upperR * 0.96 * ease} rBottom={metrics.arm.upperR * 1.08 * ease} color={color} />
  );
}

/** Full-length sleeve, following the shoulder -> elbow -> wrist chain. */
function CoatSleeve({ metrics, side, ease, color }) {
  const { shoulder, elbow, wrist } = armPoints(metrics, side);
  return (
    <>
      <Segment a={shoulder} b={elbow} rTop={metrics.arm.elbowR * 1.14 * ease} rBottom={metrics.arm.upperR * 1.12 * ease} color={color} />
      <Segment a={elbow} b={wrist} rTop={metrics.arm.wristR * 1.2 * ease} rBottom={metrics.arm.elbowR * 1.14 * ease} color={color} />
    </>
  );
}

function TrouserLegs({ metrics, color, ease = 1.38 }) {
  const { leg, hipR, y } = metrics;

  return (
    <>
      {[1, -1].map((side) => {
        const { hip, knee, ankle } = legPoints(metrics, side);
        const hem = lerp3(knee, ankle, 0.82);
        return (
          <group key={side}>
            <Segment a={hip} b={knee} rTop={leg.kneeR * 1.12 * ease} rBottom={leg.thighR * 1.15 * ease} color={color} />
            <Segment a={knee} b={hem} rTop={leg.ankleR * 1.18 * ease} rBottom={leg.kneeR * 1.12 * ease} color={color} />
          </group>
        );
      })}
      <mesh position={[0, y.hip, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[hipR * ease * 0.62, hipR * 0.045, 12, 32]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
    </>
  );
}

/**
 * piece: 'tee' | 'coat' | 'trousers' | 'dress' | 'skirt'
 */
export default function Garment({ piece, color, metrics, sizeFactor = 1 }) {
  const { H } = metrics;

  if (piece === 'tee') {
    const ease = 1.35 * sizeFactor;
    return (
      <>
        <TorsoPiece metrics={metrics} hemY={0.48 * H} ease={ease} color={color} segments={64} />
        <TeeSleeve metrics={metrics} side={1} ease={1.26 * sizeFactor} color={color} />
        <TeeSleeve metrics={metrics} side={-1} ease={1.26 * sizeFactor} color={color} />
        <TeeCollar metrics={metrics} ease={ease} color={color} />
      </>
    );
  }

  if (piece === 'coat') {
    return (
      <>
        <TorsoPiece metrics={metrics} hemY={0.4 * H} ease={1.48 * sizeFactor} color={color} />
        <CoatSleeve metrics={metrics} side={1} ease={1.42 * sizeFactor} color={color} />
        <CoatSleeve metrics={metrics} side={-1} ease={1.42 * sizeFactor} color={color} />
      </>
    );
  }

  if (piece === 'trousers') {
    return <TrouserLegs metrics={metrics} color={color} ease={1.38 * sizeFactor} />;
  }

  if (piece === 'skirt') {
    return <SkirtPiece metrics={metrics} color={color} hemY={0.32 * H} ease={1.28 * sizeFactor} />;
  }

  if (piece === 'dress') {
    return <DressPiece metrics={metrics} color={color} hemY={0.26 * H} flareR={metrics.hipR * 1.6 * sizeFactor} ease={1.32 * sizeFactor} />;
  }

  return null;
}
