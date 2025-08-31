import { Quaternion, Vector3 } from 'three'
import type { ActionClock } from './index.js'

const previousMap = new Map<string, Map<any, { timelineTime: number; value: Vector3 | Quaternion }>>()

export function setPrevious(identifier: any, type: string, clock: ActionClock, value: Vector3 | Quaternion) {
  let map = previousMap.get(type)
  if (map == null) {
    previousMap.set(type, (map = new Map()))
  }
  map.set(identifier, { timelineTime: clock.timelineTime, value: value.clone() })
}

export function getPrevious(identifier: any, type: string, clock: ActionClock): Vector3 | Quaternion | undefined {
  const entry = previousMap.get(type)?.get(identifier)
  if (entry == null) {
    return undefined
  }
  if (Math.abs(clock.timelineTime - clock.delta - entry.timelineTime) > 0.001) {
    return undefined
  }
  return entry.value.clone()
}
