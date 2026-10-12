import { describe, it, expect } from 'vitest'
import { oneTick } from './helpers.js'
import { runTimeline, action, graph, GraphTimeline, switch_, QueueTimeline, timePassed } from '../src/index.js'

describe('graph', () => {
  it('transitions with whenUpdate and the returned state name', () => {
    const log: Array<string> = []
    let go = false
    const update = runTimeline(
      graph(
        'a',
        {
          a: {
            timeline: () => action({ update: () => void log.push('a') }),
            transitionTo: { b: { whenUpdate: () => go } },
          },
          b: {
            timeline: function* () {
              yield* oneTick(log, 'b')
              return 'exit'
            },
          },
        },
        'exit',
      ),
    )
    update({}, 1 / 60)
    go = true
    //the transition is checked before the state's timeline, so "a" does not run in this frame
    update({}, 1 / 60)
    update({}, 1 / 60)
    update({}, 1 / 60)
    expect(log).toEqual(['a', 'b'])
  })

  it('transitions with whenPromise on the next update after it resolved', async () => {
    let resolve!: () => void
    const promise = new Promise<void>((r) => (resolve = r))
    const graphTimeline = new GraphTimeline('a', {
      a: { timeline: () => action({}), transitionTo: { b: { whenPromise: () => promise } } },
      b: { timeline: () => action({}) },
    })
    const update = runTimeline(graphTimeline.run())
    update({}, 1 / 60)
    resolve()
    await promise
    expect(graphTimeline.getState()).toBe('a')
    update({}, 1 / 60)
    expect(graphTimeline.getState()).toBe('b')
  })

  it('transitions with finally', () => {
    const graphTimeline = new GraphTimeline('a', {
      a: { timeline: () => action({ until: timePassed(1, 'seconds') }), transitionTo: { finally: 'b' } },
      b: { timeline: () => action({}) },
    })
    const update = runTimeline(graphTimeline.run())
    update({}, 0.5)
    update({}, 0.5)
    expect(graphTimeline.getState()).toBe('a')
    update({}, 0.5)
    expect(graphTimeline.getState()).toBe('b')
  })

  it('setState cancels the current state and starts the new one in the next update', () => {
    const log: Array<string> = []
    const graphTimeline = new GraphTimeline('a', {
      a: { timeline: () => action({ init: () => () => void log.push('cleanup a') }) },
      b: { timeline: () => action({ update: () => void log.push('b') }) },
    })
    const update = runTimeline(graphTimeline.run())
    update({}, 1 / 60)
    graphTimeline.setState('b')
    expect(log).toEqual(['cleanup a'])
    update({}, 1 / 60)
    expect(log).toEqual(['cleanup a', 'b'])
  })
})

describe('switch_', () => {
  it('restarts when the matching case changes', () => {
    const log: Array<string> = []
    let first = true
    const update = runTimeline(
      switch_([
        { condition: () => first, timeline: () => action({ update: () => void log.push('first') }) },
        { timeline: () => action({ update: () => void log.push('default') }) },
      ]),
    )
    update({}, 1 / 60)
    first = false
    update({}, 1 / 60)
    expect(log).toEqual(['first', 'default'])
  })
})

describe('QueueTimeline', () => {
  it('waitUntilNotEmpty is met once an entry is attached', () => {
    const log: Array<string> = []
    const queue = new QueueTimeline()
    const update = runTimeline(function* () {
      yield* action({ until: queue.waitUntilNotEmpty() })
      yield* queue.run()
    })
    update({}, 1 / 60)
    queue.attach(() => oneTick(log, 'entry'))
    update({}, 1 / 60)
    expect(log).toEqual(['entry'])
  })
})
