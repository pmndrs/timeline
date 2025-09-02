import { Environment, Lightformer } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Effects } from './effect.js'
import { Lamborghini } from './lamborghini.js'
import { RenderText } from './text.js'

export function App() {
  return (
    <Canvas
      gl={{ logarithmicDepthBuffer: true, antialias: false }}
      camera={{ position: [300, 0, 0], fov: 90, far: 10000 }}
      shadows="soft"
    >
      <color attach="background" args={['#15151a']} />
      <Scene />
    </Canvas>
  )
}

function Scene() {
  return (
    <>
      <Lamborghini />
      <RenderText />
      <directionalLight
        shadow-camera-far={1000}
        shadow-camera-top={1300}
        shadow-camera-left={-500}
        shadow-camera-bottom={-500}
        shadow-camera-right={500}
        castShadow
        position={[0, 500, 0]}
        intensity={0.5}
      />
      <mesh
        scale={4 / 0.015}
        position={[3 / 0.015, -1.161 / 0.015, -1.5 / 0.015]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2.5]}
      >
        <ringGeometry args={[0.9, 1, 4, 1]} />
        <meshStandardMaterial color="white" roughness={0.75} />
      </mesh>
      <mesh
        scale={4 / 0.015}
        position={[-3 / 0.015, -1.161 / 0.015, -1 / 0.015]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2.5]}
      >
        <ringGeometry args={[0.9, 1, 3, 1]} />
        <meshStandardMaterial color="white" roughness={0.75} />
      </mesh>
      <mesh receiveShadow scale={10000} position-y={-76} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry />
        <shadowMaterial opacity={0.5} />
      </mesh>
      {/* We're building a cube-mapped environment declaratively.
        Anything you put in here will be filmed (once) by a cubemap-camera
        and applied to the scenes environment, and optionally background. */}
      <Environment resolution={512}>
        <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, -9]} scale={[10, 1, 1]} />
        <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, -6]} scale={[10, 1, 1]} />
        <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, -3]} scale={[10, 1, 1]} />
        <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, 0]} scale={[10, 1, 1]} />
        <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, 3]} scale={[10, 1, 1]} />
        <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, 6]} scale={[10, 1, 1]} />
        <Lightformer intensity={2} rotation-x={Math.PI / 2} position={[0, 4, 9]} scale={[10, 1, 1]} />
        <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-50, 2, 0]} scale={[100, 2, 1]} />
        <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[50, 2, 0]} scale={[100, 2, 1]} />
        <Lightformer
          form="ring"
          color="red"
          intensity={10}
          scale={2}
          position={[10, 5, 10]}
          onUpdate={(self) => self.lookAt(0, 0, 0)}
        />
      </Environment>
      <Effects />
    </>
  )
}
