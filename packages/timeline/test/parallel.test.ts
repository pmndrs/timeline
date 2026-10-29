import { describe, it, expect, expectTypeOf } from 'vitest'
import { oneTick } from './helpers.js'
import {
  runTimeline,
  action,
  parallel,
  timePassed,
  doUntil,
  doWhile,
  abortable,
  ParallelTimeline,
  type NonReuseableTimeline,
} from '../src/index.js'

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

describe('doWhile', () => {
  it('hands the frame on once the condition fails', () => {
    const log: Array<string> = []
    let frame = 0
    const logFrame = (name: string) =>
      action({
        update: () => {
          log.push(`${name} ${frame}`)
          return false
        },
      })
    const update = runTimeline(function* () {
      yield* doWhile(
        () => frame < 2,
        () => logFrame('body'),
      )
      yield* logFrame('after')
    })
    for (; frame < 4; frame++) {
      update({}, 1 / 60)
    }
    expect(log).toEqual(['body 0', 'body 1', 'after 2'])
  })
})

describe('empty parallel', () => {
  it('is done immediately and hands the frame on', () => {
    const log: Array<string> = []
    const update = runTimeline(function* () {
      yield* parallel('all', false, false)
      yield* parallel('race')
      yield* oneTick(log, 'after')
    })
    update({}, 1 / 60)
    expect(log).toEqual(['after'])
  })
})

describe('ParallelTimeline.attach', () => {
  it('idles while empty and runs a timeline attached later', () => {
    const log: Array<string> = []
    const parallelTimeline = new ParallelTimeline('all')
    const update = runTimeline(parallelTimeline.run())
    update({}, 1 / 60)
    parallelTimeline.attach(() => action({ update: () => void log.push('child') }))
    update({}, 1 / 60)
    update({}, 1 / 60)
    expect(log).toEqual(['child', 'child'])
  })

  it('throws when attaching the same timeline twice', () => {
    const parallelTimeline = new ParallelTimeline('all')
    const timeline = () => action({})
    parallelTimeline.attach(timeline)
    expect(() => parallelTimeline.attach(timeline)).toThrow(/already attached/)
  })
})

/**
 * a timeline that ends after `frames` frames, returning `outcome`
 */
function* endsWith<R>(outcome: R, frames = 1): NonReuseableTimeline<unknown, R> {
  for (let frame = 0; frame < frames; frame++) {
    yield* action({ update: () => false })
  }
  return outcome
}

/**
 * runs a timeline to its end and returns what it returned
 */
function outcomeOf(timeline: NonReuseableTimeline<unknown, unknown>, maxFrames = 100): unknown {
  let outcome: unknown
  let ended = false
  const update = runTimeline(function* () {
    outcome = yield* timeline
    ended = true
  })
  for (let frame = 0; frame < maxFrames && !ended; frame++) {
    update({}, 1 / 60)
  }
  expect(ended).toBe(true)
  return outcome
}

