import { Euler, Quaternion, Vector3 } from 'three'
import { getPrevious, setPrevious } from './previous.js'
import { read, write } from './utils.js'
import type { ActionUpdate, EaseFunction } from './index.js'

export type TransitionFrom = Exclude<TransitionTo, number | Array<number>>
export type TransitionTo = Vector3 | Quaternion | Euler | number | Array<number>

/**
 * action update function for making a src object, position, rotation, scale, number change towards the to value
 * @param ease allows to ease the value from the current value to the target value
 * Without an ease, vector and numeric cuts carry the preceding frame's velocity into the next action.
 * An intervening idle frame clears that momentum; rotation cuts do not carry angular velocity.
 * @example ```tsx
 * transition(property(camera, fov), 90, spring())
 * ```
 *
 * > [!NOTE]
 * > When passing rotation as a number[3], Euler order used is YXZ. For numeric properties via `property(...)`, the x‑component is used.
 */
export function transition<T>(
  from: TransitionFrom | ((newValue?: Vector3 | Quaternion) => TransitionFrom | number),
  to: TransitionTo | (() => TransitionTo),
  ease?: EaseFunction<T>,
): ActionUpdate<T> {
  const goal = read('position', from)
  return (
    state,
    clock,
    _,
    memo: {
      prev?: Quaternion | Vector3
      current?: Quaternion | Vector3
      target?: Quaternion | Vector3
      easeMemo?: Record<string, any>
    },
  ) => {
    if (memo.prev == null) {
      memo.prev = getPrevious(from, 'transition', clock)
    }
    read('position', to, goal)
    memo.current = read('position', from, memo.current)
    //apply ease function
    if (ease == null) {
      if (
        memo.prev instanceof Vector3 &&
        memo.current instanceof Vector3 &&
        goal instanceof Vector3 &&
        clock.prevDelta > 0
      ) {
        // Encode the incoming velocity over this cut's delta, which the next action uses as prevDelta.
        memo.prev
          .sub(memo.current)
          .multiplyScalar(clock.delta / clock.prevDelta)
          .add(goal)
        setPrevious(from, 'transition', memo.prev, clock)
      }
      write(goal, from)
      return false
    }
    memo.target ??= goal.clone()
    const shouldContinue = ease(state, clock, memo.prev, memo.current, goal, memo.target, (memo.easeMemo ??= {}))
    //build preview (create and fill with current)
    memo.prev ??= memo.current.clone()
    memo.prev.copy(memo.current as any)
    write(memo.target, from)
    if (shouldContinue === false) {
      setPrevious(from, 'transition', memo.prev, clock)
    }
    return shouldContinue
  }
}
