import { describe, it, expect } from 'vitest'
import { createDeferred, step, waitForSetup, waitForCleanup } from './helpers.js'
import { start, action, parallel } from '../src/index.js'

describe('parallel cleanup', () => {
  it("parallel('race') aborts remaining timelines and calls their cleanup", async () => {
    const cleaned: number[] = [0, 0, 0]
    const done = createDeferred<void>()

    const t1 = action({
      init: () => () => {
        cleaned[0]++
      },
      update: () => false, // finishes immediately
    })

    const t2 = action({
      init: () => () => {
        cleaned[1]++
      },
      update: () => {}, // infinite until aborted
    })

    const t3 = action({
      init: () => () => {
        cleaned[2]++
      },
      until: done.promise, // will be aborted by race
    })

    const update = start(parallel('race', t1, t2, t3))
    await waitForSetup()
    step(update, 2)
    await waitForCleanup()
    expect(cleaned).toEqual([1, 1, 1])
  })

  it("parallel('all') waits for all and calls all cleanups", async () => {
    const cleaned: number[] = [0, 0]
    const a = createDeferred<void>()
    const b = createDeferred<void>()

    const t1 = action({
      init: () => () => {
        cleaned[0]++
      },
      until: a.promise,
    })
    const t2 = action({
      init: () => () => {
        cleaned[1]++
      },
      until: b.promise,
    })

    const update = start(parallel('all', t1, t2))
    await waitForSetup()
    step(update, 1)
    a.resolve()
    await waitForCleanup()
    // not done yet, still waiting for b
    expect(cleaned).toEqual([1, 0])
    b.resolve()
    await waitForCleanup()
    expect(cleaned).toEqual([1, 1])
  })
})
