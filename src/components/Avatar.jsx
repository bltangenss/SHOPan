import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getHumanTransform } from '../utils/humanModel.js';

const BODY_URL = '/models/vitruvian-body.glb';
const HEAD_URL = '/models/vitruvian-head.glb';
const TEXTURES = {
  bodyColor: '/models/vit-body-bc.webp',
  bodyNormal: '/models/vit-body-n.webp',
  bodyRoughness: '/models/vit-body-rough.webp',
  faceColor: '/models/vit-face-bc.webp',
  faceNormal: '/models/vit-face-n.webp',
  faceRoughness: '/models/vit-face-rough.webp',
  iris: '/models/vit-iris.webp',
  mouth: '/models/vit-mouth.webp',
  sclera: '/models/vit-sclera.webp',
};

const EMPTY_OUTFIT = { pieces: [], colors: {}, factors: {} };

function describeOutfit(outfit) {
  const topPiece = outfit.pieces.find((piece) => ['tee', 'coat', 'dress'].includes(piece));
  const bottomPiece = outfit.pieces.find((piece) => ['trousers', 'skirt', 'dress'].includes(piece));
  return {
    topPiece,
    bottomPiece,
    topColor: outfit.colors[topPiece] || '#eee9df',
    bottomColor: outfit.colors[bottomPiece] || '#28282b',
    topFactor: outfit.factors?.[topPiece] || 1,
    bottomFactor: outfit.factors?.[bottomPiece] || 1,
  };
}

function skinMultiplier(skinTone) {
  const selected = new THREE.Color(skinTone);
  const neutral = new THREE.Color('#e4c6a8');
  return new THREE.Color(
    THREE.MathUtils.clamp(selected.r / neutral.r, 0.48, 1.16),
    THREE.MathUtils.clamp(selected.g / neutral.g, 0.48, 1.16),
    THREE.MathUtils.clamp(selected.b / neutral.b, 0.48, 1.16),
  );
}

function clothMaterial(color) {
  const base = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({
    color: base,
    roughness: 0.86,
    metalness: 0,
    sheen: 0.42,
    sheenColor: base.clone().lerp(new THREE.Color('#ffffff'), 0.18),
    sheenRoughness: 0.76,
    side: THREE.DoubleSide,
  });
}

function buildMaterials(textures, skinTone, outfit) {
  const skinColor = skinMultiplier(skinTone);
  const exposedLegColor = new THREE.Color(skinTone).multiplyScalar(0.45);
  const { topColor, bottomColor, bottomPiece } = describeOutfit(outfit);

  const bodySkin = new THREE.MeshPhysicalMaterial({
    color: skinColor,
    map: textures.bodyColor,
    normalMap: textures.bodyNormal,
    normalScale: new THREE.Vector2(0.38, 0.38),
    roughnessMap: textures.bodyRoughness,
    roughness: 0.74,
    metalness: 0,
    clearcoat: 0.02,
    clearcoatRoughness: 0.82,
  });
  const faceSkin = new THREE.MeshPhysicalMaterial({
    color: skinColor,
    map: textures.faceColor,
    normalMap: textures.faceNormal,
    normalScale: new THREE.Vector2(0.46, 0.46),
    roughnessMap: textures.faceRoughness,
    roughness: 0.68,
    metalness: 0,
    clearcoat: 0.025,
    clearcoatRoughness: 0.78,
  });

  return new Map([
    ['VitBody', bodySkin],
    ['VitShoes', new THREE.MeshStandardMaterial({ color: '#202124', roughness: 0.56 })],
    ['VitPants', ['dress', 'skirt'].includes(bottomPiece)
      ? new THREE.MeshPhysicalMaterial({ color: exposedLegColor, roughness: 0.7, metalness: 0 })
      : clothMaterial(bottomColor)],
    ['VitShirt', clothMaterial(topColor)],
    ['VitSkin', faceSkin],
    ['VitMouth', new THREE.MeshPhysicalMaterial({ map: textures.mouth, roughness: 0.58 })],
    ['VitSclera', new THREE.MeshPhysicalMaterial({ map: textures.sclera, roughness: 0.32, clearcoat: 0.2 })],
    ['VitIris', new THREE.MeshPhysicalMaterial({ map: textures.iris, roughness: 0.28, clearcoat: 0.32 })],
    ['VitEyeBack', new THREE.MeshBasicMaterial({ color: '#17130f' })],
    ['VitCornea2', new THREE.MeshPhysicalMaterial({
      color: '#ffffff', transparent: true, opacity: 0.2, roughness: 0.04,
      clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false,
    })],
    ['VitEyeshadow', new THREE.MeshStandardMaterial({
      color: '#6a403b', transparent: true, opacity: 0.14, roughness: 0.72, depthWrite: false,
    })],
    ['VitTearline', new THREE.MeshPhysicalMaterial({
      color: '#fff1ec', transparent: true, opacity: 0.24, roughness: 0.12, depthWrite: false,
    })],
    ['VitCaruncle', new THREE.MeshStandardMaterial({ color: '#b76e70', roughness: 0.58 })],
  ]);
}

