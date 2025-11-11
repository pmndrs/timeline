import { SynchronousAbortController, SynchronousAbortSignal } from './abort.js'
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
export async function* scope<T>(
  timeline: (abortSignal: AbortSignal) => NonReuseableTimeline<T>,
): NonReuseableTimeline<T> {
  const internalAbortController = new SynchronousAbortController()
  let externalAbortSignal!: AbortSignal
  yield {
    type: 'get-global-abort-signal',
    callback: (abortSignal) => (externalAbortSignal = abortSignal),
  }
  if (externalAbortSignal.aborted) {
    return
  }
  yield* timeline(SynchronousAbortSignal.any([internalAbortController.signal, externalAbortSignal]))
  //abort because scope successfully ran through
  internalAbortController.abort()
}
