import type { TimelineClock } from './index.js'
import type { Quaternion, Vector3 } from 'three'

type Entry = { clock: TimelineClock; frame: number; value: Vector3 | Quaternion }

const previousMap = new Map<string, WeakMap<object, Entry>>()

/**
 * stores the last value of a finished action update so the next action on the same target can continue its motion
 */
export function setPrevious(identifier: object, type: string, value: Vector3 | Quaternion, clock: TimelineClock) {
  let map = previousMap.get(type)
  if (map == null) {
    previousMap.set(type, (map = new WeakMap()))
  }
  map.set(identifier, { clock, frame: clock.frame, value: value.clone() })
}

/**
 * @returns the value stored by an action of the same timeline that finished in the immediately preceding update
 */
export function getPrevious(identifier: object, type: string, clock: TimelineClock): Vector3 | Quaternion | undefined {
  const entry = previousMap.get(type)?.get(identifier)
  if (entry == null || entry.clock != clock || entry.frame != clock.frame - 1) {
    return undefined
  }
  return entry.value.clone()
}
