---
name: react-three-timeline
description: Author and debug sequenced or concurrent 3D behavior with @react-three/timeline and the vanilla @pmndrs/timeline core. Use for timeline-driven camera moves, object animation, cutscenes, and state machines in Three.js or React Three Fiber.
---

# Authoring timelines

This skill targets the synchronous-generator API in this repository. Read the installed package's types when working against a published version: older versions used async generators and different lifecycle APIs.

## Execution and lifetime

A timeline is a synchronous `function*` generator. Sequence actions with `yield*`; use ordinary loops and branches to describe behavior. A generator function is reusable; its returned generator is single-use. Call the function again for each new run.

```ts
import { action, runTimeline, spring, timePassed, transition } from '@pmndrs/timeline'
import { Vector3 } from 'three'

const position = new Vector3()
function* intro() {
  yield* action({ update: transition(position, [0, 2, 0], spring()) })
  yield* action({ until: timePassed(1, 'seconds') })
}
const update = runTimeline(intro)
// Call update(state, deltaSeconds) on each simulation frame.
```

`runTimeline(timeline, abortSignal?)` starts the generator immediately up to its first action. Frame work advances inside the returned update function, and errors propagate to its caller. `clock.delta` is the supplied delta, without clamping; `clock.prevDelta` is the previous update's delta; `clock.frame` identifies the update. Choose clamping or substeps in the caller when needed for spring stability. Simulation timing and wall-clock timing can differ.

In React Three Fiber, import from `@react-three/timeline`, which re-exports the core. `useRunTimeline(function* () { ... }, deps)` connects a reusable timeline to `useFrame`; dependency changes cancel and restart it. Pass a generator function or a function returning a generator, not a function returning another generator function. Read refs after mount and handle missing objects. Make setup repeatable under React StrictMode and dependency restarts.

For extracted React timelines, `NonReuseableTimeline<RootState>` can make state typing explicit. The JSX alternative provides `<RunTimeline>`, `<Action>`, `<Parallel>`, `<Sequential>`, `<Graph>`, and related entries; use it when behavior follows component mounting and props. Prefer generators for a sequential script.

## Actions, waits, and cleanup

`action({ init?, update?, until? })` has three independent responsibilities:

- `init()` runs synchronously when the action starts. It may return a synchronous cleanup, called on completion or cancellation. It cannot return a promise.
- `update(state, clock, actionTime, memo)` runs each frame. `actionTime` includes the current delta; `memo` persists for this update function within this action. Return `false` to finish; `true` or no return continues.
- `until` accepts a condition `(state, clock, actionTime) => boolean` or a promise. Conditions are checked before the frame's update, with elapsed time excluding that frame. A satisfied condition passes the unused frame to the next action. Promises are observed after their settlement callback runs, on the next update at the earliest.

An action finishes when either its stopping condition is met or its update returns `false`. `until: forever()` does not override an update returning `false`. With an array of updates, every update runs, but the first boolean result decides whether the action continues. Put the driving motion first and supporting updates afterward.

```ts
yield* action({
  update: [
    transition(camera.position, destination, velocity(6, 30)),
    lookAt(camera, subject),
  ],
})
```

An uneased `lookAt` aims immediately and returns `false`; placing it first would finish this action on its first frame. For a timed continuous follow, wrap updates so they do not return their completion result. For a static hold, finish the move and then yield a separate wait.

Use `timePassed(n, 'seconds' | 'milliseconds')` for simulation-time waits. `forever()` is a condition that always returns false. `mediaFinished(element)` and `animationFinished(action)` return promises for playback completion. `promiseConcat` waits on supplied promises in order; it does not defer starting their operations. Do not pass conditions to it.

Async setup belongs in a separate wait, not an async generator or async `init`:

```ts
function* scene() {
  let model: Object3D | undefined
  yield* action({ until: loadModel().then((loaded) => { model = loaded }) })
  if (model === undefined) throw new Error('Model loader returned no model')
  yield* animateModel(model)
}
```

Cancelling the timeline stops waiting; it does not cancel the underlying network request or remove an external event listener. Tie external resources to cleanup or an abort signal as appropriate. Use generator `try/finally` for resources spanning actions; do not yield in cancellation cleanup. Native `AbortController` is sufficient. The old `scope`, `start`, and `useTimeline` APIs are removed.

## Motion and momentum

- `transition(from, to, ease?)` writes a vector, quaternion, Euler, or numeric accessor toward a goal. No ease means an immediate cut.
- `lookAt(from, target, ease?)` orients toward a point or object. Pass a live object or accessor for moving targets.
- `offsetDistance` and `offsetRotation` move relative to a target. Their ease controls distance or rotation, so it does not directly bound the resulting world-space translation speed.
- `time(seconds)` interpolates over a duration. It does not ease velocity in or out.
- `velocity(speed, maxAcceleration?)` targets a speed and optionally caps acceleration. It can overshoot waypoints; completion does not guarantee exact arrival at the goal.
- `spring(config?)` follows a goal with spring dynamics. Presets are `gentle`, `wobbly`, and `stiff`; configuration accepts mass, stiffness, damping, and optional maximum velocity. Springs can overshoot; damping and speed limits matter for moving targets.

