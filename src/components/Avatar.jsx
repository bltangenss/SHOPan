import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { computeBodyMetrics } from '../utils/bodyGeometry.js';
import { predictBetas, SMPL_SHAPE_COMPONENTS } from '../utils/smplRegression.js';

const MODEL_URL = {
  female: '/models/smpl_female_300.glb',
  male: '/models/smpl_male_300.glb',
};

function Hair({ metrics, headCenterY, color, style }) {
  const { headR } = metrics;

  return (
    <group>
      <mesh
        position={[0, headCenterY + headR.y * 0.4, -headR.z * 0.06]}
        scale={[headR.x * 1.1, headR.y * 0.62, headR.z * 1.08]}
      >
        <sphereGeometry args={[1, 24, 20]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>

      {style === 'long' && (
        <>
          <mesh position={[0, headCenterY - headR.y * 0.6, -headR.z * 0.85]}>
            <boxGeometry args={[headR.x * 1.35, headR.y * 2.6, headR.z * 0.5]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * headR.x * 0.85, headCenterY - headR.y * 0.7, headR.z * 0.15]}>
              <cylinderGeometry args={[headR.x * 0.1, headR.x * 0.16, headR.y * 2.3, 10]} />
              <meshStandardMaterial color={color} roughness={0.85} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

/**
 * Real, anatomically-derived human body: a rigged SMPL mesh (24-joint
 * skeleton, 6890 vertices and all 300 SMPL shape targets. The available body
 * measurements drive the calibrated principal components; unconstrained
 * detail components stay neutral. Hair is a procedural extra.
 */
export default function Avatar({ measurements, gender, skinTone, hairColor }) {
  const groupRef = useRef();
  const url = MODEL_URL[gender] ?? MODEL_URL.female;
  const { scene } = useGLTF(url);

  const cloned = useMemo(() => cloneSkeleton(scene), [scene]);

  const skinnedMesh = useMemo(() => {
    let found = null;
    cloned.traverse((obj) => {
      if (obj.isSkinnedMesh && !found) found = obj;
    });
    return found;
  }, [cloned]);

  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.02 }), []);
  useEffect(() => {
    material.color.set(skinTone);
  }, [material, skinTone]);

  useEffect(() => {
    if (!skinnedMesh) return;
    skinnedMesh.material = material;
    skinnedMesh.castShadow = true;
    skinnedMesh.receiveShadow = true;
    skinnedMesh.frustumCulled = false; // shape morphs move the true bounds; don't risk it popping out of view
  }, [skinnedMesh, material]);

  // Apply the predicted shape (betas) as morph target weights, and measure
  // the *actual* resulting bounding box on the CPU (geometry.boundingBox
  // only reflects the un-morphed base mesh, not the shaped one).
  const shapeInfo = useMemo(() => {
    if (!skinnedMesh) return null;
    const betas = predictBetas(gender, measurements);
    const influences = skinnedMesh.morphTargetInfluences;
    if (influences?.length >= SMPL_SHAPE_COMPONENTS) {
      influences.fill(0);
      for (let i = 0; i < betas.length && i < influences.length; i++) influences[i] = betas[i];
    }

    const geo = skinnedMesh.geometry;
    const base = geo.attributes.position;
    const morphs = geo.morphAttributes.position || [];
    const activeBetas = betas
      .map((value, index) => ({ value, index }))
      .filter(({ value, index }) => Math.abs(value) > 1e-8 && index < morphs.length);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let vi = 0; vi < base.count; vi++) {
      let y = base.getY(vi);
      for (const { value, index } of activeBetas) {
        y += value * morphs[index].getY(vi);
      }
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { betas, minY, maxY };
  }, [skinnedMesh, gender, measurements]);

  // Hair placement uses the *real* measured top of the loaded mesh
  // (shapeInfo.maxY/minY, computed above from the actual shaped geometry)
  // so it lines up with the real head regardless of any small mismatch
  // between the requested height and the regression's actual output.
  const metrics = useMemo(() => computeBodyMetrics({ ...measurements, gender }), [measurements, gender]);
  const { headR } = metrics;
  const realH = shapeInfo ? shapeInfo.maxY - shapeInfo.minY : metrics.H;
  const headCenterY = realH - headR.y;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.32) * 0.05;
    }
  });

  const shiftY = shapeInfo ? -shapeInfo.minY : 0;

  return (
    <group ref={groupRef}>
      <group position={[0, shiftY, 0]}>
        <primitive object={cloned} />
      </group>

      <Hair metrics={metrics} headCenterY={headCenterY} color={hairColor} style={metrics.hairStyle} />
    </group>
  );
}
