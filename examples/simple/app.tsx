import { Environment, Text } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useTimeline, action, lookAt, spring } from '@react-three/timeline'
import { useRef } from 'react'
import { Mesh } from 'three'

export function App() {
  return (
    <Canvas>
      <EffectComposer>
        <Bloom luminanceThreshold={0} luminanceSmoothing={0.9} height={300} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
      <Environment
        backgroundIntensity={0.1}
        backgroundRotation={[0, (90 / 180) * Math.PI, 0]}
        preset="studio"
        background
        blur={0.1}
      />
      <Scene />
    </Canvas>
  )
}

function Scene() {
  const camera = useThree((s) => s.camera)
  const redPill = useRef<Mesh>(null)
  const bluePill = useRef<Mesh>(null)

  useTimeline(async function* () {
    while (true) {
      //transition to look at target1
      yield* action({ update: lookAt(camera, redPill.current!, spring()) })
      //transition to look at target2
      yield* action({ update: lookAt(camera, bluePill.current!, spring()) })
    }
  }, [])

  return (
    <>
      <Text position-y={1} scale={0.3}>
        Remember: all I'm offering is the truth. Nothing more.
      </Text>
      <mesh position-y={-1} position-x={-2} rotation-y={(-30 / 180) * Math.PI} scale={0.2} scale-z={0.4} ref={redPill}>
        <sphereGeometry />
        <meshPhysicalMaterial emissive="red" emissiveIntensity={0.5} color="red" />
      </mesh>
      <mesh position-y={-1} position-x={2} rotation-y={(20 / 180) * Math.PI} scale={0.2} scale-z={0.4} ref={bluePill}>
        <sphereGeometry />
        <meshPhysicalMaterial emissive="blue" emissiveIntensity={5} color="blue" />
      </mesh>
    </>
  )
}
