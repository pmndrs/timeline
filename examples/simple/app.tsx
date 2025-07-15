import { Canvas, useThree } from '@react-three/fiber'
import { useTimeline, action, duration, parallel, forever } from '@react-three/timeline'
import { useRef } from 'react'
import { Mesh } from 'three'

export function App() {
  return (
    <Canvas>
      <Scene />
    </Canvas>
  )
}

function Scene() {
  const camera = useThree((s) => s.camera)
  const target1 = useRef<Mesh>(null)
  const target2 = useRef<Mesh>(null)

  useTimeline(async function* () {
    while (true) {
      console.log('conting till 10')
      let i = 0
      yield* parallel(
        'race',
        action({
          update: () => {
            console.log(i)
            return i++ < 10
          },
        }),
        action({ until: forever() }),
      )
      console.log('waiting 1 second')
      yield* action({ until: duration(1, 'seconds') })
    }
  }, [])

  return (
    <>
      <mesh position-x={-1} ref={target1}>
        <boxGeometry />
      </mesh>
      <mesh position-x={1} ref={target2}>
        <sphereGeometry />
      </mesh>
    </>
  )
}
