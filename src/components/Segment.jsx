import { useMemo } from 'react';
import * as THREE from 'three';
import { segmentTransform } from '../utils/limb.js';

/**
 * A single cylinder stretched between two points — a "bone" in the limb
 * chain. rTop is the radius at point b, rBottom the radius at point a.
 */
export default function Segment({ a, b, rTop, rBottom, color, radialSegments = 14, roughness = 0.6 }) {
  const { position, quaternion, length } = useMemo(() => segmentTransform(a, b), [a, b]);
  const geo = useMemo(
    () => new THREE.CylinderGeometry(rTop, rBottom, length, radialSegments),
    [rTop, rBottom, length, radialSegments]
  );

  return (
    <mesh geometry={geo} position={position} quaternion={quaternion} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0.02} />
    </mesh>
  );
}
