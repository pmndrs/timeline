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
const prevOffsetTangent = new Vector3()

const offsetVector = new Vector3()
const prevOffsetVector = new Vector3()
const deltaVector = new Vector3()

export function velocity(velocity: number, maxAcceleration?: number): EaseFunction<unknown> {
  return (_state, clock, prev, current, goal, target) => {
    if (current instanceof Quaternion) {
      offsetQuaternion
        .copy(current)
        .invert()
        .premultiply(goal as Quaternion)
      quaternionToTangentSpace(offsetQuaternion, offsetTangent)

      let prevCurrentOffset: Vector3 | undefined
      if (prev != null && clock.prevDelta != null) {
        prevOffsetQuaternion
          .copy(prev as Quaternion)
          .invert()
          .premultiply(current)
        quaternionToTangentSpace(prevOffsetQuaternion, prevOffsetTangent)
        prevCurrentOffset = prevOffsetTangent
      }

      let shouldContinue = velocityEaseComputeDelta(
        velocity,
        maxAcceleration,
        clock,
        offsetTangent,
        prevCurrentOffset,
        deltaTangent,
      )

      tangentSpaceToQuaternion(deltaTangent, deltaQuaternion)
      ;(target as Quaternion).multiplyQuaternions(current, deltaQuaternion)
      return shouldContinue
    }

    offsetVector.subVectors(goal, current)
    let prevCurrentOffset: Vector3 | undefined
    if (prev != null && clock.prevDelta != null) {
      prevOffsetVector.subVectors(current, prev)
      prevCurrentOffset = prevOffsetVector
    }

    let shouldContinue = velocityEaseComputeDelta(
      velocity,
      maxAcceleration,
      clock,
      offsetVector,
      prevCurrentOffset,
      deltaVector,
    )

    ;(target as Vector3).addVectors(current, deltaVector)
    return shouldContinue
  }
}

const velocityVector = new Vector3()
const accelerationVector = new Vector3()

function velocityEaseComputeDelta(
  velocity: number,
  maxAcceleration: number | undefined,
  clock: ActionClock,
  currentGoalOffset: Vector3,
  prevCurrentOffset: Vector3 | undefined,
  target: Vector3,
): boolean {
  const currentGoalOffsetLength = currentGoalOffset.length()
  if (prevCurrentOffset != null && clock.prevDelta != null && prevCurrentOffset.length() > 1e-8) {
    velocityVector.copy(prevCurrentOffset).divideScalar(clock.prevDelta)
  } else {
    velocityVector.set(0, 0, 0)
  }

  if (currentGoalOffsetLength < 1e-8) {
    target.copy(velocityVector).multiplyScalar(clock.delta)
    return false
  }

  //acceleration = (goalVelocity - currentVelocity) / clock.delta
  accelerationVector
    .copy(currentGoalOffset)
    .divideScalar(currentGoalOffsetLength)
    .multiplyScalar(velocity)
    .sub(velocityVector)
    .divideScalar(clock.delta)
  const accelerationLength = accelerationVector.length()
  if (maxAcceleration != null && accelerationLength > 1e-8) {
    accelerationVector.divideScalar(accelerationLength).multiplyScalar(Math.min(maxAcceleration, accelerationLength))
  }
  velocityVector.addScaledVector(accelerationVector, clock.delta)
  target.copy(velocityVector).multiplyScalar(clock.delta)
  if (target.length() >= currentGoalOffsetLength) {
    //prevents overshooting
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

  return (_state, clock, prev, current, goal, target) => {
    if (current instanceof Quaternion) {
      offsetQuaternion
        .copy(current)
        .invert()
        .premultiply(goal as Quaternion)
      quaternionToTangentSpace(offsetQuaternion, offsetTangent)

      let prevCurrentOffset: Vector3 | undefined
      if (prev != null && clock.prevDelta != null) {
        prevOffsetQuaternion
          .copy(prev as Quaternion)
          .invert()
          .premultiply(current)
        quaternionToTangentSpace(prevOffsetQuaternion, prevOffsetTangent)
        prevCurrentOffset = prevOffsetTangent
      }

      let shouldContinue = springEaseComputeDelta(
        mass,
        stiffness,
        damping,
        config.maxVelocity,
        clock,
        offsetTangent,
        prevCurrentOffset,
        deltaTangent,
      )

      tangentSpaceToQuaternion(deltaTangent, deltaQuaternion)
      ;(target as Quaternion).multiplyQuaternions(current, deltaQuaternion)
      return shouldContinue
    }

    offsetVector.subVectors(goal, current)
    let prevCurrentOffset: Vector3 | undefined
    if (prev != null && clock.prevDelta != null) {
      prevOffsetVector.subVectors(current, prev)
      prevCurrentOffset = prevOffsetVector
    }

    let shouldContinue = springEaseComputeDelta(
      mass,
      stiffness,
      damping,
      config.maxVelocity,
      clock,
      offsetVector,
      prevCurrentOffset,
      deltaVector,
    )

    ;(target as Vector3).addVectors(current, deltaVector)
    return shouldContinue
  }
}

export const springPresets = {
  gentle: { mass: 1, stiffness: 10, daming: 14 },
  wobbly: { mass: 1, stiffness: 180, daming: 12 },
  stiff: { mass: 1, stiffness: 300, daming: 20 },
}

const springVelocityVector = new Vector3()
const springAccelerationVector = new Vector3()

function springEaseComputeDelta(
  mass: number,
  stiffness: number,
  damping: number,
  maxVelocity: number | undefined,
  clock: ActionClock,
  currentGoalOffset: Vector3,
  prevCurrentOffset: Vector3 | undefined,
  target: Vector3,
): boolean {
  if (prevCurrentOffset != null && clock.prevDelta != null && prevCurrentOffset.length() > 1e-8) {
    springVelocityVector.copy(prevCurrentOffset).divideScalar(clock.prevDelta)
  } else {
    springVelocityVector.set(0, 0, 0)
  }

  // a = (k x - c v) / m  where x = goal - current
  springAccelerationVector
    .copy(currentGoalOffset)
    .multiplyScalar(stiffness / mass)
    .addScaledVector(springVelocityVector, -damping / mass)

  // v = v + a * dt (semi-implicit Euler)
  springVelocityVector.addScaledVector(springAccelerationVector, clock.delta)

  // cap max velocity if provided
  if (maxVelocity != null) {
    const vLen = springVelocityVector.length()
    if (vLen > maxVelocity && vLen > 0) {
      springVelocityVector.multiplyScalar(maxVelocity / vLen)
    }
  }

  target.copy(springVelocityVector).multiplyScalar(clock.delta)

  const distance = currentGoalOffset.length()
  const speed = springVelocityVector.length()
  if (distance < 0.01 && speed < 0.1) {
    // snap to goal to prevent long tails
    target.copy(currentGoalOffset)
    return false
  }
  return true
}

function quaternionToTangentSpace(quaternion: Quaternion, target: Vector3): void {
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
