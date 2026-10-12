import { describe, it, expect } from 'vitest'
import { oneTick } from './helpers.js'
import { runTimeline, action, parallel, timePassed, doUntil } from '../src/index.js'

describe('parallel', () => {
  it('steps every timeline once per update', () => {
    const log: Array<string> = []
    const update = runTimeline(
      parallel('all', action({ update: () => void log.push('A') }), action({ update: () => void log.push('B') })),
    )
    update({}, 1 / 60)
    update({}, 1 / 60)
    expect(log).toEqual(['A', 'B', 'A', 'B'])
  })

  it("'race' cancels the other timelines synchronously, running their finally blocks and cleanups", () => {
    const log: Array<string> = []
    const update = runTimeline(function* () {
      yield* parallel('race', action({ update: () => false }), function* () {
        try {
          yield* action({ init: () => () => void log.push('cleanup') })
        } finally {
          log.push('finally')
        }
      })
      log.push('after race')
    })
    update({}, 1 / 60)
    expect(log).toEqual(['cleanup', 'finally', 'after race'])
  })

  it("'all' waits for every timeline", () => {
    let done = false
    const update = runTimeline(function* () {
      yield* parallel('all', action({ until: timePassed(1, 'seconds') }), action({ until: timePassed(2, 'seconds') }))
      done = true
    })
    for (let i = 0; i < 2; i++) {
      update({}, 0.5)
    }
    expect(done).toBe(false)
    for (let i = 0; i < 3; i++) {
      update({}, 0.5)
    }
    expect(done).toBe(true)
  })

  it('skips false branches', () => {
    const log: Array<string> = []
    const update = runTimeline(parallel('all', false, oneTick(log, 'A')))
    update({}, 1 / 60)
    expect(log).toEqual(['A'])
  })

  it('nested parallel triggers all cleanups exactly once', () => {
    const calls: Record<string, number> = {}
    const mark = (key: string) => () => () => {
      calls[key] = (calls[key] ?? 0) + 1
    }
    const update = runTimeline(
      parallel(
        'race',
        parallel('all', action({ init: mark('innerA'), update: () => false }), action({ init: mark('innerB') })),
        action({ init: mark('outer'), update: () => false }),
      ),
    )
    update({}, 1 / 60)
    update({}, 1 / 60)
    expect(calls).toEqual({ innerA: 1, innerB: 1, outer: 1 })
  })

  it('doUntil repeats the timeline until the condition is met', () => {
    const log: Array<string> = []
    const update = runTimeline(doUntil(timePassed(1, 'seconds'), () => oneTick(log, 'tick')))
    for (let i = 0; i < 10; i++) {
      update({}, 0.25)
    }
    expect(log).toEqual(['tick', 'tick', 'tick', 'tick'])
  })
})

describe('errors in parallel timelines', () => {
  it('propagate out of update and cancel the other timelines', () => {
    let cleaned = 0
    const update = runTimeline(
      parallel(
        'all',
        action({
          update: () => {
            throw new Error('boom')
          },
        }),
        action({ init: () => () => cleaned++ }),
      ),
    )
    expect(() => update({}, 1 / 60)).toThrow('boom')
    expect(cleaned).toBe(1)
  })
})
