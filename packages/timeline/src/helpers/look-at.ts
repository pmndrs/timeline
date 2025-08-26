import { Matrix4, Object3D, Quaternion, Vector3 } from 'three'
import { ActionUpdate, EaseFunction } from '../index.js'

export type LookAtFromPosition = Vector3 | Array<number>
export type LookAtFromQuaternion = Quaternion | Array<number>
export type LookAtTo = Vector3 | Array<number>

const matrixHelper = new Matrix4()
const quaternionHelper = new Quaternion()
const vectorHelper = new Vector3()
const targetVector = new Vector3()

const lookAtPrevMap = new Map<any, Array<number>>()

function writeOrientation(
  value: Array<number>,
  into: LookAtFromQuaternion | ((newValue?: Array<number>) => void),
): void {
  if (typeof into === 'function') {
    into(value)
    return
  }
  if (Array.isArray(into)) {
    // expect quaternion array [x, y, z, w]
    for (let i = 0; i < 4; i++) into[i] = value[i]
    return
  }
  // Quaternion
  ;(into as Quaternion).fromArray(value)
}

function readOrientation(from: LookAtFromQuaternion | (() => LookAtFromQuaternion), into: Array<number>): void {
  let value: LookAtFromQuaternion
  if (typeof from === 'function') {
    value = from()
  } else {
    value = from
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < 4; i++) into[i] = value[i]
    return
  }
  ;(value as Quaternion).toArray(into)
}

function readPosition(to: LookAtTo | LookAtFromPosition | (() => LookAtTo | LookAtFromPosition), into: Vector3): void {
  const value = typeof to === 'function' ? to() : to
  if (Array.isArray(value)) {
    into.fromArray(value)
    return
  }
  into.copy(value)
}

export function lookAt<T>(
  fromPosition: LookAtFromPosition | (() => LookAtFromPosition),
  fromQuaternion: LookAtFromQuaternion | ((newValue?: Array<number>) => LookAtFromQuaternion),
  toPosition: LookAtTo | (() => LookAtTo),
  ease?: EaseFunction<T>,
): ActionUpdate<T> {
  const goal: Array<number> = [0, 0, 0, 1]
  const current: Array<number> = [0, 0, 0, 1]
  let target: Array<number> | undefined
  let prev: Array<number> | undefined = lookAtPrevMap.get(fromQuaternion)
  return (state, clock) => {
    // read current orientation as quaternion
    readOrientation(fromQuaternion, current)
    // compute desired orientation quaternion such that -Z looks towards target direction
    readPosition(fromPosition, vectorHelper)
    readPosition(toPosition, targetVector)
    if (vectorHelper.distanceToSquared(targetVector) === 0) {
      // no direction change; keep current as goal
      for (let i = 0; i < 4; i++) goal[i] = current[i]
    } else {
      matrixHelper.lookAt(vectorHelper, targetVector, Object3D.DEFAULT_UP)
      quaternionHelper.setFromRotationMatrix(matrixHelper)
      quaternionHelper.toArray(goal)
    }

    if (ease == null) {
      writeOrientation(goal, fromQuaternion)
      return false
    }

    target ??= [...goal]
    const shouldContinue = ease(state, clock, prev, current, goal, target)

    // update prev with current snapshot
    prev ??= [...current]
    for (let i = 0; i < 4; i++) prev[i] = current[i]

    writeOrientation(target, fromQuaternion)
    if (shouldContinue === false) {
      lookAtPrevMap.set(fromQuaternion, prev)
    }
    return shouldContinue
  }
}
