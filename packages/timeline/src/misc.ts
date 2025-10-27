import { Euler, Matrix4, Object3D, Quaternion, Vector3, type AnimationAction } from 'three'
import { action } from './action.js'
import { type ReusableTimeline, type TimelineYieldActionUpdate } from './index.js'
import { parallel } from './parallel.js'

/**
 * action until function for executing an action until a certain time has passed
 */
export function timePassed(time: number, unit: 'seconds' | 'milliseconds'): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, unit === 'seconds' ? time * 1000 : time))
}

/**
 * action until function for executing an action until a html media has finished playing
 */
export function mediaFinished(media: HTMLAudioElement | HTMLVideoElement) {
  if (media.ended) {
    return Promise.resolve<unknown>(undefined)
  }
  return new Promise<unknown>((resolve) => media.addEventListener('ended', resolve, { once: true }))
}

/**
 * action until function for executing an action until a animation has finished playing
 */
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

/**
 * action until function for executing an action until forever
 */
export function forever() {
  return new Promise(() => {})
}

/**
 * action until function for concatenating multiple action until functions
 */
export async function promiseConcat(promises: Array<Promise<unknown>>): Promise<void> {
  for (const promise of promises) {
    await promise
  }
}

/**
 * function for generating a timeline that executes the inner timelines until a promise is met
 */
export async function* doUntil<T>(promise: Promise<unknown>, timeline: ReusableTimeline<T>) {
  yield* parallel('race', action({ until: promise }), async function* () {
    while (true) {
      yield* timeline()
    }
  })
}

/**
 * function for generating a timeline that executes the inner function while a update function returns true
 */
export async function* doWhile<T>(
  update: (...params: Parameters<TimelineYieldActionUpdate<T>>) => boolean,
  timeline: ReusableTimeline<T>,
) {
  yield* parallel('race', action({ update }), async function* () {
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

/**
 * helper function for building a write/read function of the position/euler/quaternion/scale for an object in world space
 * useful when combined with other action update functions such as lookAt
 */
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

/**
 * helper function for building a write/read function of any property in an object
 * @param object the object from which to read/write a property
 * @param key the key of the property from which to read/write inside of the object
 */
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
