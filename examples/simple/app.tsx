import { PerspectiveCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useTimeline, action, timePassed, property, transition, velocity, worldSpace } from '@react-three/timeline'
import { useRef } from 'react'
import { Mesh, PerspectiveCamera as PerspectiveCameraImpl } from 'three'

export function App() {
  return (
    <Canvas>
      <group position-y={10}>
        <PerspectiveCamera position={[0, 0, 10]} makeDefault />
      </group>
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
      while (true) {
        //transition to look at target1
        yield* action({
          update: [
            transition(
              worldSpace('position', camera),
              worldSpace('position', target1Ref.current!, [0, 0, 10]),
              velocity(10),
            ),
            transition(worldSpace('quaternion', target1Ref.current!), [0, 0, 0, 1], velocity(10)),
          ],
        })
        yield* action({
          update: [transition(property(camera, 'fov'), 40, velocity(80)), () => camera.updateProjectionMatrix()],
        })
        //wait for 2 seconds
        yield* action({ until: timePassed(0.2, 'seconds') })
        //transition to look at target2
        yield* action({
          update: [
            transition(
              worldSpace('position', camera),
              worldSpace('position', target2Ref.current!, [0, 0, 10]),
              velocity(10),
            ),
            transition(
              worldSpace('quaternion', target1Ref.current!),
              worldSpace('quaternion', scaleRef.current!),
              velocity(10),
            ),
          ],
        })
        yield* action({
          update: [transition(property(camera, 'fov'), 90, velocity(80)), () => camera.updateProjectionMatrix()],
        })
        //wait for 2 seconds
        yield* action({ until: timePassed(0.2, 'seconds') })
      }
    },
    [camera],
  )

  return (
    <group position-x={-10} rotation-z={(10 / 180) * Math.PI} scale={0.5}>
      <mesh position-x={-1} ref={target1Ref}>
        <boxGeometry />
      </mesh>
      <mesh position-x={1} ref={target2Ref}>
        <sphereGeometry />
      </mesh>
      <mesh rotation-z={(40 / 180) * Math.PI} scale={3} position-x={4} ref={scaleRef}>
        <boxGeometry />
      </mesh>
    </group>
  )
}
