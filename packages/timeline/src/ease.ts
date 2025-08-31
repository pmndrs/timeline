import { MathUtils, Quaternion, Vector3 } from 'three'
import type { ActionClock, ActionUpdate } from './index.js'

export type EaseFunction<T> = (
  ...params: [
    ...Parameters<ActionUpdate<T>>,
    prev: Vector3 | Quaternion | undefined,
    current: Vector3 | Quaternion,
    goal: Vector3 | Quaternion,
    target: Vector3 | Quaternion,
  ]
) => ReturnType<ActionUpdate<T>>

const offsetQuaternion = new Quaternion()
const offsetTangent = new Vector3()
const deltaTangent = new Vector3()
const deltaQuaternion = new Quaternion()
const prevOffsetQuaternion = new Quaternion()

const offsetVector = new Vector3()

export function velocity(velocity: number, maxAcceleration?: number): EaseFunction<unknown> {
  let velocityVector: Vector3 | undefined

  return (_state, clock, prev, current, goal, target) => {
    if (current instanceof Quaternion) {
      offsetQuaternion
        .copy(current)
        .invert()
        .premultiply(goal as Quaternion)
      quaternionToTangentSpace(offsetQuaternion, offsetTangent, clock.delta)

      if (velocityVector == null && prev != null && clock.prevDelta != null) {
        velocityVector = new Vector3()
        prevOffsetQuaternion
          .copy(prev as Quaternion)
          .invert()
          .premultiply(current)
        quaternionToTangentSpace(prevOffsetQuaternion, velocityVector, clock.prevDelta)
        velocityVector.divideScalar(clock.prevDelta)
        console.log('prev velocity', velocityVector.toArray())
      }

      if (velocityVector == null) {
        velocityVector = new Vector3(0, 0, 0)
      }

      let shouldContinue = velocityEaseComputeVelocity(velocity, maxAcceleration, clock, offsetTangent, velocityVector)
      deltaTangent.copy(velocityVector).multiplyScalar(clock.delta)

      tangentSpaceToQuaternion(deltaTangent, deltaQuaternion)
      ;(target as Quaternion).multiplyQuaternions(current, deltaQuaternion)
      return shouldContinue
    }

    offsetVector.subVectors(goal, current)
    if (velocityVector == null && prev != null && clock.prevDelta != null) {
      velocityVector = new Vector3().subVectors(current, prev).divideScalar(clock.prevDelta)
    }

    if (velocityVector == null) {
      velocityVector = new Vector3(0, 0, 0)
    }

    let shouldContinue = velocityEaseComputeVelocity(velocity, maxAcceleration, clock, offsetVector, velocityVector)

    ;(target as Vector3).copy(current).addScaledVector(velocityVector, clock.delta)
    return shouldContinue
  }
}

const accelerationVector = new Vector3()

/**
 * @requires that @param target already contains the current velocity
 */
function velocityEaseComputeVelocity(
  velocity: number,
  maxAcceleration: number | undefined,
  clock: ActionClock,
  currentGoalOffset: Vector3,
  target: Vector3,
): boolean {
  const currentGoalOffsetLength = currentGoalOffset.length()

  if (currentGoalOffsetLength < 1e-8) {
    return false
  }

  //acceleration = (goalVelocity - currentVelocity) / clock.delta
  accelerationVector
    .copy(currentGoalOffset)
    .divideScalar(currentGoalOffsetLength)
    .multiplyScalar(velocity)
    .sub(target)
    .divideScalar(clock.delta)
  const accelerationLength = accelerationVector.length()
  if (maxAcceleration != null && accelerationLength > 1e-8) {
    accelerationVector.divideScalar(accelerationLength).multiplyScalar(Math.min(maxAcceleration, accelerationLength))
  }
  target.addScaledVector(accelerationVector, clock.delta)
  if (target.length() * clock.delta >= currentGoalOffsetLength) {
    return false
  }
  return true
}

// Time-based easing that moves at a constant rate over a specified duration
export function time(duration: number): EaseFunction<unknown> {
  return (_state, clock, _prev, current, goal, target) => {
    //0 means only current and 1 means only goal
    const slerpValue = Math.min(1, clock.delta / duration)
    if (target instanceof Vector3) {
      target
        .set(0, 0, 0)
        .addScaledVector(current as Vector3, 1 - slerpValue)
        .addScaledVector(goal as Vector3, slerpValue)
    } else {
      target.copy(current as Quaternion).slerp(goal as Quaternion, slerpValue)
    }

    duration -= Math.min(duration, clock.delta)

    if (duration <= 0) {
      return false
    }
    return true
  }
}

