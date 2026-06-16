import { describe, it, expect } from 'vitest'
import { step, waitForCleanup, waitForSetup } from './helpers.js'
import {
  runTimeline,
  action,
  parallel,
  timePassed,
  SynchronousAbortController,
  SynchronousAbortSignal,
} from '../src/index.js'

describe('aborting a running timeline', () => {
  it('does not throw when aborting a running nested parallel("race") timeline', async () => {
    const errors: unknown[] = []
    const onError = (error: unknown) => errors.push(error)
    process.on('uncaughtException', onError)
    process.on('unhandledRejection', onError)
    try {
      const controller = new SynchronousAbortController()
      const update = runTimeline(async function* () {
        yield* parallel(
          'race',
          async function* () {
            yield* action({ until: timePassed(100, 'seconds') })
          },
          async function* () {
            yield* action({ until: timePassed(200, 'seconds') })
          },
        )
      }, controller.signal)
      await waitForSetup()
      step(update, 1)

      controller.abort()
      await waitForCleanup()

      expect(errors).toEqual([])
    } finally {
      process.off('uncaughtException', onError)
      process.off('unhandledRejection', onError)
    }
  })
})

describe('SynchronousAbortSignal.any', () => {
  it('adopts the reason of whichever signal aborts', () => {
    const a = new SynchronousAbortController()
    const b = new SynchronousAbortController()
    const combined = SynchronousAbortSignal.any([a.signal, b.signal])

    b.abort('stop-b')

    expect(combined.aborted).toBe(true)
    expect(combined.reason).toBe('stop-b')
  })

  it('propagates through chained combinators', () => {
    const external = new SynchronousAbortController()
    const internal = new SynchronousAbortController()
    const first = SynchronousAbortSignal.any([internal.signal, external.signal])
    const second = SynchronousAbortSignal.any([first, new SynchronousAbortController().signal])

    external.abort('teardown')

    expect(first.aborted).toBe(true)
    expect(second.aborted).toBe(true)
    expect(second.reason).toBe('teardown')
  })
})
