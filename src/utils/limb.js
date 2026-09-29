import * as THREE from 'three';

/**
 * Computes position + quaternion to stretch a Y-aligned cylinder from
 * point a to point b. CylinderGeometry's "top" (radiusTop, local +Y) ends
 * up at b; "bottom" (radiusBottom, local -Y) ends up at a.
 */
export function segmentTransform(a, b) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(B, A);
  const length = dir.length() || 0.0001;
  const mid = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.normalize()
  );
  return { position: [mid.x, mid.y, mid.z], quaternion, length };
}
