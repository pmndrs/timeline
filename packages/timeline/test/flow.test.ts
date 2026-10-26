import { Vector3 } from 'three'
import { describe, it, expect } from 'vitest'
import { action, property, runTimeline, spring, time, transition, velocity } from '../src/index.js'

describe('cross-action momentum', () => {
  it('carries velocity between consecutive moves', () => {
    const position = new Vector3()
    const update = runTimeline(function* () {
      yield* action({ update: transition(position, [0.2, 0, 0], time(1 / 30)) })
      yield* action({ update: transition(position, [10, 0, 0], velocity(6, 0)) })
    })
    update(undefined, 1 / 30)
    update(undefined, 1 / 60)
    expect(position.x).toBeCloseTo(0.3)
  })

  it.each([1 / 30, 1 / 60, 1 / 15])('carries velocity through a cut lasting %s seconds', (cutDelta) => {
    const position = new Vector3()
    const update = runTimeline(function* () {
      yield* action({ update: transition(position, [0.2, 0, 0], time(1 / 30)) })
      yield* action({ update: transition(position, [10, 20, 0]) })
      yield* action({ update: transition(position, [100, 20, 0], velocity(6, 0)) })
    })
    update(undefined, 1 / 30)
    update(undefined, cutDelta)
    expect(position.toArray()).toEqual([10, 20, 0])
    update(undefined, 1 / 60)
    expect(position.x).toBeCloseTo(10.1)
    expect(position.y).toBe(20)
  })

  it('carries momentum through consecutive numeric cuts into a spring', () => {
    const object = { value: 0 }
    const value = property(object, 'value')
    const update = runTimeline(function* () {
      yield* action({ update: transition(value, 0.2, time(1 / 30)) })
      yield* action({ update: transition(value, 10) })
      yield* action({ update: transition(value, 20) })
      yield* action({ update: transition(value, 21, spring()) })
    })
    update(undefined, 1 / 30)
    update(undefined, 1 / 60)
    update(undefined, 1 / 15)
    update(undefined, 1 / 60)
    const speed = 6 + (40 - 14 * 6) / 60
    expect(object.value).toBeCloseTo(20 + speed / 60)
  })

  it.each(['before', 'after'])('drops momentum when an idle frame occurs %s a cut', (idle) => {
    const position = new Vector3()
    const update = runTimeline(function* () {
      yield* action({ update: transition(position, [0.2, 0, 0], time(1 / 30)) })
      if (idle === 'before') yield* action({ update: () => false })
      yield* action({ update: transition(position, [10, 0, 0]) })
      if (idle === 'after') yield* action({ update: () => false })
      yield* action({ update: transition(position, [100, 0, 0], velocity(6, 0)) })
    })
    for (const delta of [1 / 30, 1 / 120, 1 / 15, 1 / 60]) update(undefined, delta)
    expect(position.x).toBe(10)
  })

  it('starts from rest after a cut without preceding motion', () => {
    const position = new Vector3()
    const update = runTimeline(function* () {
      yield* action({ update: transition(position, [10, 0, 0]) })
      yield* action({ update: transition(position, [100, 0, 0], velocity(6, 0)) })
    })
    update(undefined, 1 / 30)
    update(undefined, 1 / 60)
    expect(position.x).toBe(10)
  })

  it('does not infer velocity from a zero-duration cut', () => {
    const position = new Vector3()
    const update = runTimeline(function* () {
      yield* action({ update: transition(position, [0.2, 0, 0], time(1 / 30)) })
      yield* action({ update: transition(position, [10, 0, 0]) })
      yield* action({ update: transition(position, [100, 0, 0], velocity(6, 0)) })
    })
    update(undefined, 1 / 30)
    update(undefined, 0)
    update(undefined, 1 / 60)
    expect(position.x).toBe(10)
  })
})
