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
  const count = v1.length
  for (let i = 0; i < count; i++) {
    target[i] = v1[i] + v2[i]
  }
}
function sub(target: Array<number>, v1: Array<number>, v2: Array<number>): void {
  const count = v1.length
  for (let i = 0; i < count; i++) {
    target[i] = v1[i] - v2[i]
  }
}
function multiplyScalar(target: Array<number>, value: Array<number>, scalar: number) {
  const count = value.length
  for (let i = 0; i < count; i++) {
    target[i] = value[i] * scalar
  }
}

export function velocity(velocity: number): EaseFunction<unknown> {
  return (_, clock, _prev, current, goal, target) => {
    //compute the offset between current and goal
    sub(target, goal, current)
    //compute length of offset
    const offsetLength = length(target)
    const maxLength = velocity * clock.delta
    let multiplier = Math.min(offsetLength, maxLength) / offsetLength
    if (isNaN(multiplier)) {
      multiplier = 0
    }
    multiplyScalar(target, target, multiplier)
    add(target, target, current)
    if (offsetLength < maxLength) {
      //no need to continue as the goal is reached
      return false
    }
    return true
  }
}

/*
// Time-based easing that moves at a constant rate over a specified duration
export function time(duration: number): EaseFunction

// Spring-based easing and damping
// stops continuing when target distance below delta and speed is below delta
export function spring(config: { mass: number, stiffness: number, daming: number }): EaseFunction

//TODO: provide differnet default spring configs (wobbly, stiff, ...)
*/
