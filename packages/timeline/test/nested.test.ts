import { describe, it, expect } from 'vitest'
import { createDeferred, step, waitForSetup, waitForCleanup } from './helpers.js'
import { runTimeline, action, parallel } from '../src/index.js'

describe('nested cleanups', () => {
  it('nested parallel with actions triggers all cleanups exactly once', async () => {
    const calls: Record<string, number> = {}
    const mark = (k: string) => () => {
      calls[k] = (calls[k] ?? 0) + 1
    }

    const innerDone = createDeferred<void>()

    const innerA = action({ init: () => mark('innerA'), update: () => false })
    const innerB = action({ init: () => mark('innerB'), until: innerDone.promise })

    const outer = parallel(
      'race',
      // inner parallel finishes immediately because innerA returns false
      parallel('all', innerA, innerB),
      // fast-finishing branch to end the race
      action({ init: () => mark('outerLong'), update: () => false }),
    )

    const update = runTimeline(outer)
    await waitForSetup()
    step(update, 2)
    await waitForCleanup()

    expect(calls.innerA).toBe(1)
    expect(calls.innerB).toBe(1)
    expect(calls.outerLong).toBe(1)
  })
})
