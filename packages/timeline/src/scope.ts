import { SynchronousAbortController } from './abort.js'
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
export function* scope<T>(timeline: (abortSignal: AbortSignal) => NonReuseableTimeline<T>): NonReuseableTimeline<T> {
  const controller = new SynchronousAbortController()
  try {
    yield* timeline(controller.signal)
  } finally {
    controller.abort()
  }
}
