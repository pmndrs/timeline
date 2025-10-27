import { Euler, Object3D, Quaternion, Vector3 } from 'three'
import { type ActionUpdate, worldSpace } from './index.js'
import { getPrevious, setPrevious } from './previous.js'
import { read, write } from './utils.js'
import type { EaseFunction } from './ease.js'

/**
 * action update function for making a src object or position move away/towards the to position to be at the specified distance
 * combined with offsetRotation, this action update describes an exact target position in orbital coordinates
 * @param ease allows to ease the position from the current state to the position with the target distance
 *
 * > [!NOTE]
 * > If `from` and `to` coincide (zero distance), direction is undefined; the action no‑ops and finishes.
 */
export function offsetDistance<T>(
  from: Vector3 | ((newValue?: Vector3) => Vector3) | Object3D,
  to: Vector3 | (() => Vector3) | Object3D,
  distance: number,
  ease?: EaseFunction<T>,
): ActionUpdate<T> {
  if (from instanceof Object3D) {
    from = worldSpace('position', from)
  }
  if (to instanceof Object3D) {
    to = worldSpace('position', to)
  }
  const goal = new Vector3(distance, 0, 0)
  const current = new Vector3()
  let target = new Vector3()
  let prev: Vector3 | undefined | null = null

  const fromPosition = new Vector3()
  const toPosition = new Vector3()
  const offset = new Vector3()
  const scaled = new Vector3()
  const nextPosition = new Vector3()

  return (state, clock) => {
    if (prev === null) {
      prev = getPrevious(from, 'offsetDistance', clock) as Vector3
    }
    read('position', from, fromPosition)
    read('position', to, toPosition)

    // compute current scalar distance
    offset.subVectors(fromPosition, toPosition)
    const currentDistance = offset.length()
    current.set(currentDistance, 0, 0)

    if (ease == null) {
      if (currentDistance === 0) {
        // no direction; cannot place at exact distance; keep current position
        write(fromPosition, from)
        return false
      }
      // new position = to + normalize(from - to) * distance
      scaled.copy(offset).multiplyScalar(distance / currentDistance)
      nextPosition.addVectors(toPosition, scaled)
      write(nextPosition, from)
      return false
    }

    target ??= goal.clone()
    const shouldContinue = ease(state, clock, prev, current, goal, target)

    // update prev with snapshot of current scalar distance
    prev ??= new Vector3()
    prev.copy(current)

    // compute new position at target distance along current direction
    const nextDistance = target.x
    if (currentDistance === 0) {
      // no direction; cannot move
      write(fromPosition, from)
    } else {
      scaled.copy(offset).multiplyScalar(nextDistance / currentDistance)
      nextPosition.addVectors(toPosition, scaled)
      write(nextPosition, from)
    }

    if (shouldContinue === false) {
      setPrevious(from, 'offsetDistance', prev)
    }
    return shouldContinue
  }
}

const XVector = new Vector3(1, 0, 0)
const YVEctor = new Vector3(0, 1, 0)

/**
 * action update function for making a src object or position move to a position with the specified rotation offset
 * combined with offsetDistance, this action update describes an exact target position in orbital coordinates
 * @param ease allows to ease the position from the current state to the position with the target rotation offset
 * @param rotation the offset rotation in world space
 *
 * > [!NOTE]
 * > Applies a world‑space rotation around `to` using a forward vector derived from the world up axis. Pair with `offsetDistance` to define orbital targets.
 */
export function offsetRotation<T>(
  from: Vector3 | ((newValue?: Vector3) => Vector3) | Object3D,
  to: Vector3 | (() => Vector3) | Object3D,
  rotation: Euler | Quaternion | Array<number> | (() => Euler | Quaternion | Array<number>),
  ease?: EaseFunction<T>,
): ActionUpdate<T> {
  if (from instanceof Object3D) {
    from = worldSpace('position', from)
  }
  if (to instanceof Object3D) {
    to = worldSpace('position', to)
  }
  const goal = new Quaternion()
  let current: Quaternion | undefined
  const target = new Quaternion()
  let prev: Quaternion | undefined | null = null

  const fromPosition = new Vector3()
  const toPosition = new Vector3()
  const baseOffset = new Vector3()
  const normalizedBaseOffset = new Vector3()
  const rotatedOffset = new Vector3()
  const nextPosition = new Vector3()

  const forwardVector = new Vector3()
    .crossVectors(Object3D.DEFAULT_UP.dot(XVector) > 0.9 ? YVEctor : XVector, Object3D.DEFAULT_UP)
    .normalize()

  return (state, clock) => {
    // read positions
    read('position', from, fromPosition)
    read('position', to, toPosition)
    baseOffset.subVectors(fromPosition, toPosition)
    const baseOffsetLength = baseOffset.length()

    // derive goal quaternion from provided rotation
    read('rotation', rotation, goal)

    if (prev === null) {
      prev = getPrevious(from, `offsetRotation`, clock) as Quaternion
    }

    if (ease == null) {
      // apply goal rotation directly
      rotatedOffset.copy(forwardVector).multiplyScalar(baseOffsetLength).applyQuaternion(goal)
      nextPosition.addVectors(toPosition, rotatedOffset)
      write(nextPosition, from)
      return false
    }

    if (current == null) {
      //compute current rotation based on the "baseOffset"
      current = new Quaternion()
      current.setFromUnitVectors(forwardVector, normalizedBaseOffset.copy(baseOffset).normalize())
    }

    const shouldContinue = ease(state, clock, prev, current, goal, target)

    // update prev snapshot
    prev ??= new Quaternion()
    prev.copy(current)
    current.copy(target)

    // apply target rotation to the base offset and write new position
    rotatedOffset.copy(forwardVector).multiplyScalar(baseOffsetLength).applyQuaternion(target)

    nextPosition.addVectors(toPosition, rotatedOffset)
    write(nextPosition, from)

    if (shouldContinue === false) {
      setPrevious(from, `offsetRotation`, prev)
    }
    return shouldContinue
  }
}