export function spring(
  config: {
    mass: number
    stiffness: number
    daming: number
    maxVelocity?: number
  } = springPresets.gentle,
): EaseFunction<unknown> {
  const mass = Math.max(config.mass, 1e-9)
  const stiffness = config.stiffness
  const damping = config.daming

  let velocityVector: Vector3 | undefined

  return (_state, clock, prev, current, goal, target) => {
    if (current instanceof Quaternion) {
      offsetQuaternion
        .copy(current)
        .invert()
        .premultiply(goal as Quaternion)
      quaternionToTangentSpace(offsetQuaternion, offsetTangent, clock.delta)

      if (velocityVector == null && prev != null && clock.prevDelta != null) {
        velocityVector = new Vector3()
        prevOffsetQuaternion
          .copy(prev as Quaternion)
          .invert()
          .premultiply(current)
        quaternionToTangentSpace(prevOffsetQuaternion, velocityVector, clock.prevDelta)
        velocityVector.divideScalar(clock.prevDelta)
      }

      if (velocityVector == null) {
        velocityVector = new Vector3(0, 0, 0)
      }

      let shouldContinue = springEaseComputeVelocity(
        mass,
        stiffness,
        damping,
        config.maxVelocity,
        clock,
        offsetTangent,
        velocityVector,
      )

      deltaTangent.copy(velocityVector).multiplyScalar(clock.delta)

      tangentSpaceToQuaternion(deltaTangent, deltaQuaternion)
      ;(target as Quaternion).multiplyQuaternions(current, deltaQuaternion)
      return shouldContinue
    }

    offsetVector.subVectors(goal, current)
    if (velocityVector == null && prev != null && clock.prevDelta != null) {
      velocityVector = new Vector3().subVectors(current, prev).divideScalar(clock.prevDelta)
    }

    if (velocityVector == null) {
      velocityVector = new Vector3(0, 0, 0)
    }

    let shouldContinue = springEaseComputeVelocity(
      mass,
      stiffness,
      damping,
      config.maxVelocity,
      clock,
      offsetVector,
      velocityVector,
    )

    ;(target as Vector3).copy(current).addScaledVector(velocityVector, clock.delta)
    return shouldContinue
  }
}

export const springPresets = {
  gentle: { mass: 1, stiffness: 40, daming: 14 },
  wobbly: { mass: 1, stiffness: 180, daming: 12 },
  stiff: { mass: 1, stiffness: 300, daming: 20 },
}

const springAccelerationVector = new Vector3()

/**
 * @requires that @param target contains the current velocity
 */
function springEaseComputeVelocity(
  mass: number,
  stiffness: number,
  damping: number,
  maxVelocity: number | undefined,
  clock: ActionClock,
  currentGoalOffset: Vector3,
  target: Vector3,
): boolean {
  // a = (k x - c v) / m  where x = goal - current
  springAccelerationVector
    .copy(currentGoalOffset)
    .multiplyScalar(stiffness / mass)
    .addScaledVector(target, -damping / mass)

  // v = v + a * dt (semi-implicit Euler)
  target.addScaledVector(springAccelerationVector, clock.delta)

  // cap max velocity if provided
  if (maxVelocity != null) {
    const vLen = target.length()
    if (vLen > maxVelocity && vLen > 0) {
      target.multiplyScalar(maxVelocity / vLen)
    }
  }

  const distance = currentGoalOffset.length()
  const speed = target.length()
  if (distance < 0.001 && speed < 0.1) {
    // snap to goal to prevent long tails
    target.copy(currentGoalOffset).divideScalar(clock.delta)
    return false
  }
  return true
}

function quaternionToTangentSpace(quaternion: Quaternion, target: Vector3, delta: number): void {
  if (quaternion.w < 0) {
    quaternion.set(-quaternion.x, -quaternion.y, -quaternion.z, -quaternion.w)
  }
  const w = MathUtils.clamp(quaternion.w, -1, 1)
  target.set(quaternion.x, quaternion.y, quaternion.z)
  const s = target.length()
  if (s < 1e-8) {
    //no rotation
    target.set(0, 0, 0)
    return
  }
  const theta = Math.acos(w)
  //nromalize target and multiply by theta (direction = axis, length = angle)
  target.multiplyScalar(theta / s)
  //cut off very small values to prevent numerical drift when converting quaternions from and to tangent space
  if (Math.abs(target.x) < delta * 0.1) {
    target.x = 0
  }
  if (Math.abs(target.y) < delta * 0.1) {
    target.y = 0
  }
  if (Math.abs(target.z) < delta * 0.1) {
    target.z = 0
  }
}

function tangentSpaceToQuaternion(tangent: Vector3, target: Quaternion): void {
  const theta = tangent.length()
  if (theta < 1e-8) {
    target.identity()
    return
  }
  const multiplier = Math.sin(theta) / theta
  target.set(tangent.x * multiplier, tangent.y * multiplier, tangent.z * multiplier, Math.cos(theta))
}
