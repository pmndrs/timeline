import { Euler, Matrix4, Object3D, Quaternion, Vector3, Vector3Tuple } from 'three'
import type { ActionUpdate, EaseFunction } from './index.js'

export function property<K extends string>(object: { [Key in K]: number }, key: K) {
  return (newValue?: Array<number>) => {
    if (newValue == null) {
      //read
      return object[key]
    }
    //write
    object[key] = newValue[0]
    return newValue[0]
  }
}

const vectorHelper = new Vector3()
const scaleHelper = new Vector3()
const quaternionHelper = new Quaternion()
const quaternionHelperInverse = new Quaternion()
const matrixHelper = new Matrix4()
const invertedMatrixHelper = new Matrix4()

export function worldSpace(type: 'position' | 'scale' | 'quaternion', forObject: Object3D, offset?: Array<number>) {
  if (type === 'position') {
    const result = new Vector3()
    return (newValue?: Array<number>) => {
      if (newValue != null) {
        // location = parentWorldMatrix-1 * worldPosition
        forObject.position.fromArray(newValue)
        if (forObject.parent != null) {
          forObject.position.applyMatrix4(matrixHelper.copy(forObject.parent.matrixWorld).invert())
        }
        return newValue
      }
      forObject.getWorldPosition(result)
      if (offset != null) {
        result.add(vectorHelper.fromArray(offset))
      }
      return result
    }
  }
  if (type === 'quaternion') {
    const result = new Quaternion()
    return (newValue?: Array<number>) => {
      if (newValue != null) {
        // localQuaternion = inverse(parentWorldQuaternion) * desiredWorldQuaternion
        const desiredWorldQuaternion = quaternionHelper.fromArray(newValue)
        if (forObject.parent != null) {
          forObject.parent.getWorldQuaternion(quaternionHelperInverse)
        } else {
          quaternionHelperInverse.identity()
        }
        quaternionHelperInverse.invert()
        forObject.quaternion.copy(quaternionHelperInverse.multiply(desiredWorldQuaternion))
        return newValue
      }
      forObject.getWorldQuaternion(result)
      if (offset != null) {
        result.multiply(quaternionHelper.fromArray(offset))
      }
      return result
    }
  }
  const result = new Vector3()
  return (newValue?: Array<number>) => {
    if (newValue == null) {
      forObject.getWorldScale(result)
      if (offset != null) {
        result.multiply(vectorHelper.fromArray(offset))
      }
      return result
    }

    if (forObject.parent == null) {
      forObject.scale.fromArray(newValue)
      return newValue
    }

    //localMatrix = parentWorldMatrix-1 * worldMatrix
    forObject.updateWorldMatrix(true, false)
    forObject.matrixWorld.decompose(vectorHelper, quaternionHelper, scaleHelper)
    scaleHelper.fromArray(newValue)
    matrixHelper.compose(vectorHelper, quaternionHelper, scaleHelper)
    matrixHelper.premultiply(invertedMatrixHelper.copy(forObject.parent.matrixWorld).invert())
    matrixHelper.decompose(vectorHelper, quaternionHelper, forObject.scale)
    return newValue
  }
}

function write(value: Array<number>, into: TransitionFrom | ((newValue?: Array<number>) => void)): void {
  if (typeof into === 'function') {
    into(value)
    return
  }
  if (Array.isArray(into)) {
    for (let i = 0; i < value.length; i++) {
      into[i] = value[i]
    }
    return
  }
  into.fromArray(value as any)
}

function read(value: TransitionTo | (() => TransitionTo), into: Array<number>): void {
  if (typeof value === 'function') {
    read(value(), into)
    return
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      into[i] = value[i]
    }
    return
  }
  if (typeof value === 'number') {
    into[0] = value
    return
  }
  value.toArray(into as Vector3Tuple)
}

export type TransitionFrom = Exclude<TransitionTo, number>
export type TransitionTo = Array<number> | Vector3 | Quaternion | Euler | number

const transitionPrevMap = new Map<any, Array<number>>()

export function transition<T>(
  from: TransitionFrom | ((newValue?: Array<number>) => TransitionFrom | number),
  to: TransitionTo | (() => TransitionTo),
  ease?: EaseFunction<T>,
): ActionUpdate<T> {
  const goal: Array<number> = []
  read(from, goal)
  const current = [...goal]
  let target: Array<number> | undefined
  let prev: Array<number> | undefined = transitionPrevMap.get(from)
  const length = goal.length
  return (state, clock) => {
    read(to, goal)
    read(from, current)
    //apply ease function
    if (ease == null) {
      write(goal, from)
      return false
    }
    target ??= [...goal]
    const shouldContinue = ease(state, clock, prev, current, goal, target)
    //build preview (create and fill with current)
    prev ??= [...current]
    for (let i = 0; i < length; i++) {
      prev[i] = current[i]
    }
    write(target, from)
    if (shouldContinue === false) {
      transitionPrevMap.set(from, prev)
    }
    return shouldContinue
  }
}
