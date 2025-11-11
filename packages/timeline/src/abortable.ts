import { SynchronousAbortController, SynchronousAbortSignal } from './abort.js'
import { action } from './action.js'
import { NonReuseableTimeline, runTimelineAsync, type Timeline, type TimelineYieldActionUpdate } from './index.js'

/**
 * a timeline wrapper that allows to make any timeline externally cancelable via an abort signal
 */
export async function* abortable<T>(timeline: Timeline<T>, abortSignal: AbortSignal): NonReuseableTimeline<T> {
  const ref: { current?: TimelineYieldActionUpdate<T> } = {}
  const abortController = new SynchronousAbortController()
  const timelineFinishedOrAborted = runTimelineAsync(
    timeline,
    ref,
    SynchronousAbortSignal.any([abortSignal, abortController.signal]),
  )
  yield* action<T>({
    //when this action is done cancel the timeline
    init: () => () => abortController.abort(),
    update: (state, clock) => void ref.current?.(state, clock),
    until: timelineFinishedOrAborted,
  })
}
