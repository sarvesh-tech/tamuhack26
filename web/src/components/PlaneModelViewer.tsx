import { useRef } from 'react'
import { Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useGLTF, OrbitControls, Center } from '@react-three/drei'

useGLTF.preload('/models/plane.glb')

const ROTATE_SPEED = 0.15

function Plane() {
  const { scene } = useGLTF('/models/plane.glb')
  const groupRef = useRef<Group>(null)
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += ROTATE_SPEED * delta
  })
  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={scene} scale={1.2} />
      </Center>
    </group>
  )
}

function Fallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#333" wireframe />
    </mesh>
  )
}

export function PlaneModelViewer() {
  return (
    <div className="dashboard__canvas-inner">
      <Canvas
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        camera={{ position: [1.8, 1.4, 1.6], fov: 30 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} />
        <Suspense fallback={<Fallback />}>
          <Plane />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={1.5}
          maxDistance={8}
          maxPolarAngle={Math.PI / 2 + 0.2}
        />
      </Canvas>
    </div>
  )
}
