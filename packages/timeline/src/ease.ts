import type { ActionUpdate } from './index.js'

export type EaseFunction<T> = (
  ...params: [
    ...Parameters<ActionUpdate<T>>,
    prev: Array<number> | undefined,
    current: Array<number>,
    goal: Array<number>,
    target: Array<number>,
  ]
) => ReturnType<ActionUpdate<T>>

function length(value: Array<number>): number {
  let sumOfSquares = 0
  const count = value.length
  for (let i = 0; i < count; i++) {
    const component = value[i]
    sumOfSquares += component * component
  }
  return Math.sqrt(sumOfSquares)
}
function add(target: Array<number>, v1: Array<number>, v2: Array<number>): void {
  const count = Math.max(target.length, v1.length, v2.length)
  for (let i = 0; i < count; i++) {
    target[i] = v1[i] + v2[i]
  }
}
function sub(target: Array<number>, v1: Array<number>, v2: Array<number>): void {
  const count = Math.max(target.length, v1.length, v2.length)
  for (let i = 0; i < count; i++) {
    target[i] = v1[i] - v2[i]
  }
}
function multiplyScalar(target: Array<number>, value: Array<number>, scalar: number) {
  const count = Math.max(target.length, value.length)
  for (let i = 0; i < count; i++) {
    target[i] = value[i] * scalar
  }
}

function copy(target: Array<number>, source: Array<number>): void {
  const count = source.length
  for (let i = 0; i < count; i++) target[i] = source[i]
}

function addScaled(target: Array<number>, v1: Array<number>, s1: number, v2: Array<number>, s2: number): void {
  const count = Math.max(target.length, v1.length, v2.length)
  for (let i = 0; i < count; i++) target[i] = v1[i] * s1 + v2[i] * s2
}

function distanceTo(v1: Array<number>, v2: Array<number>): number {
  let sumOfSquares = 0
  const count = Math.max(v1.length, v2.length)
  for (let i = 0; i < count; i++) {
    const diff = v1[i] - v2[i]
    sumOfSquares += diff * diff
  }
  return Math.sqrt(sumOfSquares)
}

export function velocity(velocity: number, maxAcceleration?: number): EaseFunction<unknown> {
  // Preallocate working arrays to avoid per-frame allocations
  let offsetVec: Array<number> = []
  let desiredVelocityVec: Array<number> = []
  let currentVelocityVec: Array<number> = []
  let deltaVelocityVec: Array<number> = []
  let stepVec: Array<number> = []

  return (_state, clock, prev, current, goal, target) => {
    // compute the offset between current and goal
    sub(offsetVec, goal, current)
    const offsetLength = length(offsetVec)

    // if already at goal, stop
    if (offsetLength === 0) {
      copy(target, current)
      return false
    }

    // desired velocity vector points toward goal with magnitude "velocity"
    multiplyScalar(desiredVelocityVec, offsetVec, velocity / offsetLength)

    // compute current velocity vector from previous position
    if (prev != null && clock.prevDelta != null) {
      sub(currentVelocityVec, current, prev)
      multiplyScalar(currentVelocityVec, currentVelocityVec, 1 / clock.prevDelta)
    } else {
      // no previous sample; assume zero velocity
      multiplyScalar(currentVelocityVec, current, 0)
    }

    // accelerate towards desired velocity, limiting acceleration magnitude if requested
    if (maxAcceleration != null) {
      sub(deltaVelocityVec, desiredVelocityVec, currentVelocityVec)
      const maxDeltaVelocity = maxAcceleration * clock.delta
      const deltaLen = length(deltaVelocityVec)
      if (deltaLen > 0) {
        const scale = Math.min(1, maxDeltaVelocity / deltaLen)
        multiplyScalar(deltaVelocityVec, deltaVelocityVec, scale)
        add(currentVelocityVec, currentVelocityVec, deltaVelocityVec)
      }
    } else {
      // snap directly to desired velocity when no acceleration cap is provided
      copy(currentVelocityVec, desiredVelocityVec)
    }

    // integrate position: x_next = x + v * dt
    multiplyScalar(stepVec, currentVelocityVec, clock.delta)
    add(target, current, stepVec)

    if (offsetLength <= length(stepVec)) return false
    return true
  }
}

// Time-based easing that moves at a constant rate over a specified duration
export function time(duration: number): EaseFunction<unknown> {
  return (_state, clock, _prev, current, goal, target) => {
    sub(target, goal, current)
    multiplyScalar(target, target, Math.min(1, clock.delta / duration))

    duration -= Math.min(duration, clock.delta)

    add(target, current, target)

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

  // Preallocate working arrays to avoid per-frame allocations
  let displacement: Array<number> = []
  let velocityVec: Array<number> = []
  let tmp: Array<number> = []
  let accelerationVector: Array<number> = []
  let vNext: Array<number> = []

  return (_state, clock, prev, current, goal, target) => {
    // displacement x = current - goal
    sub(displacement, current, goal)

    // calculate velocity into velocityVec = (current - prev) / prevDeltaTime
    if (prev != null && clock.prevDelta != null) {
      sub(tmp, current, prev)
      multiplyScalar(velocityVec, tmp, 1 / clock.prevDelta)
    } else {
      multiplyScalar(velocityVec, current, 0)
    }

    // acceleration a = (-k x - c v) / m
    addScaled(accelerationVector, displacement, -stiffness / mass, velocityVec, -damping / mass)

    // integrate velocity and position (semi-implicit Euler)
    addScaled(vNext, velocityVec, 1, accelerationVector, clock.delta)

    // cap max velocity if provided
    if (config.maxVelocity != null) {
      const vNextLen = length(vNext)
      if (vNextLen > config.maxVelocity) {
        multiplyScalar(vNext, vNext, vNextLen === 0 ? 0 : config.maxVelocity / vNextLen)
      }
    }

    // next position: current + vNext * dt
    addScaled(target, current, 1, vNext, clock.delta)

    const distance = length(displacement)
    const speed = length(velocityVec)

    if (distance < 0.01 && speed < 0.01) {
      copy(target, goal)
      return false
    }
    return true
  }
}

export const springPresets = {
  gentle: { mass: 1, stiffness: 120, daming: 14 },
  wobbly: { mass: 1, stiffness: 180, daming: 12 },
  stiff: { mass: 1, stiffness: 300, daming: 20 },
}
