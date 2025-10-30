import type { NonReuseableTimeline, TimelineClock, TimelineYieldAction } from './index.js'

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

export type ActionParams<T> = {
  readonly init?: () => (() => void) | undefined | void
  readonly update?: ActionUpdate<T> | Array<ActionUpdate<T>>
  readonly until?: Promise<unknown>
}

/**
 * core function for yielding an action used via `yield* action({...})`
 * allows to run this action `until` a certain event and execute an `update` function until the action is finished
 */
export async function* action<T>(action: ActionParams<T>): NonReuseableTimeline<T> {
  const cleanup = action.init?.()
  const internalAbortController = new AbortController()
  if (cleanup != null) {
    internalAbortController.signal.addEventListener('abort', cleanup, { once: true })
    yield {
      type: 'get-global-abort-signal',
      callback: (globalAbortSignal) => {
        if (globalAbortSignal.aborted) {
          cleanup()
          return
        }
        globalAbortSignal.addEventListener('abort', cleanup, { once: true, signal: internalAbortController.signal })
      },
    }
  }
  if (action.until != null) {
    action.until.then(() => internalAbortController.abort()).catch(console.error)
  }
  const timelineYield: TimelineYieldAction<T> = { type: 'action', abortSignal: internalAbortController.signal }
  if (action.update != null && Array.isArray(action.update)) {
    const updates = action.update
    let actionTime = 0
    const memos = updates.map(() => ({}))
    timelineYield.update = (state, clock) => {
      actionTime += clock.delta
      let shouldContinue: boolean | undefined
      for (let i = 0; i < updates.length; i++) {
        const currentShouldContinue = updates[i](state, clock, actionTime, memos[i])
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
    let firstUpdate = true
    const memo = {}
    timelineYield.update = (state, clock) => {
      actionTime += clock.delta
      if (update(state, clock, actionTime, memo) === false) {
        internalAbortController.abort()
      }
      firstUpdate = false
    }
  }

  yield timelineYield
  if (!internalAbortController.signal.aborted) {
    internalAbortController.abort()
  }
}
