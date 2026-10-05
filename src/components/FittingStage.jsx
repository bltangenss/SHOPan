import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Maximize, Minimize, RotateCcw } from 'lucide-react';
import Avatar from './Avatar.jsx';
import Garment from './Garment.jsx';
import { computeBodyMetrics } from '../utils/bodyGeometry.js';

function makeArch(radius, springHeight) {
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  shape.lineTo(radius, 0);
  shape.lineTo(radius, springHeight);
  shape.absarc(0, springHeight, radius, 0, Math.PI, false);
  shape.closePath();
  return shape;
}

function FittingRoom({ floorY }) {
  const outerArch = useMemo(() => makeArch(1.13, 1.18), []);
  const innerArch = useMemo(() => makeArch(1.065, 1.16), []);

  return (
    <group position={[0, floorY, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#b7bbb5" roughness={0.88} />
      </mesh>

      <mesh position={[0, 1.55, -2.38]}>
        <planeGeometry args={[8, 3.1]} />
        <meshStandardMaterial color="#83978a" roughness={0.95} />
      </mesh>

      <mesh position={[0, 0.085, -2.32]}>
        <planeGeometry args={[8, 0.17]} />
        <meshStandardMaterial color="#536b60" roughness={0.8} />
      </mesh>

      <mesh position={[0, 2.69, -2.31]}>
        <planeGeometry args={[8, 0.075]} />
        <meshStandardMaterial color="#3c5149" roughness={0.75} />
      </mesh>

      <mesh position={[0, 0, -2.29]}>
        <shapeGeometry args={[outerArch]} />
        <meshStandardMaterial color="#b99d75" metalness={0.18} roughness={0.64} />
      </mesh>
      <mesh position={[0, 0, -2.275]}>
        <shapeGeometry args={[innerArch]} />
        <meshStandardMaterial color="#314641" roughness={0.95} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 1.43, 1.37, -2.265]}>
            <planeGeometry args={[0.39, 2.52]} />
            <meshStandardMaterial color="#698074" roughness={0.9} />
          </mesh>
          <mesh position={[side * 1.23, 1.37, -2.255]}>
            <planeGeometry args={[0.018, 2.52]} />
            <meshStandardMaterial color="#c3aa80" metalness={0.26} roughness={0.55} />
          </mesh>
          <mesh position={[side * 1.64, 1.37, -2.255]}>
            <planeGeometry args={[0.018, 2.52]} />
            <meshStandardMaterial color="#c3aa80" metalness={0.26} roughness={0.55} />
          </mesh>
          <mesh position={[side * 1.43, 1.47, -2.24]}>
            <planeGeometry args={[0.055, 0.54]} />
            <meshStandardMaterial color="#eee2c4" emissive="#e4c88e" emissiveIntensity={0.65} roughness={0.4} />
          </mesh>
          <mesh position={[side * 1.43, 1.47, -2.25]}>
            <planeGeometry args={[0.12, 0.62]} />
            <meshStandardMaterial color="#344a42" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {[-1.8, -0.6, 0.6, 1.8].map((x) => (
        <mesh key={x} position={[x, 0.003, -0.25]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.006, 10]} />
          <meshBasicMaterial color="#88918a" transparent opacity={0.4} />
        </mesh>
      ))}
      {[-1.48, 0.05, 1.58].map((z) => (
        <mesh key={z} position={[0, 0.003, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10, 0.006]} />
          <meshBasicMaterial color="#88918a" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ measurements, gender, skinTone, hairColor, outfit, modelRef }) {
  const metrics = useMemo(() => computeBodyMetrics({ ...measurements, gender }), [measurements, gender]);

  return (
    <>
      <ambientLight intensity={0.12} />
      <hemisphereLight args={['#fff7ed', '#344a40', 0.58]} />
      <directionalLight
        castShadow
        color="#fff0df"
        position={[2.8, 4.4, 3.6]}
        intensity={1.38}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={10}
        shadow-camera-left={-1.6}
        shadow-camera-right={1.6}
        shadow-camera-top={2.2}
        shadow-camera-bottom={-2.2}
        shadow-bias={-0.00015}
      />
      <directionalLight color="#dce8ff" position={[-3.2, 2.5, 2.2]} intensity={0.48} />
      <directionalLight color="#ffd8c2" position={[0.8, 3.2, -3.5]} intensity={0.62} />

      <FittingRoom floorY={-metrics.H / 2} />

      <group ref={modelRef} position={[0, -metrics.H / 2, 0]}>
        <Avatar measurements={measurements} gender={gender} skinTone={skinTone} hairColor={hairColor} />
        {outfit.pieces.map((piece) => (
          <Garment key={piece} piece={piece} color={outfit.colors[piece]} metrics={metrics} sizeFactor={outfit.factors?.[piece] || 1} />
        ))}
      </group>

      <ContactShadows position={[0, -metrics.H / 2 + 0.006, 0]} opacity={0.35} scale={3} blur={2.5} far={1.5} />
      <OrbitControls
        enablePan={false}
        enableRotate={false}
        minDistance={1.4}
        maxDistance={4.8}
        target={[0, 0, 0]}
      />
    </>
  );
}

export default function FittingStage({ measurements, gender, skinTone, hairColor, outfit }) {
  const frameRef = useRef(null);
  const modelRef = useRef(null);
  const dragRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = async () => {
    if (!frameRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await frameRef.current.requestFullscreen();
      }
    } catch {
      // Fullscreen not available (e.g. iframe without allow="fullscreen") — fail silently.
    }
  };

  const handlePointerDown = (event) => {
    if (event.target.tagName !== 'CANVAS') return;
    dragRef.current = { id: event.pointerId, x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    if (dragRef.current?.id !== event.pointerId || !modelRef.current) return;
    modelRef.current.rotation.y += (event.clientX - dragRef.current.x) * 0.012;
    dragRef.current.x = event.clientX;
  };

  const handlePointerUp = (event) => {
    if (dragRef.current?.id !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={frameRef}
      className={`mirror-frame ${isFullscreen ? 'mirror-frame--full' : ''} ${isDragging ? 'mirror-frame--dragging' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="mirror-frame__toolbar">
        <button type="button" className="icon-button" aria-label="Вид спереди" title="Вид спереди" onClick={() => { if (modelRef.current) modelRef.current.rotation.y = 0; }}><RotateCcw size={19} /></button>
        <button type="button" className="icon-button" aria-label={isFullscreen ? 'Свернуть' : 'Во весь экран'} title={isFullscreen ? 'Свернуть' : 'Во весь экран'} onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
        </button>
      </div>
      <Canvas
        shadows
        camera={{ position: [0, 0.05, 4], fov: 32 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.96;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <color attach="background" args={['#83978a']} />
        <Suspense fallback={null}>
          <Scene
            measurements={measurements}
            gender={gender}
            skinTone={skinTone}
            hairColor={hairColor}
            outfit={outfit}
            modelRef={modelRef}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
