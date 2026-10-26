import { Euler, Matrix4, Object3D, Quaternion, Vector3, type AnimationAction } from 'three'
import { action, type Until, type UntilCondition } from './action.js'
import { parallel } from './parallel.js'
import type { NonReuseableTimeline, ReusableTimeline } from './index.js'

export const TimelineFallbacks = {
  *Error(): NonReuseableTimeline {
    throw new Error('timeline not found')
  },
  *Skip(): NonReuseableTimeline {},
  *Idle(): NonReuseableTimeline {
    yield* action({ until: forever() })
  },
}

/**
 * action until condition for executing an action until a certain amount of simulation time (the sum of frame deltas) has passed
 */
export function timePassed(time: number, unit: 'seconds' | 'milliseconds'): UntilCondition<unknown> {
  const seconds = unit === 'seconds' ? time : time / 1000
  //tolerate floating point error from summing deltas (6 * 1/60 is slightly below 0.1)
  return (_state, _clock, actionTime) => actionTime >= seconds - 1e-9
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
 * action until condition for executing an action until forever
 */
export function forever(): UntilCondition<unknown> {
  return () => false
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
 * function for generating a timeline that repeats the inner timeline until the `until` condition or promise is met
 */
export function* doUntil<T>(until: Until<T>, timeline: ReusableTimeline<T>): NonReuseableTimeline<T> {
  yield* parallel('race', action({ until }), function* () {
    while (true) {
      yield* timeline()
    }
  })
}

/**
 * function for generating a timeline that repeats the inner timeline while the condition holds
 * the condition is checked at the start of every frame; once it fails, the frame passes on to what follows
 */
export function* doWhile<T>(condition: UntilCondition<T>, timeline: ReusableTimeline<T>): NonReuseableTimeline<T> {
  yield* parallel('race', action({ until: (...params) => !condition(...params) }), function* () {
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
 * reuse the same accessor across actions to preserve momentum; transition goals for numeric properties are plain numbers
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
