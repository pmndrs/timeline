---
name: react-three-timeline
description: Integrate @react-three/timeline into React Three Fiber scenes. Use to choose generator or JSX composition, connect behavior to component lifetimes, and handle reactive restarts without competing animation owners.
---

# Timelines in React scenes

Use this package to bind a timeline to a scene component's lifetime. Choose a generator for a readable sequence of events; choose JSX when React state determines which behavior entries exist. Both compose the same underlying actions.

For motion, waits, cancellation, and concurrent composition, use the `pmndrs-timeline` skill shipped with the installed `@pmndrs/timeline` dependency. The core functions are also available through this package's exports. Prefer that installed skill for version-matched guidance; the [timeline documentation](https://pmndrs.github.io/timeline/getting-started/1-what-is-a-timeline) supplies broader tutorials.

## Let a component own a sequence

Pass a reusable generator function to the hook. Choose dependencies to describe when the whole sequence should restart, not every value it happens to read.

```tsx
import { useThree } from '@react-three/fiber'
import { action, spring, transition, useRunTimeline } from '@react-three/timeline'
import type { Vector3 } from 'three'

function CameraMove({ destination }: { destination: Vector3 }) {
  const camera = useThree((state) => state.camera)

  useRunTimeline(
    function* () {
      yield* action({ update: transition(camera.position, destination, spring()) })
    },
    [camera, destination],
  )

  return null
}
```

Replacing `destination` intentionally restarts this move. For continuously changing intent, keep a stable mutable target or accessor that the running behavior reads. Avoid recreating targets on every render unless a restart is intended. For a long sequence that waits for assets, put readiness inside a timeline wait instead of using a readiness flag to replay the sequence from the top.

Read scene refs when the timeline runs and handle missing objects before constructing their actions. If a ref is expected to become available later, wait for it rather than treating an absent object as a completed animation. Make setup and cleanup repeatable: a restart should not compound transforms or retain resources from the preceding run. For React's lifecycle details, consult its [effect guidance](https://react.dev/reference/react/useEffect).

## Compose entries from React state

Use an enclosing runner and explicit sequence entries when steps belong to the component tree. Generate a fresh wait for each action start rather than sharing one settled promise across repeated runs.

```tsx
import { useThree } from '@react-three/fiber'
import { Action, RunTimeline, Sequential, SequentialEntry, spring, timePassed, transition } from '@react-three/timeline'
import type { Vector3 } from 'three'

function CameraArrival({ destination }: { destination: Vector3 }) {
  const camera = useThree((state) => state.camera)
  return (
    <RunTimeline>
      <Sequential>
        <SequentialEntry index={0}>
          <Action update={transition(camera.position, destination, spring())} />
        </SequentialEntry>
        <SequentialEntry index={1}>
          <Action until={() => timePassed(1, 'seconds')} />
        </SequentialEntry>
      </Sequential>
    </RunTimeline>
  )
}
```

Use action dependencies when a prop change should reattach that action. Updating props for a future run and restarting active work are different intentions; choose explicitly. Similarly, use a React key to request a fresh behavior lifetime, not as a substitute for a live motion target.

Keep concurrent behaviors on different properties or route them through one shared intent model. A camera timeline and another frame callback writing the same transform will compete even if each looks correct alone. Prefer composing related movement and aim together under one timeline owner.

## Check lifecycle and rendering together

Verify mounting, dependency changes, and unmounting as well as the visible motion. A sequence that looks correct on first mount can still replay unexpectedly or leave audio and event listeners active after cancellation. Distinguish repeated setup from duplicate per-frame updates when investigating development-mode behavior.

For camera work, inspect a span of rendered frames and the underlying state: whether the intended subject stays visible, whether joins preserve the intended speed, and whether a restart repositions the camera unexpectedly. Use the core skill's deterministic stepping patterns to isolate composition from React rendering. For scene and frame-loop concepts beyond this package, use the [React Three Fiber documentation](https://r3f.docs.pmnd.rs/).
