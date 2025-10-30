import { Environment, Text } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import {
  lookAt,
  RunTimeline,
  Loop,
  Sequential,
  SequentialEntry,
  Action,
  spring,
  springPresets,
} from '@react-three/timeline'
import { useControls } from 'leva'
import { useState } from 'react'
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
  const [redPill, setRedPill] = useState<Mesh | undefined>(undefined)
  const [greenPill, setGreenPill] = useState<Mesh | undefined>(undefined)
  const [bluePill, setBluePill] = useState<Mesh | undefined>(undefined)

  const { blue, green, red } = useControls({ red: true, green: true, blue: true })

  return (
    <>
      <RunTimeline>
        <Loop>
          <Sequential>
            {redPill && red && (
              <SequentialEntry index={0}>
                <Action update={lookAt(camera, redPill, spring(springPresets.stiff))} />
              </SequentialEntry>
            )}
            {greenPill && green && (
              <SequentialEntry index={1}>
                <Action update={lookAt(camera, greenPill, spring(springPresets.stiff))} />
              </SequentialEntry>
            )}
            {bluePill && blue && (
              <SequentialEntry index={2}>
                <Action update={lookAt(camera, bluePill, spring(springPresets.stiff))} />
              </SequentialEntry>
            )}
          </Sequential>
        </Loop>
      </RunTimeline>

      <Text position-y={0.6} scale={0.3}>
        Remember: all I'm offering is the truth. Nothing more.
      </Text>
      {red && (
        <mesh
          position-y={-1}
          position-x={-2}
          rotation-y={(-30 / 180) * Math.PI}
          scale={0.2}
          scale-z={0.4}
          ref={setRedPill}
        >
          <sphereGeometry />
          <meshPhysicalMaterial emissive="red" emissiveIntensity={0.5} color="red" />
        </mesh>
      )}
      {blue && (
        <mesh
          position-y={2}
          position-x={0}
          rotation-y={(20 / 180) * Math.PI}
          scale={0.2}
          scale-z={0.4}
          ref={setBluePill}
        >
          <sphereGeometry />
          <meshPhysicalMaterial emissive="blue" emissiveIntensity={5} color="blue" />
        </mesh>
      )}
      {green && (
        <mesh
          position-y={-1}
          position-x={2}
          rotation-y={(20 / 180) * Math.PI}
          scale={0.2}
          scale-z={0.4}
          ref={setGreenPill}
        >
          <sphereGeometry />
          <meshPhysicalMaterial emissive="green" emissiveIntensity={5} color="green" />
        </mesh>
      )}
    </>
  )
}
