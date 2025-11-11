import { SynchronousAbortController, SynchronousAbortSignal } from './abort.js'
import { action } from './action.js'
import {
  GetTimelineContext,
  GetTimelineState,
  NonReuseableTimeline,
  runTimelineAsync,
  type Timeline,
  type TimelineYieldActionUpdate,
} from './index.js'

/**
 * a timeline wrapper that allows to make any timeline externally cancelable via an abort signal
 */
export async function* abortable<T extends Timeline<any, any>>(
  timeline: T,
  abortSignal: AbortSignal,
): NonReuseableTimeline<GetTimelineState<T>, GetTimelineContext<T>> {
  const ref: { current?: TimelineYieldActionUpdate<T> } = {}
  const abortController = new SynchronousAbortController()
  //context bridge forwarding the context inside
  let context!: GetTimelineContext<T>
  yield { type: 'get-context', callback: (c) => (context = c) }
  const timelineFinishedOrAborted = runTimelineAsync(
    timeline,
    context,
    ref,
    SynchronousAbortSignal.any([abortSignal, abortController.signal]),
  )
  yield* action<T>({
    //when this action is done cancel the timeline
    init: () => () => {
      console.log('cleanup abortable')
      abortController.abort()
    },
    update: (state, clock) => void ref.current?.(state, clock),
    until: timelineFinishedOrAborted,
  })
}
