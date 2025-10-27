import { action } from './action.js'
import { type Timeline, type NonReuseableTimeline, startAsync, TimelineYieldActionUpdate } from './index.js'

/**
 * function for executing multiple timelines in parallel
 * @param type when to stop all timelines - either wait for `"all"` or cancel all timelines once the first timeline is done via `"race"`
 */
export async function* parallel<T>(
  type: 'all' | 'race',
  ...timelines: Array<Timeline<T> | boolean>
): NonReuseableTimeline<T> {
  const internalAbortController = new AbortController()
  const refs: Array<{
    current?: TimelineYieldActionUpdate<T>
  }> = timelines.map(() => ({}))
  const promises = timelines
    .filter((timeline) => typeof timeline != 'boolean')
    .map((timeline, i) =>
      startAsync(typeof timeline === 'function' ? timeline() : timeline, refs[i]!, internalAbortController.signal),
    )
  yield* action({
    init: () => () => internalAbortController.abort(),
    update: (state, clock) => {
      const length = timelines.length
      for (let i = 0; i < length; i++) {
        refs[i]!.current?.(state, clock)
      }
    },
    until: type === 'all' ? Promise.all(promises) : Promise.race(promises),
  })
}
