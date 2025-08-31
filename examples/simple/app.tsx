import { Environment, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import {
  useTimeline,
  action,
  lookAt,
  offsetDistance,
  offsetRotation,
  velocity,
  spring,
  springPresets,
} from '@react-three/timeline'
import { useRef } from 'react'
import { Mesh, PerspectiveCamera as PerspectiveCameraImpl } from 'three'

export function App() {
  return (
    <Canvas>
      <group position-y={0}>
        <PerspectiveCamera position={[0, 0, 0]} makeDefault />
      </group>
      <Environment preset="apartment" background />
      <Scene />
    </Canvas>
  )
}

function Scene() {
  const camera = useThree((s) => s.camera) as PerspectiveCameraImpl
  const target1Ref = useRef<Mesh>(null)
  const target2Ref = useRef<Mesh>(null)
  const scaleRef = useRef<Mesh>(null)

  useTimeline(
    async function* () {
      yield* action({
        update: [
          offsetRotation(camera, target1Ref.current!, [0, (3 * Math.PI) / 2, 0]),
          offsetDistance(camera, target1Ref.current!, 10),
          lookAt(camera, target1Ref.current!),
        ],
      })
      while (true) {
        for (let i = 0; i < 4; i++) {
          yield* action({
            update: [
              offsetRotation(
                camera,
                target1Ref.current!,
                [0, (i * Math.PI) / 2, 0],
                i % 4 == 3 ? spring({ ...springPresets.stiff, maxVelocity: 5 }) : velocity(5, 2),
              ),
              lookAt(camera, target1Ref.current!),
            ],
          })
        }
      }
    },
    [camera],
  )

  return (
    <group position-x={0} rotation-z={0} scale={0.5}>
      <mesh position-x={-1} ref={target1Ref}>
        <boxGeometry />
        <meshPhysicalMaterial color="red" />
      </mesh>
      <mesh position-x={10} ref={target2Ref}>
        <sphereGeometry />
      </mesh>
      <mesh rotation-z={(40 / 180) * Math.PI} scale={3} position-x={4} ref={scaleRef}>
        <boxGeometry />
        <meshPhysicalMaterial color="green" />
      </mesh>
    </group>
  )
}
