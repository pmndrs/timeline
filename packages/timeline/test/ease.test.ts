import { Vector3 } from 'three'
import { describe, it, expect } from 'vitest'
import { spring, velocity, type TimelineClock } from '../src/index.js'

describe('eases after a frame without time', () => {
  it.each([
    ['spring', spring()],
    ['velocity', velocity(1)],
  ])('%s does not infer a velocity from prevDelta 0', (_name, ease) => {
    const clock: TimelineClock = { delta: 1 / 60, prevDelta: 0, frame: 1 }
    const target = new Vector3()
    ease({}, clock, new Vector3(0, 0, 0), new Vector3(0.5, 0, 0), new Vector3(1, 0, 0), target, {})
    expect(Number.isFinite(target.x)).toBe(true)
  })
})
