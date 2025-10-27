import type { NonReuseableTimeline, TimelineClock, TimelineYieldAction } from './index.js'

/**
 * @returns true if the action update should continue (default)
 * @returns false if the action update should not continue
 */
export type ActionUpdate<T> = (state: T, clock: TimelineClock, actionTime: number) => boolean | void | undefined

export type Action<T> = {
  readonly init?: () => (() => void) | undefined | void
  readonly update?: ActionUpdate<T> | Array<ActionUpdate<T>>
  readonly until?: Promise<unknown>
}

/**
 * core function for yielding an action used via `yield* action({...})`
 * allows to run this action `until` a certain event and execute an `update` function until the action is finished
 */
export async function* action<T>(action: Action<T>): NonReuseableTimeline<T> {
  const cleanup = action.init?.()
  const internalAbortController = new AbortController()
  if (cleanup != null) {
    yield {
      type: 'get-global-abort-signal',
      callback: (s) => s.addEventListener('abort', cleanup, { once: true, signal: internalAbortController.signal }),
    }
  }
  if (action.until != null) {
    action.until.then(() => internalAbortController.abort()).catch(console.error)
  }
  const timelineYield: TimelineYieldAction<T> = { type: 'action', abortSignal: internalAbortController.signal }
  if (action.update != null && Array.isArray(action.update)) {
    const updates = action.update
    let actionTime = 0
    timelineYield.update = (state, clock) => {
      actionTime += clock.delta
      let shouldContinue: boolean | undefined
      for (let i = 0; i < updates.length; i++) {
        const currentShouldContinue = updates[i](state, clock, actionTime)
        if (currentShouldContinue == null) {
          continue
        }
        if (shouldContinue == null || shouldContinue == null) {
          shouldContinue = currentShouldContinue
        }
      }
      shouldContinue ??= true
      if (!shouldContinue) {
        internalAbortController.abort()
      }
    }
  }

  if (action.update != null && !Array.isArray(action.update)) {
    const update = action.update
    let actionTime = 0
    timelineYield.update = (state, clock) => {
      actionTime += clock.delta
      if (update(state, clock, actionTime) === false) {
        internalAbortController.abort()
        return
      }
    }
  }

  yield timelineYield
  if (!internalAbortController.signal.aborted) {
    internalAbortController.abort()
    cleanup?.()
  }
}
