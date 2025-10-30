import { Quaternion, Vector3 } from 'three'
import type { TimelineClock } from './index.js'

const previousMap = new Map<string, Map<any, { globalTime: number; value: Vector3 | Quaternion }>>()

export function setPrevious(identifier: any, type: string, value: Vector3 | Quaternion) {
  let map = previousMap.get(type)
  if (map == null) {
    previousMap.set(type, (map = new Map()))
  }
  map.set(identifier, { globalTime: performance.now(), value: value.clone() })
}

export function getPrevious(identifier: any, type: string, clock: TimelineClock): Vector3 | Quaternion | undefined {
  const entry = previousMap.get(type)?.get(identifier)
  if (entry == null) {
    return undefined
  }
  if (Math.abs(1 - (performance.now() - entry.globalTime) / 1000 / clock.delta) > 0.5) {
    return undefined
  }
  return entry.value.clone()
}
