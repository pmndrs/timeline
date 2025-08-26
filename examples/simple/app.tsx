import { Environment, PerspectiveCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import {
  useTimeline,
  action,
  transition,
  velocity,
  worldSpace,
  lookAt,
  spring,
  springPresets,
} from '@react-three/timeline'
import { useRef } from 'react'
import { Mesh, PerspectiveCamera as PerspectiveCameraImpl } from 'three'

export function App() {
  return (
    <Canvas>
      <group position-y={0}>
        <PerspectiveCamera position={[0, 0, 10]} makeDefault />
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
          transition(worldSpace('position', camera), worldSpace('position', target1Ref.current!, [0, 0, 10])),
          lookAt(
            worldSpace('position', camera),
            worldSpace('quaternion', camera),
            worldSpace('position', target1Ref.current!),
          ),
        ],
      })
      while (true) {
        for (let i = 0; i < 3; i++) {
          //transition to look at target1
          yield* action({
            update: [
              transition(
                worldSpace('position', camera),
                worldSpace('position', target1Ref.current!, [0, 0, 10]),
                velocity(20, 300),
              ),
            ],
          })
          /*yield* action({
          update: [transition(property(camera, 'fov'), 40, velocity(80)), () => camera.updateProjectionMatrix()],
        })
        //wait for 2 seconds
        yield* action({ until: timePassed(0.2, 'seconds') })*/
          //transition to look at target2
          yield* action({
            update: [
              transition(
                worldSpace('position', camera),
                worldSpace('position', target2Ref.current!, [0, 0, 10]),
                velocity(20, 300),
              ),
            ],
          })
          /*
        yield* action({
          update: [transition(property(camera, 'fov'), 90, velocity(80)), () => camera.updateProjectionMatrix()],
        })
        //wait for 2 seconds
        yield* action({ until: timePassed(0.2, 'seconds') })*/
        }
        yield* action({
          update: [
            transition(
              worldSpace('position', camera),
              worldSpace('position', target1Ref.current!, [0, 0, 10]),
              spring({ ...springPresets.gentle, maxVelocity: 20 }),
            ),
          ],
        })
      }
    },
    [camera],
  )

  return (
    <group position-x={0} rotation-z={(10 / 180) * Math.PI} scale={0.5}>
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