Completed motions can hand their previous value to the next motion on the same target, in the same runner, on the immediately following frame. This preserves momentum for velocity and spring eases. An intervening idle frame clears it. An interrupted action does not automatically publish its current momentum. Preserve accessor identity across actions: keep `const fov = property(camera, 'fov')` rather than constructing a new accessor for each move.

Uneased **vector and numeric transitions** carry incoming velocity across a cut, adjusted for the cut frame's duration. Follow a cut immediately with an eased transition for continued motion; insert a wait that consumes a frame to restart from rest. Rotation cuts do not carry angular velocity. Zero-duration frames provide no usable velocity sample. Avoid a raw position mutation inside an ongoing ease: it bypasses the handoff and can turn the teleport distance into an apparent velocity spike.

For continuous travel, chain velocity moves and finish with a spring when a stop is intended. This preserves motion, but it is not a guarantee of mathematically continuous velocity or exact waypoint arrival. Measure speed and direction at joins. A settling spring between every waypoint creates deliberate stop-and-go motion.

With `property(object, key)`, pass a numeric goal as a number, not a one-element array. Numeric properties use the x component internally. Update the camera projection matrix after changing FOV. Number arrays are interpreted by their length and the source type; use an Euler or quaternion when expressing rotation explicitly. `worldSpace` accessors help when parent transforms make local coordinates inappropriate.

## Composition and state

`parallel('all', ...timelines)` waits for every branch. `parallel('race', ...timelines)` cancels siblings when a branch finishes. Branches step in argument order; a winning branch prevents later branches from stepping that frame. Place the terminating condition first when it should prevent a driver update on the finishing frame. Branches may be reusable functions or generators; false branches are skipped.

```ts
yield* parallel(
  'race',
  scene,
  action({ update: (_state, clock) => { system.update(clock.delta) } }),
)
```

`doUntil(conditionOrPromise, reusableTimeline)` repeats a timeline until the condition is met. `doWhile(condition, reusableTimeline)` repeats while it holds. A loop whose actions all finish without consuming frames can spin indefinitely; the runner throws after too many skipped actions in one update.

For state-driven behavior, use `graph(initialState, states)`. A state contains a reusable `timeline` and optional `transitionTo`. Edges use `whenUpdate` conditions or `whenPromise` factories; `{ finally: 'Next' }` transitions after completion. A state timeline may also return its next state's name. Runtime control lives in `GraphTimeline`: `attach`, `unattach`, `setState`, and `getState`.

`QueueTimeline` serializes reusable timelines through `attach(timeline, index?)` and `run()`, with `clear`, `length`, and `waitUntilNotEmpty()`. A manager can drain it with `yield* queue.run()`, then wait with `yield* action({ until: queue.waitUntilNotEmpty() })`. `switch_` selects behavior from conditions that may change each frame. Check signatures in the source rather than guessing class names or methods.

## Choreography and ownership

Choose a behavior model from the task: a sequence for a scripted scene, a graph for branching states, concurrent branches for independent activity, and one continuous driver for a large procedural ensemble.

Give each property one writer at a time. If a character controller already owns facing or root motion, let scene beats change a small mutable intent object; one driver translates that intent into controller updates. The same applies to a camera controlled by a separate loop. Mixing direct mutations with the driver creates snapping, sliding, or periodic resets.

For a cinematic, sketch the beats and what must be visible, define the control properties, compose the timeline, then verify the result over time. Keep these choices explicit:

- A hard cut, a moving join, and a settled hold have different meanings. Choose deliberately rather than placing a spring on every boundary.
- A branch under `parallel('all')` can extend a beat beyond its intended duration. Use `race` when dialogue or another condition should govern the beat, and stop audio in cleanup if the beat ends early.
- Pace a timed movement through its update lifetime. Combining a finite move with `until: timePassed(...)` still ends when either finishes; it does not force the move to occupy the whole beat.
- Block camera paths around geometry and keep the intended subject in frame and unoccluded. Verify face orientation and actor spacing in conversation shots, not just camera targets.
- Stagger births, attention shifts, and shared animation changes when synchrony is not intended. A shared later transition can resynchronize an initially staggered crowd.
- Give procedural agents an arrival behavior and a visible consequence for contact. Verify translation agrees with locomotion clips, and tick animation independently of steering when an actor remains visible.
- Treat a change of scene as its own transition; fades can cover relocating the camera, cast, and set together.

## Verification

Test simulation behavior by stepping `runTimeline` synchronously with explicit deltas. No timers or event-loop waits are needed unless the scenario actually involves promises. Assert positions, completion, cleanup, and boundary velocities; logging alone does not make a regression test. Include uneven and zero deltas for momentum behavior, and an idle gap to check that old history expires.

For visual behavior, inspect the running scene as well as its types. Sample state across the whole beat: camera position and speed, subject visibility and occlusion, actor facing and clip selection, and contact outcomes. Measure the intended relationship—an overflight needs to cross above the subject, not merely keep it in view. A screenshot verifies only one instant; use a recording or multiple samples for motion. If available, the `vitexec` skill provides browser inspection and recording workflows.

Use simulation time for simulation assertions and wall time for actual playback or performance observations. Keep instrumentation light enough not to introduce the stutter being measured. Make setup repeatable so a restart does not compound transforms or resource allocations.
