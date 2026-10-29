import { TimelineRunner } from './runner.js'
import type { NonReuseableTimeline, Timeline } from './index.js'

/**
 * a timeline wrapper that allows to make any timeline externally cancelable via an abort signal
 * aborting cancels the wrapped timeline immediately; the wrapper finishes on the next frame without using it
 */
export function* abortable<T>(timeline: Timeline<T, unknown>, abortSignal: AbortSignal): NonReuseableTimeline<T> {
  if (abortSignal.aborted) {
    return
  }
  const runner = new TimelineRunner(timeline)
  const cancel = () => runner.cancel()
  abortSignal.addEventListener('abort', cancel, { once: true })
  try {
    yield* runner.run()
  } finally {
    abortSignal.removeEventListener('abort', cancel)
  }
}
