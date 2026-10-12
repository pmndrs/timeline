import { describe, it, expect, vi } from 'vitest'
import { deferred, nextMacrotask, oneTick } from './helpers.js'
import { runTimeline, action, parallel, timePassed } from '../src/index.js'

describe('action', () => {
  it('calls cleanup when update returns false', () => {
    let cleaned = 0
    const update = runTimeline(action({ init: () => () => cleaned++, update: () => false }))
    update({}, 1 / 60)
    expect(cleaned).toBe(1)
  })

  it('passes the accumulated action time to update', () => {
    const times: Array<number> = []
    const update = runTimeline(action({ update: (_state, _clock, time) => times.push(time) < 3 }))
    for (let i = 0; i < 5; i++) {
      update({}, 0.5)
    }
    expect(times).toEqual([0.5, 1, 1.5])
  })

  it('waits for timePassed in simulation time, not wall clock time', () => {
    const log: Array<string> = []
    const update = runTimeline(function* () {
      yield* action({ until: timePassed(1, 'seconds'), update: () => void log.push('wait') })
      yield* oneTick(log, 'next')
    })
    for (let i = 0; i < 5; i++) {
      update({}, 0.25)
    }
    //4 frames of 0.25s wait, the 5th frame passes on to the next action
    expect(log).toEqual(['wait', 'wait', 'wait', 'wait', 'next'])
  })

  it('tolerates floating point error when summing deltas', () => {
    const log: Array<string> = []
    const update = runTimeline(function* () {
      yield* action({ until: timePassed(0.1, 'seconds') })
      yield* oneTick(log, 'next')
    })
    //6 * 1/60 sums to 0.09999999999999999
    for (let i = 0; i < 6; i++) {
      update({}, 1 / 60)
    }
    expect(log).toEqual([])
    update({}, 1 / 60)
    expect(log).toEqual(['next'])
  })

  it('accepts timePassed in milliseconds', () => {
    let done = false
    const update = runTimeline(function* () {
      yield* action({ until: timePassed(500, 'milliseconds') })
      done = true
    })
    update({}, 0.25)
    update({}, 0.25)
    expect(done).toBe(false)
    update({}, 0.25)
    expect(done).toBe(true)
  })

  it('observes a resolved until promise on the next update', async () => {
    const { promise, resolve } = deferred()
    let done = false
    const update = runTimeline(function* () {
      yield* action({ until: promise })
      done = true
    })
    update({}, 1 / 60)
    resolve()
    await promise
    expect(done).toBe(false)
    update({}, 1 / 60)
    expect(done).toBe(true)
  })

  it('throws a rejected until promise out of the next update', async () => {
    const promise = Promise.reject(new Error('rejected'))
    const update = runTimeline(action({ until: promise }))
    await promise.catch(() => {})
    expect(() => update({}, 1 / 60)).toThrow('rejected')
  })

  it('runs a synchronous init immediately', () => {
    const log: Array<string> = []
    const update = runTimeline(action({ init: () => void log.push('init'), update: () => void log.push('update') }))
    expect(log).toEqual(['init'])
    update({}, 1 / 60)
    expect(log).toEqual(['init', 'update'])
  })

  it('delays updates until an async init resolved', async () => {
    const log: Array<string> = []
    const { promise, resolve } = deferred()
    const update = runTimeline(
      action({
        init: () => promise.then(() => () => void log.push('cleanup')),
        update: () => {
          log.push('update')
          return false
        },
      }),
    )
    update({}, 1 / 60)
    expect(log).toEqual([])
    resolve()
    await nextMacrotask()
    update({}, 1 / 60)
    expect(log).toEqual(['update', 'cleanup'])
  })
})

describe('action cancelled before its async init resolved', () => {
  it('runs the cleanup once the init resolves', async () => {
    let cleaned = 0
    const { promise, resolve } = deferred()
    const update = runTimeline(
      parallel(
        'race',
        action({ init: () => promise.then(() => () => void cleaned++) }),
        action({ update: () => false }),
      ),
    )
    update({}, 1 / 60)
    expect(cleaned).toBe(0)
    resolve()
    await nextMacrotask()
    expect(cleaned).toBe(1)
  })

  it('reports an async init rejection that nothing waits for anymore', async () => {
    const errors: Array<unknown> = []
    const spy = vi.spyOn(console, 'error').mockImplementation((error) => errors.push(error))
    const { promise, reject } = deferred()
    const update = runTimeline(parallel('race', action({ init: () => promise }), action({ update: () => false })))
    update({}, 1 / 60)
    const error = new Error('init failed')
    reject(error)
    await nextMacrotask()
    spy.mockRestore()
    expect(errors).toEqual([error])
  })
})
