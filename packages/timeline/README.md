# @pmndrs/timeline

Write composable declarative 3D behaviors like a story.

```tsx

async function* Timeline() {
  while (true) {
    //transition to look at target2
    yield* action({ update: lookAt(camera, target1), ease: spring() })
    //wait for 2 seconds
    yield* action({ until: duration(2, 'seconds') })
    //transition to look at target2
    yield* action({ update: lookAt(camera, target2), ease: spring() })
    //wait for 2 seconds
    yield* action({ until: duration(2, 'seconds') })
  }
}

const update = build(Timeline)
```