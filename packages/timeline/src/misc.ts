import { Euler, Matrix4, Object3D, Quaternion, Vector3, type AnimationAction } from 'three'
import { action, parallel, type ReusableTimeline, type ActionUpdate } from './index.js'

export function timePassed(time: number, unit: 'seconds' | 'milliseconds'): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, unit === 'seconds' ? time * 1000 : time))
}

export function mediaFinished(media: HTMLAudioElement | HTMLVideoElement) {
  if (media.ended) {
    return Promise.resolve<unknown>(undefined)
  }
  return new Promise<unknown>((resolve) => media.addEventListener('ended', resolve, { once: true }))
}

export function animationFinished(animation: AnimationAction): Promise<void> {
  return new Promise<void>((resolve) => {
    const listener = ({ action }: { action: AnimationAction }) => {
      if (action != animation) {
        return
      }
      animation.getMixer().removeEventListener('finished', listener)
      resolve()
    }
    animation.getMixer().addEventListener('finished', listener)
  })
}

export function forever() {
  return new Promise(() => {})
}

export async function promiseConcat(promises: Array<Promise<unknown>>): Promise<void> {
  for (const promise of promises) {
    await promise
  }
}

export async function doUntil<T>(promise: Promise<unknown>, timeline: ReusableTimeline<T>) {
  return parallel('race', action({ until: promise }), async function* () {
    while (true) {
      yield* timeline()
    }
  })
}

export async function* doWhile<T>(
  update: (...params: Parameters<ActionUpdate<T>>) => boolean,
  timeline: ReusableTimeline<T>,
) {
  return parallel('race', action({ update }), async function* () {
    while (true) {
      yield* timeline()
    }
  })
}

const vectorHelper = new Vector3()
const scaleHelper = new Vector3()
const quaternionHelper = new Quaternion()
const quaternionHelperInverse = new Quaternion()
const matrixHelper = new Matrix4()
const invertedMatrixHelper = new Matrix4()
const eulerHelper = new Euler()

export type WorldSpaceResults = {
  position: Vector3
  scale: Vector3
  quaternion: Quaternion
  euler: Euler
}

function cacheFunction<T>(object: Object3D, key: string, offset: any, value: T): T {
  if (offset != null) {
    return value
  }
  Object.assign(object, { [key]: value })
  return value
}

export function worldSpace<Type extends keyof WorldSpaceResults>(
  type: Type,
  forObject: Object3D,
  offset?: Array<number>,
): (newValue?: any) => WorldSpaceResults[Type] {
  const key = `cachedGetWorldSpace${type}`
  if (offset == null && key in forObject) {
    return (forObject as any)[key]
  }
  if (type === 'position') {
    const result = new Vector3()
    return cacheFunction(forObject, key, offset, (newValue?: Vector3) => {
      if (newValue != null) {
        // location = parentWorldMatrix-1 * worldPosition
        forObject.position.copy(newValue)
        if (forObject.parent != null) {
          forObject.position.applyMatrix4(matrixHelper.copy(forObject.parent.matrixWorld).invert())
        }
        return newValue as WorldSpaceResults[Type]
      }
      forObject.getWorldPosition(result)
      if (offset != null) {
        result.add(vectorHelper.fromArray(offset))
      }
      return result as WorldSpaceResults[Type]
    })
  }
  if (type === 'quaternion') {
    const result = new Quaternion()
    return cacheFunction(forObject, key, offset, (newValue?: Quaternion) => {
      if (newValue != null) {
        // localQuaternion = inverse(parentWorldQuaternion) * desiredWorldQuaternion
        if (forObject.parent != null) {
          forObject.parent.getWorldQuaternion(quaternionHelperInverse)
        } else {
          quaternionHelperInverse.identity()
        }
        quaternionHelperInverse.invert()
        forObject.quaternion.copy(quaternionHelperInverse.multiply(newValue))
        return newValue as WorldSpaceResults[Type]
      }
      forObject.getWorldQuaternion(result)
      if (offset != null) {
        result.multiply(quaternionHelper.fromArray(offset))
      }
      return result as WorldSpaceResults[Type]
    })
  }
  const result = new Vector3()
  return cacheFunction(forObject, key, offset, (newValue?: Vector3) => {
    if (newValue == null) {
      forObject.getWorldScale(result)
      if (offset != null) {
        result.multiply(vectorHelper.fromArray(offset))
      }
      return result as WorldSpaceResults[Type]
    }

    if (forObject.parent == null) {
      forObject.scale.copy(newValue)
      return newValue as WorldSpaceResults[Type]
    }

    //localMatrix = parentWorldMatrix-1 * worldMatrix
    forObject.updateWorldMatrix(true, false)
    forObject.matrixWorld.decompose(vectorHelper, quaternionHelper, scaleHelper)
    matrixHelper.compose(vectorHelper, quaternionHelper, newValue)
    matrixHelper.premultiply(invertedMatrixHelper.copy(forObject.parent.matrixWorld).invert())
    matrixHelper.decompose(vectorHelper, quaternionHelper, forObject.scale)
    return newValue as WorldSpaceResults[Type]
  })
}

export function property<K extends string>(object: { [Key in K]: number }, key: K) {
  return (newValue?: Vector3 | Quaternion) => {
    if (newValue == null) {
      //read
      return object[key]
    }
    //write
    object[key] = newValue.x
    return newValue.x
  }
}

export function getOffset(
  from: Array<number> | Vector3 | (() => Array<number> | Vector3),
  to: Array<number> | Vector3 | (() => Array<number> | Vector3),
): Array<number> {
  const f = typeof from === 'function' ? (from as any)() : from
  const t = typeof to === 'function' ? (to as any)() : to
  const fx = Array.isArray(f) ? (f[0] ?? 0) : (f as Vector3).x
  const fy = Array.isArray(f) ? (f[1] ?? 0) : (f as Vector3).y
  const fz = Array.isArray(f) ? (f[2] ?? 0) : (f as Vector3).z
  const tx = Array.isArray(t) ? (t[0] ?? 0) : (t as Vector3).x
  const ty = Array.isArray(t) ? (t[1] ?? 0) : (t as Vector3).y
  const tz = Array.isArray(t) ? (t[2] ?? 0) : (t as Vector3).z
  return [fx - tx, fy - ty, fz - tz]
}
