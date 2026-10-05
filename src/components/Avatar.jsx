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
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    roughness: 0.58,
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.72,
    sheen: 0.72,
    sheenRoughness: 0.68,
  }), []);

  useEffect(() => {
    const base = new THREE.Color(color);
    material.color.copy(base);
    material.sheenColor.copy(base.clone().lerp(new THREE.Color('#ffffff'), 0.16));
  }, [color, material]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <group>
      <mesh
        position={[0, headCenterY + headR.y * 0.04, -headR.z * 0.06]}
        scale={[headR.x * 1.06, headR.y * 1.08, headR.z * 1.08]}
        material={material}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[1, 48, 28, 0, Math.PI * 2, 0, Math.PI * 0.34]} />
      </mesh>

      {style === 'long' && (
        <>
          <mesh
            position={[0, headCenterY - headR.y * 0.78, -headR.z * 0.58]}
            scale={[headR.x * 1.02, headR.y * 1.62, headR.z * 0.64]}
            material={material}
            castShadow
            receiveShadow
          >
            <sphereGeometry args={[1, 40, 32]} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * headR.x * 0.87, headCenterY - headR.y * 0.68, -headR.z * 0.04]}
              rotation={[0, 0, side * 0.07]}
              scale={[headR.x * 0.18, headR.y * 1.12, headR.z * 0.24]}
              material={material}
              castShadow
              receiveShadow
            >
              <sphereGeometry args={[1, 28, 24]} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

function FaceDetails({ metrics, headCenterY, skinTone, hairColor }) {
  const eyesRef = useRef();
  const { headR } = metrics;
  const eyeX = headR.x * 0.34;
  const eyeY = headCenterY + headR.y * 0.35;
  const eyeZ = headR.z * 1.015;
  const eyeW = headR.x * 0.145;
  const eyeH = headR.y * 0.052;
  const eyeDepth = headR.z * 0.032;

  const irisColor = useMemo(
    () => new THREE.Color(hairColor).lerp(new THREE.Color('#8a7358'), 0.48),
    [hairColor],
  );
  const browColor = useMemo(
    () => new THREE.Color(hairColor).multiplyScalar(0.72),
    [hairColor],
  );
  const lipColor = useMemo(
    () => new THREE.Color(skinTone).lerp(new THREE.Color('#9f5861'), 0.34),
    [skinTone],
  );

  useFrame((state) => {
    if (!eyesRef.current) return;
    const phase = state.clock.elapsedTime % 5.2;
    const target = phase < 0.18 ? Math.max(0.08, Math.abs(phase - 0.09) / 0.09) : 1;
    eyesRef.current.scale.y = THREE.MathUtils.lerp(eyesRef.current.scale.y, target, 0.72);
  });

  return (
    <group>
      <group ref={eyesRef} position={[0, eyeY, eyeZ]}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * eyeX, 0, 0]}>
            <mesh scale={[eyeW, eyeH, eyeDepth]} castShadow>
              <sphereGeometry args={[1, 28, 18]} />
              <meshPhysicalMaterial color="#f2eee8" roughness={0.3} clearcoat={0.24} clearcoatRoughness={0.2} />
            </mesh>
            <mesh position={[0, 0, eyeDepth * 1.04]}>
              <circleGeometry args={[eyeH * 0.72, 28]} />
              <meshPhysicalMaterial color={irisColor} roughness={0.28} clearcoat={0.36} />
            </mesh>
            <mesh position={[0, 0, eyeDepth * 1.1]}>
              <circleGeometry args={[eyeH * 0.32, 24]} />
              <meshBasicMaterial color="#171412" />
            </mesh>
            <mesh position={[-eyeH * 0.2, eyeH * 0.22, eyeDepth * 1.14]}>
              <circleGeometry args={[eyeH * 0.11, 16]} />
              <meshBasicMaterial color="#fffdf8" />
            </mesh>
          </group>
        ))}
      </group>

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * eyeX, eyeY + headR.y * 0.17, headR.z * 0.965]}
          rotation={[0, 0, side * 0.09]}
          scale={[headR.x * 0.2, headR.y * 0.012, headR.z * 0.018]}
        >
          <sphereGeometry args={[1, 24, 12]} />
          <meshStandardMaterial color={browColor} roughness={0.82} />
        </mesh>
      ))}

      <mesh
        position={[0, headCenterY - headR.y * 0.18, headR.z * 1.12]}
        scale={[headR.x * 0.3, headR.y * 0.033, headR.z * 0.024]}
      >
        <sphereGeometry args={[1, 32, 16]} />
        <meshPhysicalMaterial color={lipColor} roughness={0.48} clearcoat={0.08} />
      </mesh>
      <mesh
        position={[0, headCenterY - headR.y * 0.185, headR.z * 1.145]}
        scale={[headR.x * 0.24, headR.y * 0.007, headR.z * 0.01]}
      >
        <sphereGeometry args={[1, 24, 10]} />
        <meshBasicMaterial color="#6d3f45" />
      </mesh>
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

  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    roughness: 0.56,
    metalness: 0,
    clearcoat: 0.025,
    clearcoatRoughness: 0.82,
    sheen: 0.26,
    sheenRoughness: 0.76,
  }), []);
  useEffect(() => {
    const base = new THREE.Color(skinTone);
    material.color.copy(base);
    material.sheenColor.copy(base.clone().lerp(new THREE.Color('#fff0e8'), 0.32));
    material.emissive.copy(base).multiplyScalar(0.035);
    material.emissiveIntensity = 0.08;
  }, [material, skinTone]);

  useEffect(() => () => material.dispose(), [material]);

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

  const shiftY = shapeInfo ? -shapeInfo.minY : 0;

  return (
    <group>
      <group position={[0, shiftY, 0]}>
        <primitive object={cloned} />
      </group>

      <Hair metrics={metrics} headCenterY={headCenterY} color={hairColor} style={metrics.hairStyle} />
      <FaceDetails
        metrics={metrics}
        headCenterY={headCenterY}
        skinTone={skinTone}
        hairColor={hairColor}
      />
    </group>
  );
}
