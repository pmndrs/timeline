import { SynchronousAbortController, SynchronousAbortSignal } from './abort.js'

export type TimelineYield<T = unknown, C extends {} = {}> =
  | TimelineYieldGetGlobalAbortSignal
  | TimelineYieldAction<T>
  | TimelineYieldGetContext<C>

export type TimelineYieldGetGlobalAbortSignal = {
  type: 'get-global-abort-signal'
  callback: (abortSignal: AbortSignal) => void
}

export type TimelineYieldGetContext<C extends {}> = {
  type: 'get-context'
  callback: (context: C) => void
}

export type TimelineYieldAction<T> = {
  type: 'action'
  update?: TimelineYieldActionUpdate<T>
  abortSignal: AbortSignal
}

export type TimelineYieldActionUpdate<T> = (state: T, clock: TimelineClock) => void

export type TimelineClock = {
  delta: number
  prevDelta: number | undefined
}

export type Timeline<T = unknown, C extends {} = {}, R = void> =
  | ReusableTimeline<T, C, R>
  | NonReuseableTimeline<T, C, R>

export type ReusableTimeline<T = unknown, C extends {} = {}, R = void> = () => NonReuseableTimeline<T, C, R>

export type NonReuseableTimeline<T = unknown, C extends {} = {}, R = void> = AsyncIterable<TimelineYield<T, C>, R>

export type Update<T> = (state: T, delta: number) => void

export type GetTimelineState<T> = T extends Timeline<infer State, any, any> ? State : never
export type GetTimelineContext<T> = T extends Timeline<any, infer Context, any> ? Context : never

/**
 * function for starting a timeline
 * @returns an update function which must be executed every frame with the delta time in seconds
 */
export function runTimeline<T extends Timeline<any, any>>(
  timeline: T,
  context: GetTimelineContext<T>,
  abortSignal?: AbortSignal,
  onError = console.error,
): Update<GetTimelineState<T>> {
  const ref: { current?: TimelineYieldActionUpdate<GetTimelineState<T>> } = {}
  runTimelineAsync(timeline, context, ref, abortSignal).catch(onError)
  const clock: TimelineClock = { delta: 0, prevDelta: 0 }
  return (state, delta) => {
    clock.delta = delta
    ref.current?.(state, clock)
    clock.prevDelta = delta
  }
}

/**
 * @deprecated use `runTimeline` instead
 */
export const start = runTimeline

export async function runTimelineAsync<T extends Timeline<any, any>>(
  timeline: T,
  context: GetTimelineContext<T>,
  updateRef: { current?: TimelineYieldActionUpdate<GetTimelineState<T>> },
  abortSignal: AbortSignal = new SynchronousAbortController().signal,
) {
  const resolvedTimeline = typeof timeline === 'function' ? timeline() : (timeline as NonReuseableTimeline<any, any>)
  const abortPromise = abortSignalToPromise(abortSignal)
  const internalAbortController = new SynchronousAbortController()
  //combination of inner and outer abort signal
  const globalAbortSignal = SynchronousAbortSignal.any([internalAbortController.signal, abortSignal])

  for await (const timelineYield of resolvedTimeline) {
    if (timelineYield.type === 'get-global-abort-signal') {
      timelineYield.callback(globalAbortSignal)
    }
    if (timelineYield.type === 'get-context') {
      timelineYield.callback(context)
    }
    if (abortSignal.aborted) {
      return
    }
    if (timelineYield.type != 'action') {
      continue
    }
    updateRef.current = timelineYield.update
    await Promise.race([abortPromise, abortSignalToPromise(timelineYield.abortSignal)])
    updateRef.current = undefined
    if (abortSignal.aborted) {
      return
    }
  }
  internalAbortController.abort()
}

export function abortSignalToPromise(signal: AbortSignal) {
  if (signal.aborted) {
    return Promise.resolve()
  }
  return new Promise<unknown>((resolve) => signal.addEventListener('abort', resolve, { once: true }))
}

export * from './abort.js'
export * from './misc.js'
export * from './graph.js'
export * from './look-at.js'
export * from './offset.js'
export * from './ease.js'
export * from './transition.js'
export * from './replaceable.js'
export * from './previous.js'
export * from './parallel.js'
export * from './queue.js'
export * from './action.js'
export * from './scope.js'
export * from './abortable.js'
export * from './sequential.js'
export * from './singleton.js'
export * from './switch.js'
export * from './register.js'
export * from './context.js'
