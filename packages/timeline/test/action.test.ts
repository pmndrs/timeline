import { describe, it, expect } from 'vitest'
import { step, waitForSetup, waitForCleanup } from './helpers.js'
import { start, action } from '../src/index.js'

describe('action cleanup', () => {
  it('calls cleanup when update returns false', async () => {
    let cleaned = 0
    const timeline = action({
      init: () => () => {
        cleaned++
      },
      update: () => false,
    })
    const update = start(timeline)
    await waitForSetup()
    step(update) // one frame triggers update -> false
    await waitForCleanup()
    expect(cleaned).toBe(1)
  })

  it('calls cleanup when until resolves', async () => {
    let cleaned = 0
    const until = Promise.resolve()
    const timeline = action({
      init: () => () => {
        cleaned++
      },
      until,
    })
    const update = start(timeline)
    await waitForSetup()
    step(update, 1)
    await waitForCleanup()
    expect(cleaned).toBe(1)
  })

  it('registers cleanup against global abort if provided via get-global-abort-signal', async () => {
    let cleaned = 0
    const ctrl = new AbortController()
    const timeline = action({
      init: () => () => {
        cleaned++
      },
      update: () => {
        // keep running until external abort
      },
    })
    const update = start(timeline, ctrl.signal)
    await waitForSetup()
    step(update, 2)
    ctrl.abort()
    await waitForCleanup()
    expect(cleaned).toBe(1)
  })
})
