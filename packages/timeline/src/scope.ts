import type { NonReuseableTimeline } from './index.js'

/**
 * allows to bind a resource to the lifetime of the scope regardless if the scope has finished or if it was cancelled
 *
 * @example
 * scope(function* (abortSignal) {
 *    const resource  = new Resource()
 *    abortSignal.addEventListener("abort", () => resource.destroy(), { once: true })
 *    yield* action(...)
 * })
 */
export async function* scope<T = unknown>(
  timeline: (abortSignal: AbortSignal) => NonReuseableTimeline<T>,
): NonReuseableTimeline<T> {
  const scopeAbortController = new AbortController()
  yield {
    type: 'get-global-abort-signal',
    callback: (abortSignal) => {
      if (abortSignal.aborted) {
        scopeAbortController.abort()
        return
      }
      abortSignal.addEventListener(
        'abort',
        //abort because signal was aborted
        () => scopeAbortController.abort(),
        {
          once: true,
          //stop listening once the scope is done either successful or unsuccessful
          signal: scopeAbortController.signal,
        },
      )
    },
  }
  yield* timeline(scopeAbortController.signal)
  //abort because scope successfully ran through
  scopeAbortController.abort()
}
