import { describe, it, expect } from 'vitest'
import { step, waitForSetup, waitForCleanup } from './helpers.js'
import { runTimeline, action } from '../src/index.js'

describe('start cleanup with external abort', () => {
  it('aborting outer signal triggers action cleanup', async () => {
    let cleaned = 0
    const timeline = action({
      init: () => () => {
        cleaned++
      },
      update: () => {
        // run forever until external abort
      },
    })
    const abortCtrl = new AbortController()
    const update = runTimeline(timeline, abortCtrl.signal)
    await waitForSetup()
    step(update, 3)
    abortCtrl.abort()
    await waitForCleanup()
    expect(cleaned).toBe(1)
  })
})