describe('parallel outcome', () => {
  it("'race' returns what the timeline that ended first returned", () => {
    expect(outcomeOf(parallel('race', endsWith('slow', 3), endsWith('fast', 1)))).toBe('fast')
  })

  it("'race' never returns what a cancelled timeline returns", () => {
    let cancelled = false
    const quitter = function* () {
      try {
        yield* action({ update: () => false })
        yield* action({ update: () => false })
      } finally {
        cancelled = true
        //a value returned from a finally block on cancellation is dropped
        return 'cancelled'
      }
    }
    expect(outcomeOf(parallel('race', quitter, endsWith('winner', 1)))).toBe('winner')
    expect(cancelled).toBe(true)
  })

  it("'race' decided within one frame returns the first timeline in order that ended", () => {
    expect(outcomeOf(parallel('race', endsWith('first'), endsWith('second')))).toBe('first')
    expect(outcomeOf(parallel('race', endsWith('immediate', 0), endsWith('later')))).toBe('immediate')
  })

  it("'all' returns false once any timeline returned false, even when it ended first", () => {
    expect(outcomeOf(parallel('all', endsWith(false, 1), endsWith(true, 3)))).toBe(false)
    expect(outcomeOf(parallel('all', endsWith(true, 1), endsWith(false, 3)))).toBe(false)
    expect(outcomeOf(parallel('all', endsWith(true), endsWith(true, 2)))).toBe(true)
  })

  it("'all' counts timelines that return nothing (or anything but false) as succeeded", () => {
    expect(outcomeOf(parallel('all', action({ update: () => false }), endsWith(true)))).toBe(true)
    expect(outcomeOf(parallel('all', endsWith(undefined), endsWith(0), endsWith('')))).toBe(true)
  })

  it('skips boolean entries for the outcome too', () => {
    expect(outcomeOf(parallel('all', true, false, endsWith(true)))).toBe(true)
    expect(outcomeOf(parallel('race', false, endsWith('only')))).toBe('only')
  })

  it("without timelines, 'all' returns true and 'race' returns undefined", () => {
    expect(outcomeOf(parallel('all', false, false))).toBe(true)
    expect(outcomeOf(parallel('race', false))).toBeUndefined()
  })

  it('nested parallels pass outcomes up', () => {
    expect(
      outcomeOf(parallel('race', parallel('all', endsWith(true), endsWith(false, 2)), endsWith('timeout', 5))),
    ).toBe(false)
    expect(outcomeOf(parallel('all', parallel('race', endsWith(false), endsWith(true, 2)), endsWith(true)))).toBe(false)
    expect(outcomeOf(parallel('race', parallel('race', endsWith('inner', 2)), endsWith('outer', 3)))).toBe('inner')
  })

  it('ParallelTimeline.run returns the outcome of timelines attached while it runs', () => {
    const parallelTimeline = new ParallelTimeline('race')
    let outcome: unknown
    const update = runTimeline(function* () {
      outcome = yield* parallelTimeline.run()
    })
    update({}, 1 / 60)
    parallelTimeline.attach(() => endsWith('attached'))
    update({}, 1 / 60)
    update({}, 1 / 60)
    expect(outcome).toBe('attached')
  })

  it('a cancelled parallel returns nothing and cancels its timelines as before', () => {
    const log: Array<string> = []
    const controller = new AbortController()
    const update = runTimeline(function* () {
      const outcome = yield* abortable(
        parallel(
          'all',
          action({ init: () => () => void log.push('cleanup A') }),
          action({ init: () => () => void log.push('cleanup B') }),
        ),
        controller.signal,
      )
      log.push(`after ${String(outcome)}`)
    })
    update({}, 1 / 60)
    controller.abort()
    expect(log).toEqual(['cleanup A', 'cleanup B'])
    update({}, 1 / 60)
    expect(log).toEqual(['cleanup A', 'cleanup B', 'after undefined'])
  })
})

describe('parallel outcome types', () => {
  type Frame = { frame: number }
  const frameTimeline = (): NonReuseableTimeline<Frame, 'arrived' | 'stuck'> => endsWith('arrived')
  const verbs: Array<NonReuseableTimeline<unknown, boolean>> = []

  it("'race' is typed as the union of its timelines' outcomes", () => {
    expectTypeOf(parallel('race', endsWith(true), endsWith(3))).toEqualTypeOf<
      NonReuseableTimeline<unknown, boolean | number>
    >()
    expectTypeOf(parallel('race', endsWith(true), action({ update: () => false }))).toEqualTypeOf<
      NonReuseableTimeline<unknown, boolean | void>
    >()
  })

  it("'race' infers the state its timelines share", () => {
    expectTypeOf(parallel('race', endsWith(true), frameTimeline)).toEqualTypeOf<
      NonReuseableTimeline<Frame, boolean | 'arrived' | 'stuck'>
    >()
  })

  it("'race' includes undefined when it may have no timeline to run", () => {
    expectTypeOf(parallel('race', false, endsWith(true))).toEqualTypeOf<
      NonReuseableTimeline<unknown, boolean | undefined>
    >()
    expectTypeOf(parallel('race', ...verbs)).toEqualTypeOf<NonReuseableTimeline<unknown, boolean | undefined>>()
  })

  it("'all' is typed as boolean", () => {
    expectTypeOf(parallel('all', endsWith(3), frameTimeline)).toEqualTypeOf<NonReuseableTimeline<Frame, boolean>>()
  })

  it('an explicit state type keeps compiling, with an unknown race outcome', () => {
    expectTypeOf(parallel<Frame>('race', endsWith(true), frameTimeline)).toEqualTypeOf<
      NonReuseableTimeline<Frame, unknown>
    >()
    expectTypeOf(parallel<Frame>('all', endsWith(true), frameTimeline)).toEqualTypeOf<
      NonReuseableTimeline<Frame, boolean>
    >()
    const type = 'all' as 'all' | 'race'
    expectTypeOf(parallel(type, endsWith(true))).toEqualTypeOf<NonReuseableTimeline<unknown, unknown>>()
  })
})
