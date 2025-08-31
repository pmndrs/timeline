import { Euler, Quaternion, Vector3 } from 'three'
import { getPrevious, setPrevious } from './previous.js'
import { read, write } from './utils.js'
import type { ActionUpdate, EaseFunction } from './index.js'

export type TransitionFrom = Exclude<TransitionTo, number | Array<number>>
export type TransitionTo = Vector3 | Quaternion | Euler | number | Array<number>

export function transition<T>(
  from: TransitionFrom | ((newValue?: Vector3 | Quaternion) => TransitionFrom | number),
  to: TransitionTo | (() => TransitionTo),
  ease?: EaseFunction<T>,
): ActionUpdate<T> {
  const goal = read('position', from)
  let current: Vector3 | Quaternion | undefined
  let target: Vector3 | Quaternion | undefined
  let prev: Vector3 | Quaternion | undefined | null = null
  return (state, clock) => {
    if (prev === null) {
      prev = getPrevious(from, 'transition', clock)
    }
    read('position', to, goal)
    current = read('position', from, current)
    //apply ease function
    if (ease == null) {
      write(goal, from)
      return false
    }
    target ??= goal.clone()
    const shouldContinue = ease(state, clock, prev, current, goal, target)
    //build preview (create and fill with current)
    prev ??= current.clone()
    prev.copy(current as any)
    write(target, from)
    if (shouldContinue === false) {
      setPrevious(from, 'transition', clock, prev)
    }
    return shouldContinue
  }
}
