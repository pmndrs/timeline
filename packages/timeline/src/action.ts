import type { NonReuseableTimeline, TimelineClock } from './index.js'

/**
 * @returns true if the action update should continue (default)
 * @returns false if the action update should not continue
 */
export type ActionUpdate<T> = (
  state: T,
  clock: TimelineClock,
  actionTime: number,
  memo: Record<string, any>,
) => boolean | void | undefined

/**
 * checked at the start of every frame with the time the action has run before this frame
 * @returns true once the action is done
 */
export type UntilCondition<T> = (state: T, clock: TimelineClock, actionTime: number) => boolean

/**
 * when an action is done: a synchronous condition, or a promise for external events
 * a promise is observed via `.then`, so the action notices its resolution on the next frame at the earliest (at most one frame of latency);
 * use conditions (e.g. `timePassed`) for sequencing within the simulation
 */
export type Until<T> = UntilCondition<T> | Promise<unknown>

type Cleanup = () => void

export type ActionParams<T> = {
  /**
   * runs once before the first update; a returned cleanup runs when the action ends
   * a returned promise delays the first update until it resolves
   */
  readonly init?: () => Cleanup | Promise<Cleanup | void> | undefined | void
  readonly update?: ActionUpdate<T> | Array<ActionUpdate<T>>
  readonly until?: Until<T>
}

/**
 * core function for yielding an action used via `yield* action({...})`
 * allows to run this action `until` a certain event and execute an `update` function until the action is finished
 */
export function* action<T>({ init, update, until }: ActionParams<T>): NonReuseableTimeline<T> {
  const initialized = initialize(init)
  const isDone = toCondition(until)
  const updates = update == null ? [] : Array.isArray(update) ? update : [update]
  const memos = updates.map(() => ({}))
  let actionTime = 0
  try {
    yield (state, clock) => {
      if (!initialized.isReady()) {
        return 'running'
      }
      if (isDone(state, clock, actionTime)) {
        return 'skipped'
      }
      actionTime += clock.delta
      //the first update that returns a boolean decides whether the action continues
      let shouldContinue: boolean | undefined
      for (let i = 0; i < updates.length; i++) {
        const result = updates[i](state, clock, actionTime, memos[i])
        if (shouldContinue == null && typeof result === 'boolean') {
          shouldContinue = result
        }
      }
      return shouldContinue === false ? 'finished' : 'running'
    }
  } finally {
    initialized.cleanup()
  }
}

function initialize(init: ActionParams<unknown>['init']): { isReady: () => boolean; cleanup: Cleanup } {
  const result = init?.()
  if (result == null || typeof result === 'function') {
    return { isReady: () => true, cleanup: () => result?.() }
  }
  let ended = false
  let cleanup: Cleanup | void
  const isReady = observe(
    result.then((value) => {
      cleanup = value
      //the action ended before its init resolved
      if (ended) {
        value?.()
      }
    }),
  )
  return {
    isReady,
    cleanup: () => {
      ended = true
      cleanup?.()
    },
  }
}

function toCondition<T>(until: Until<T> | undefined): UntilCondition<T> {
  if (until == null) {
    return () => false
  }
  if (typeof until === 'function') {
    return until
  }
  return observe(until)
}

/**
 * @returns a poll that is true once the promise resolved and throws once it rejected
 */
function observe(promise: Promise<unknown>): () => boolean {
  let outcome: { error: unknown } | 'resolved' | undefined
  promise.then(
    () => (outcome = 'resolved'),
    (error: unknown) => (outcome = { error }),
  )
  return () => {
    if (typeof outcome === 'object') {
      throw outcome.error
    }
    return outcome === 'resolved'
  }
}
