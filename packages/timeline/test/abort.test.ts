import { describe, it, expect } from 'vitest'
import { oneTick } from './helpers.js'
import { runTimeline, action, abortable, parallel, timePassed, SynchronousAbortController } from '../src/index.js'

describe('aborting a running timeline', () => {
  it('cancels a running nested parallel("race") timeline', () => {
    let cleaned = 0
    const controller = new SynchronousAbortController()
    const update = runTimeline(
      parallel(
        'race',
        action({ init: () => () => cleaned++, until: timePassed(100, 'seconds') }),
        action({ init: () => () => cleaned++, until: timePassed(200, 'seconds') }),
      ),
      controller.signal,
    )
    update({}, 1)
    controller.abort()
    expect(cleaned).toBe(2)
  })

  it('does not start a timeline whose signal already aborted', () => {
    let started = false
    const controller = new SynchronousAbortController()
    controller.abort()
    runTimeline(action({ init: () => void (started = true) }), controller.signal)
    expect(started).toBe(false)
  })

  it('abortable cancels the inner timeline immediately and continues on the next update', () => {
    const log: Array<string> = []
    const controller = new SynchronousAbortController()
    const update = runTimeline(function* () {
      yield* abortable(action({ init: () => () => void log.push('cleanup') }), controller.signal)
      yield* oneTick(log, 'next')
    })
    update({}, 1 / 60)
    controller.abort()
    expect(log).toEqual(['cleanup'])
    update({}, 1 / 60)
    expect(log).toEqual(['cleanup', 'next'])
  })
})
