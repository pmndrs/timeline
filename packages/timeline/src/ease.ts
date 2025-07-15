/*import { EaseFunction } from './helpers'

export function maxSpeed(maxSpeed: number): EaseFunction {
  return (clock, distance) => {
    const speed = Math.min(maxSpeed, distance / clock.delta)
    return Math.min(distance, speed * clock.delta)
  }
}

// Time-based easing that moves at a constant rate over a specified duration
export function time(duration: number): EaseFunction {
  return (clock, distance) => {
    const progress = Math.min(clock.time / duration, 1)
    return distance * progress
  }
}

// Spring-based easing with damping and natural oscillation
export function spring(stiffness: number = 1000, damping: number = 10): EaseFunction {
  let velocity = 0
  return (clock, distance) => {
    // Spring force calculation (Hooke's law with damping)
    const springForce = stiffness * distance
    const dampingForce = -damping * velocity
    const totalForce = springForce + dampingForce

    // Update velocity and position using Euler integration
    velocity += totalForce * clock.delta
    const movement = velocity * clock.delta

    return Math.min(distance, Math.max(0, movement))
  }
}
*/