function createEllipticalShell(piece, color, sourceMesh) {
  const profiles = {
    skirt: [
      { y: 1.015, rx: 0.19, rz: 0.145 },
      { y: 0.92, rx: 0.205, rz: 0.16 },
      { y: 0.7, rx: 0.24, rz: 0.175 },
      { y: 0.47, rx: 0.275, rz: 0.185 },
    ],
    dress: [
      { y: 1.02, rx: 0.185, rz: 0.145 },
      { y: 0.92, rx: 0.2, rz: 0.16 },
      { y: 0.68, rx: 0.255, rz: 0.18 },
      { y: 0.4, rx: 0.31, rz: 0.195 },
    ],
    coat: [
      { y: 1.025, rx: 0.205, rz: 0.16 },
      { y: 0.9, rx: 0.215, rz: 0.17 },
      { y: 0.73, rx: 0.235, rz: 0.178 },
      { y: 0.57, rx: 0.25, rz: 0.185 },
    ],
  };
  const rings = profiles[piece];
  if (!rings) return null;

  const segments = 72;
  const centerZ = -0.045;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  rings.forEach((ring, ringIndex) => {
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      positions.push(ring.rx * sin, ring.y, centerZ + ring.rz * cos);
      normals.push(sin / ring.rx, 0.08, cos / ring.rz);
      uvs.push(segment / segments, ringIndex / (rings.length - 1));
    }
  });
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * (segments + 1) + segment;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const hipsIndex = sourceMesh.skeleton.bones.findIndex((bone) => bone.name === 'mixamorig:Hips');
  const skinIndices = new Uint16Array((positions.length / 3) * 4);
  const skinWeights = new Float32Array((positions.length / 3) * 4);
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    skinIndices[vertex * 4] = Math.max(0, hipsIndex);
    skinWeights[vertex * 4] = 1;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  const material = clothMaterial(color);
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.bind(sourceMesh.skeleton, sourceMesh.bindMatrix);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return { mesh, geometry, material };
}

function normalizeMaterialName(name) {
  return name?.replace(/\.\d+$/, '') || '';
}

function applyMaterials(root, materials) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    const originals = Array.isArray(object.material) ? object.material : [object.material];
    const replacements = originals.map((material) => (
      materials.get(normalizeMaterialName(material.name)) || material.clone()
    ));
    object.material = Array.isArray(object.material) ? replacements : replacements[0];
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
  });
}

function createHair(color) {
  const base = new THREE.Color(color);
  const material = new THREE.MeshPhysicalMaterial({
    color: base,
    roughness: 0.48,
    metalness: 0,
    sheen: 0.95,
    sheenColor: base.clone().lerp(new THREE.Color('#ffffff'), 0.32),
    sheenRoughness: 0.52,
    clearcoat: 0.04,
    clearcoatRoughness: 0.68,
  });
  const group = new THREE.Group();
  const parts = [
    { position: [0, 1.658, -0.066], scale: [0.099, 0.116, 0.076] },
    { position: [0, 1.662, -0.005], scale: [0.101, 0.116, 0.106], cap: true },
    { position: [-0.034, 1.7, 0.067], scale: [0.038, 0.035, 0.014], rotation: [0.15, 0.14, -0.22] },
  ];
  parts.forEach((part) => {
    const geometry = part.cap
      ? new THREE.SphereGeometry(1, 48, 28, 0, Math.PI * 2, 0, 1.23)
      : new THREE.SphereGeometry(1, 40, 24);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.fromArray(part.position);
    mesh.scale.fromArray(part.scale);
    if (part.rotation) mesh.rotation.fromArray(part.rotation);
    mesh.castShadow = true;
    group.add(mesh);
  });
  return { group, material };
}

/**
 * CC0 Vitruvian digital human: a detailed face and eyes joined to a rigged
 * body with real, skin-weighted shirt and trouser meshes. SMPL-300 remains
 * the measurement/fit layer while this model is the customer-facing render.
 */
