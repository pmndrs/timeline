# @react-three/timeline

Write composable declarative 3D behaviors like a story.

```tsx
const camera = useThree((s) => s.camera)
const target1 = useRef<Mesh>(null)
const target2 = useRef<Mesh>(null)

useTimeline(async function* () {
  while (true) {
    //transition to look at target1
    yield* action({ update: spring(lookAt(camera, target1.current!)) })
    //wait for 2 seconds
    yield* action({ until: duration(2, 'seconds') })
    //transition to look at target2
    yield* action({ update: spring(lookAt(camera, target2.current!)) })
    //wait for 2 seconds
    yield* action({ until: duration(2, 'seconds') })
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
```

## Roadmap before Release

[ ] yield* cleanup(() => ...)
[ ] lookAt, rotateArround, moveTo, ...  
[ ] ease configuration  
[ ] target distance configuration (allowing to move towards a target with a certain distance)  
[ ] queue with optional priority sorting and cancelation (configure what happens whith the current timeline when canceled)
