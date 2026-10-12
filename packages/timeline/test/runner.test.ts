import { describe, it, expect } from 'vitest'
import { oneTick } from './helpers.js'
import { runTimeline, action, SynchronousAbortController } from '../src/index.js'

describe('runTimeline', () => {
  it('advances one-tick actions once per update in a synchronous loop', () => {
    const log: Array<string> = []
    const update = runTimeline(function* () {
      yield* oneTick(log, 'A')
      yield* oneTick(log, 'B')
      yield* oneTick(log, 'C')
    })
    for (let i = 0; i < 6; i++) {
      update({}, 1 / 60)
    }
    expect(log).toEqual(['A', 'B', 'C'])
  })

  it('runs the code after a finished action within the same update', () => {
    const log: Array<string> = []
    const update = runTimeline(function* () {
      yield* oneTick(log, 'A')
      log.push('after A')
      yield* oneTick(log, 'B')
    })
    update({}, 1 / 60)
    expect(log).toEqual(['A', 'after A'])
  })

  it('passes the frame on when an action is already done at the start of the frame', () => {
    const log: Array<string> = []
    let ready = false
    const update = runTimeline(function* () {
      yield* action({ until: () => ready })
      yield* oneTick(log, 'B')
    })
    update({}, 1 / 60)
    expect(log).toEqual([])
    ready = true
    update({}, 1 / 60)
    expect(log).toEqual(['B'])
  })

  it('throws when actions keep finishing without using the frame', () => {
    const update = runTimeline(function* () {
      while (true) {
        yield* action({ until: () => true })
      }
    })
    expect(() => update({}, 1 / 60)).toThrow(/without using it/)
  })

  it('propagates errors out of update and runs cleanups', () => {
    let cleaned = 0
    const update = runTimeline(
      action({
        init: () => () => cleaned++,
        update: () => {
          throw new Error('boom')
        },
      }),
    )
    expect(() => update({}, 1 / 60)).toThrow('boom')
    expect(cleaned).toBe(1)
  })

  it('surfaces errors from an update at the yield so the timeline can catch them', () => {
    const log: Array<string> = []
    const update = runTimeline(function* () {
      try {
        yield* action({
          update: () => {
            throw new Error('boom')
          },
        })
      } catch (error) {
        log.push(error instanceof Error ? error.message : 'unexpected error type')
      }
      yield* oneTick(log, 'B')
    })
    update({}, 1 / 60)
    update({}, 1 / 60)
    expect(log).toEqual(['boom', 'B'])
  })

  it('runs cleanups synchronously when the abort signal aborts', () => {
    let cleaned = 0
    const controller = new SynchronousAbortController()
    const update = runTimeline(action({ init: () => () => cleaned++ }), controller.signal)
    update({}, 1 / 60)
    controller.abort()
    expect(cleaned).toBe(1)
    update({}, 1 / 60)
    expect(cleaned).toBe(1)
  })

  it('cancels from inside an update', () => {
    const log: Array<string> = []
    const controller = new SynchronousAbortController()
    const update = runTimeline(function* () {
      try {
        yield* action({ update: () => controller.abort() })
      } finally {
        log.push('finally')
      }
      yield* oneTick(log, 'B')
    }, controller.signal)
    update({}, 1 / 60)
    update({}, 1 / 60)
    expect(log).toEqual(['finally'])
  })

  it('cancels from inside the timeline once it reaches its next action', () => {
    const log: Array<string> = []
    const controller = new SynchronousAbortController()
    const update = runTimeline(function* () {
      try {
        yield* oneTick(log, 'A')
        controller.abort()
        log.push('after abort')
        yield* oneTick(log, 'B')
      } finally {
        log.push('finally')
      }
    }, controller.signal)
    update({}, 1 / 60)
    update({}, 1 / 60)
    expect(log).toEqual(['A', 'after abort', 'finally'])
  })
})
