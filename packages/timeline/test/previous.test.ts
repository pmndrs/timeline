import { Vector3 } from 'three'
import { describe, it, expect } from 'vitest'
import { getPrevious, setPrevious, type TimelineClock } from '../src/index.js'

describe('previous', () => {
  it('hands a value to the same timeline in the immediately following update only', () => {
    const clock: TimelineClock = { delta: 1 / 60, prevDelta: 1 / 60, frame: 3 }
    const target = {}
    setPrevious(target, 'test', new Vector3(1, 2, 3), clock)
    expect(getPrevious(target, 'test', { ...clock, frame: 4 })).toBeUndefined()
    clock.frame = 4
    expect(getPrevious(target, 'test', clock)).toEqual(new Vector3(1, 2, 3))
    clock.frame = 5
    expect(getPrevious(target, 'test', clock)).toBeUndefined()
  })
})
