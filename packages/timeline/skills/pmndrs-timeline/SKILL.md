---
name: pmndrs-timeline
description: Compose and debug 3D behavior with @pmndrs/timeline. Use for sequences, concurrent motion, cutscenes, and state-driven behavior in a Three.js application or through the re-exports in @react-three/timeline.
---

# Compose behavior as a timeline

Write a sequence as a synchronous generator with `yield*`, ordinary loops, and branches. Extract reusable sub-stories as generator functions and create a fresh run each time. Choose a graph when behavior branches between states, a queue when incoming work must stay serialized, and concurrent branches when activities have independent lifetimes.

## Move, then hold

Let the motion end its own action, then express a held pose as a separate action. A timer beside a finite movement is an alternative stopping condition, not a way to extend the movement's lifetime.

```ts
import { action, runTimeline, spring, timePassed, transition } from '@pmndrs/timeline'
import { Vector3 } from 'three'

const position = new Vector3()
function* entrance() {
  yield* action({ update: transition(position, [0, 2, 0], spring()) })
  yield* action({ until: timePassed(1, 'seconds') })
}

const controller = new AbortController()
const update = runTimeline(entrance, controller.signal)
// In the application's frame loop:
update(undefined, 1 / 60)
// When this behavior's owner is disposed:
controller.abort()
```

Keep simulation timing separate from external events. Use timeline waits to pace animation, and promise waits for actual loading, input, or playback completion. An audio clip's nominal duration is not evidence that playback has ended when the simulation is paused or time-scaled.

## Coordinate motion without competing writers

Put a driving movement and its supporting aim in one action. The driving movement belongs first so a completed aim does not end the whole move early.

```ts
import { action, lookAt, transition, velocity } from '@pmndrs/timeline'
import type { Object3D, PerspectiveCamera, Vector3 } from 'three'

function* travel(camera: PerspectiveCamera, subject: Object3D, destination: Vector3) {
  yield* action({
    update: [transition(camera.position, destination, velocity(6, 30)), lookAt(camera, subject)],
  })
}
```

Choose the ease from the intended join: velocity moves for continuing travel, a spring for settling, and a timed interpolation when arrival timing matters more than natural acceleration. A spring at every waypoint creates repeated stops. An immediate cut followed by continued movement is a different composition from a cut followed by a held pose; express the hold explicitly and measure speed at the boundary.

Keep accessors stable across chained actions, and let transitions perform cuts instead of mutating a value inside an active ease. Both choices preserve the relationship between consecutive motions. Use world-space accessors when the subject and camera have different parents, rather than mixing coordinate spaces in one movement.

Give each animated property one writer at a time. If another system owns a character or camera every frame, let scene beats animate a small intent object; one driver translates that intent into system updates. Direct writes from both the driver and a beat create resets or sliding.

## Choose which branch owns the ending

Use `parallel('all', ...)` when every activity must finish. Use a race when one activity defines the lifetime of the rest, such as a scene with a continuous driver. Put the governing branch first when it should prevent the driver from receiving the finishing frame.

```ts
import { action, parallel, timePassed } from '@pmndrs/timeline'

function* timedDriver(step: (delta: number) => void) {
  yield* parallel(
    'race',
    action({ until: timePassed(2, 'seconds') }),
    action({
      update: (_state, clock) => {
        step(clock.delta)
      },
    }),
  )
}
```

Read a branch's result from the parallel instead of setting a flag inside the branch. A race returns what its ending branch returned and never a cancelled branch's value; `all` returns `false` when any branch returned `false`, and `true` otherwise, including for branches that return nothing.

```ts
import { action, parallel, timePassed, type NonReuseableTimeline } from '@pmndrs/timeline'

function* approach(walk: () => NonReuseableTimeline<unknown, boolean>) {
  const arrived = yield* parallel('race', walk, function* () {
    yield* action({ until: timePassed(5, 'seconds') })
    return false
  })
  if (!arrived) {
    yield* action({ until: timePassed(1, 'seconds') })
  }
}
```

The race's type is the union of its branches' results, plus `undefined` when it may have no branch to run (boolean entries or a spread array). An explicit state type argument, as in `parallel<State>('race', ...)`, stops that inference and types the result `unknown`; let the branches carry the state type instead.

A settling movement can silently extend a dialogue beat under `all`. Use a race if the dialogue should govern, and bind playback resources to cleanup so a cancelled beat cannot leak sound into the next one. A driver intended to fill the whole beat should not accidentally forward another function's completion result.

For state-driven actors, put the actor's graph beside the scene sequence rather than turning every cinematic beat into a state. For procedural ensembles, use one continuous driver over actor intents, and stagger changes when unison is not intended. Give arrival an explicit next behavior so actors do not simply pile up and stop.

## Wait without losing ownership

Keep loading outside initialization: yield a wait for the result, then use it in the following action. Tie cancellable external work to the timeline's lifetime; ending a wait alone does not stop that work.

```ts
import { action, spring, transition } from '@pmndrs/timeline'
import type { Vector3 } from 'three'

function* moveToLoadedGoal(position: Vector3, load: (signal: AbortSignal) => Promise<Vector3>) {
  const controller = new AbortController()
  try {
    let goal: Vector3 | undefined
    yield* action({
      until: load(controller.signal).then((value) => {
        goal = value
      }),
    })
    if (goal === undefined) throw new Error('Loader returned no goal')
    yield* action({ update: transition(position, goal, spring()) })
  } finally {
    controller.abort()
  }
}
```

## Verify the intended behavior

Step a timeline with explicit deltas to check simulation outcomes; event-loop waits are only needed for scenarios involving promises. Assert completion, cleanup, and motion across boundaries. Use uneven deltas and an idle gap when investigating momentum, rather than relying only on a constant-rate speed log.

For visual work, inspect the whole beat. Check the relationship the audience must see: a flyover must cross above its subject, not merely keep it visible. Sample position, speed, facing, and occlusion across motion; a screenshot only verifies one instant. Keep paths clear of geometry and ensure visible contact has a corresponding outcome.
