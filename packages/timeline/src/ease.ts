import { MathUtils, Quaternion, Vector3 } from 'three'
import type { TimelineClock } from './index.js'

export type EaseFunction<T> = (
  state: T,
  clock: TimelineClock,
  prev: Vector3 | Quaternion | undefined,
  current: Vector3 | Quaternion,
  goal: Vector3 | Quaternion,
  target: Vector3 | Quaternion,
  memo: Record<string, any>,
) => undefined | void | boolean

const offsetQuaternion = new Quaternion()
const offsetTangent = new Vector3()
const deltaTangent = new Vector3()
const deltaQuaternion = new Quaternion()
const prevOffsetQuaternion = new Quaternion()

const offsetVector = new Vector3()

/**
 * action update ease function for easing values according to the target velocity
 * @param maxAcceleration (optional) can be used to limit the change in velocity
 */
export function velocity(velocity: number, maxAcceleration?: number): EaseFunction<unknown> {
  return (_state, clock, prev, current, goal, target, memo: { velocityVector?: Vector3 }) => {
    if (current instanceof Quaternion) {
      offsetQuaternion
        .copy(current)
        .invert()
        .premultiply(goal as Quaternion)
      quaternionToTangentSpace(offsetQuaternion, offsetTangent, clock.delta)

      if (memo.velocityVector == null && prev != null && clock.prevDelta != null) {
        memo.velocityVector = new Vector3()
        prevOffsetQuaternion
          .copy(prev as Quaternion)
          .invert()
          .premultiply(current)
        quaternionToTangentSpace(prevOffsetQuaternion, memo.velocityVector, clock.prevDelta)
        memo.velocityVector.divideScalar(clock.prevDelta)
      }

      if (memo.velocityVector == null) {
        memo.velocityVector = new Vector3(0, 0, 0)
      }

      let shouldContinue = velocityEaseComputeVelocity(
        velocity,
        maxAcceleration,
        clock,
        offsetTangent,
        memo.velocityVector,
      )
      deltaTangent.copy(memo.velocityVector).multiplyScalar(clock.delta)

      tangentSpaceToQuaternion(deltaTangent, deltaQuaternion)
      ;(target as Quaternion).multiplyQuaternions(deltaQuaternion, current)
      return shouldContinue
    }

    offsetVector.subVectors(goal, current)
    if (memo.velocityVector == null && prev != null && clock.prevDelta != null) {
      memo.velocityVector = new Vector3().subVectors(current, prev).divideScalar(clock.prevDelta)
    }

    if (memo.velocityVector == null) {
      memo.velocityVector = new Vector3(0, 0, 0)
    }

    let shouldContinue = velocityEaseComputeVelocity(
      velocity,
      maxAcceleration,
      clock,
      offsetVector,
      memo.velocityVector,
    )

    ;(target as Vector3).copy(current).addScaledVector(memo.velocityVector, clock.delta)
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
  clock: TimelineClock,
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
  if (currentGoalOffsetLength <= velocity * clock.delta) {
    return false
  }
  return true
}

/**
 * action update easing function for a linear ease based on the provided duration in seconds
 */
export function time(duration: number): EaseFunction<unknown> {
  return (_state, clock, _prev, current, goal, target, memo: { duration?: number }) => {
    memo.duration ??= duration
    //0 means only current and 1 means only goal
    const slerpValue = Math.min(1, clock.delta / memo.duration)
    if (target instanceof Vector3) {
      target
        .set(0, 0, 0)
        .addScaledVector(current as Vector3, 1 - slerpValue)
        .addScaledVector(goal as Vector3, slerpValue)
    } else {
      target.copy(current as Quaternion).slerp(goal as Quaternion, slerpValue)
    }

    memo.duration -= Math.min(memo.duration, clock.delta)

    if (memo.duration <= 0) {
      return false
    }
    return true
  }
}

/**
 * action update ease function easing values according to spring physics
 * @param config allows to configure the physical properties of the spring (available presets are `springPresets.gentle`, `springPresets.wobbly`, `springPresets.stiff`) - default is `springPresets.gentle`
 */
export function spring(
  config: {
    mass: number
    stiffness: number
    damping: number
    maxVelocity?: number
  } = springPresets.gentle,
): EaseFunction<unknown> {
  const mass = Math.max(config.mass, 1e-9)
  const stiffness = config.stiffness
  const damping = config.damping

  return (_state, clock, prev, current, goal, target, memo: { velocityVector?: Vector3 }) => {
    if (current instanceof Quaternion) {
      offsetQuaternion
        .copy(current)
        .invert()
        .premultiply(goal as Quaternion)
      quaternionToTangentSpace(offsetQuaternion, offsetTangent, clock.delta)

      if (memo.velocityVector == null && prev != null && clock.prevDelta != null) {
        memo.velocityVector = new Vector3()
        prevOffsetQuaternion
          .copy(prev as Quaternion)
          .invert()
          .premultiply(current)
        quaternionToTangentSpace(prevOffsetQuaternion, memo.velocityVector, clock.prevDelta)
        memo.velocityVector.divideScalar(clock.prevDelta)
      }

      if (memo.velocityVector == null) {
        memo.velocityVector = new Vector3(0, 0, 0)
      }

      let shouldContinue = springEaseComputeVelocity(
        mass,
        stiffness,
        damping,
        config.maxVelocity,
        clock,
        offsetTangent,
        memo.velocityVector,
      )

      deltaTangent.copy(memo.velocityVector).multiplyScalar(clock.delta)

      tangentSpaceToQuaternion(deltaTangent, deltaQuaternion)
      ;(target as Quaternion).multiplyQuaternions(deltaQuaternion, current)
      return shouldContinue
    }

    offsetVector.subVectors(goal, current)
    if (memo.velocityVector == null && prev != null && clock.prevDelta != null) {
      memo.velocityVector = new Vector3().subVectors(current, prev).divideScalar(clock.prevDelta)
    }

    if (memo.velocityVector == null) {
      memo.velocityVector = new Vector3(0, 0, 0)
    }

    let shouldContinue = springEaseComputeVelocity(
      mass,
      stiffness,
      damping,
      config.maxVelocity,
      clock,
      offsetVector,
      memo.velocityVector,
    )

    ;(target as Vector3).copy(current).addScaledVector(memo.velocityVector, clock.delta)
    return shouldContinue
  }
}

export const springPresets = {
  gentle: { mass: 1, stiffness: 40, damping: 14 },
  wobbly: { mass: 1, stiffness: 180, damping: 12 },
  stiff: { mass: 1, stiffness: 300, damping: 20 },
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
  clock: TimelineClock,
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
