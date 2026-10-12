import { describe, it, expect } from 'vitest'
import { runTimeline, action, ReplacableTimeline } from '../src/index.js'

describe('ReplacableTimeline', () => {
  it('restarts with the newly attached timeline in the next update', () => {
    const log: Array<string> = []
    const replaceable = new ReplacableTimeline()
    const update = runTimeline(replaceable.run())
    update({}, 1 / 60)
    replaceable.attach(() => action({ update: () => void log.push('attached') }))
    update({}, 1 / 60)
    expect(log).toEqual(['attached'])
  })

  it('cancel ends the run even if a timeline is attached afterwards', () => {
    let done = false
    const replaceable = new ReplacableTimeline()
    const update = runTimeline(function* () {
      yield* replaceable.run()
      done = true
    })
    update({}, 1 / 60)
    replaceable.cancel()
    replaceable.attach(() => action({}))
    update({}, 1 / 60)
    expect(done).toBe(true)
  })
})
