import { describe, it, expect } from 'vitest'
import { deferred, oneTick } from './helpers.js'
import { runTimeline, action, timePassed } from '../src/index.js'

describe('action', () => {
  it('runs init when it starts and its cleanup when update returns false', () => {
    const log: Array<string> = []
    const update = runTimeline(
      action({
        init: () => {
          log.push('init')
          return () => log.push('cleanup')
        },
        update: () => {
          log.push('update')
          return false
        },
      }),
    )
    expect(log).toEqual(['init'])
    update({}, 1 / 60)
    expect(log).toEqual(['init', 'update', 'cleanup'])
  })

  it('throws when init returns a promise', () => {
    //a function typed to return void may still return a promise
    const init: () => void = async () => {}
    expect(() => runTimeline(action({ init }))).toThrow(/must return a cleanup function or nothing, got object/)
  })

  it('passes the accumulated action time to update', () => {
    const times: Array<number> = []
    const update = runTimeline(action({ update: (_state, _clock, time) => times.push(time) < 3 }))
    for (let i = 0; i < 5; i++) {
      update({}, 0.5)
    }
    expect(times).toEqual([0.5, 1, 1.5])
  })

  it.each([
    [1, 'seconds', 0.25, 4],
    [500, 'milliseconds', 0.25, 2],
    //6 * 1/60 sums to 0.09999999999999999
    [0.1, 'seconds', 1 / 60, 6],
  ] as const)('timePassed(%s, %s) at delta %s waits %s frames of simulation time', (time, unit, delta, frames) => {
    const log: Array<string> = []
    const update = runTimeline(function* () {
      yield* action({ until: timePassed(time, unit) })
      yield* oneTick(log, 'next')
    })
    for (let i = 0; i < frames; i++) {
      update({}, delta)
    }
    expect(log).toEqual([])
    update({}, delta)
    expect(log).toEqual(['next'])
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
})