export default function Avatar({ measurements, gender, skinTone, hairColor, outfit = EMPTY_OUTFIT }) {
  const bodyAsset = useGLTF(BODY_URL);
  const headAsset = useGLTF(HEAD_URL);
  const textures = useTexture(TEXTURES);
  const faceMeshRef = useRef(null);

  const preparedTextures = useMemo(() => {
    Object.entries(textures).forEach(([name, texture]) => {
      texture.flipY = false;
      texture.anisotropy = 8;
      if (name.endsWith('Color') || ['iris', 'mouth', 'sclera'].includes(name)) {
        texture.colorSpace = THREE.SRGBColorSpace;
      }
      texture.needsUpdate = true;
    });
    return textures;
  }, [textures]);

  const person = useMemo(() => {
    const root = new THREE.Group();
    const body = cloneSkeleton(bodyAsset.scene);
    const head = headAsset.scene.clone(true);
    const hair = createHair(hairColor);
    const headAssembly = new THREE.Group();
    const outfitStyle = describeOutfit(outfit);
    const shellPiece = outfit.pieces.includes('dress')
      ? 'dress'
      : outfit.pieces.includes('skirt')
        ? 'skirt'
        : outfit.pieces.includes('coat') ? 'coat' : null;
    const shellColor = shellPiece === 'skirt' ? outfitStyle.bottomColor : outfitStyle.topColor;
    const shellFactor = shellPiece === 'skirt' ? outfitStyle.bottomFactor : outfitStyle.topFactor;
    const materials = buildMaterials(preparedTextures, skinTone, outfit);
    applyMaterials(body, materials);
    applyMaterials(head, materials);
    const shirt = body.getObjectByName('Shirt');
    const pants = body.getObjectByName('Pants');
    const shell = shellPiece && pants
      ? createEllipticalShell(shellPiece, shellColor, pants)
      : null;
    if (shirt) shirt.scale.set(outfitStyle.topFactor, 1, outfitStyle.topFactor);
    if (pants) pants.scale.set(outfitStyle.bottomFactor, 1, outfitStyle.bottomFactor);
    if (shell) shell.mesh.scale.set(shellFactor, 1, shellFactor);
    if (shell) pants.parent.add(shell.mesh);
    headAssembly.add(head, hair.group);
    root.add(body, headAssembly);
    root.updateMatrixWorld(true);

    let headBone = null;
    body.traverse((object) => {
      if (object.isBone && object.name === 'mixamorig:Head') headBone = object;
    });
    if (headBone) headBone.attach(headAssembly);

    head.traverse((object) => {
      if (object.morphTargetDictionary?.Eyes_Closed_Max !== undefined) faceMeshRef.current = object;
    });
    return { root, body, materials, hair, shell };
  }, [bodyAsset.scene, headAsset.scene, preparedTextures, skinTone, hairColor, outfit]);

  const idleClip = useMemo(
    () => THREE.AnimationClip.findByName(bodyAsset.animations, 'Idle') || bodyAsset.animations[0],
    [bodyAsset.animations],
  );
  const mixer = useMemo(() => new THREE.AnimationMixer(person.body), [person.body]);

  const transform = useMemo(
    () => getHumanTransform(gender, measurements),
    [gender, measurements],
  );

  useEffect(() => () => {
    person.materials.forEach((material) => material.dispose());
    person.hair.group.traverse((object) => object.geometry?.dispose());
    person.hair.material.dispose();
    person.shell?.geometry.dispose();
    person.shell?.material.dispose();
  }, [person]);

  useEffect(() => {
    if (!idleClip) return undefined;
    const action = mixer.clipAction(idleClip);
    action.reset().play();
    return () => {
      action.stop();
      mixer.stopAllAction();
      mixer.uncacheRoot(person.body);
    };
  }, [idleClip, mixer, person.body]);

  useFrame(({ clock }) => {
    if (idleClip) mixer.setTime(clock.elapsedTime % idleClip.duration);
    const face = faceMeshRef.current;
    if (!face?.morphTargetInfluences) return;
    const blinkIndex = face.morphTargetDictionary.Eyes_Closed_Max;
    const smileIndex = face.morphTargetDictionary.Smile_Lips_Closed;
    const phase = clock.elapsedTime % 4.8;
    face.morphTargetInfluences[blinkIndex] = phase < 0.16
      ? Math.sin((phase / 0.16) * Math.PI) * 0.92
      : 0;
    face.morphTargetInfluences[smileIndex] = 0.08;
  });

  return (
    <group position={[0, transform.shiftY, 0]} scale={transform.scale}>
      <primitive object={person.root} />
    </group>
  );
}

useGLTF.preload(BODY_URL);
useGLTF.preload(HEAD_URL);
Object.values(TEXTURES).forEach((url) => useTexture.preload(url));
