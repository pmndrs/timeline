export type TimelineYield<T> = TimelineYieldGetGlobalAbortSignal | TimelineYieldAction<T>

export type TimelineYieldGetGlobalAbortSignal = {
  type: 'get-global-abort-signal'
  callback(abortSignal: AbortSignal): void
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

export type Timeline<T = unknown, R = void> = ReusableTimeline<T, R> | NonReuseableTimeline<T, R>

export type ReusableTimeline<T = unknown, R = void> = () => NonReuseableTimeline<T, R>

export type NonReuseableTimeline<T = unknown, R = void> = AsyncIterable<TimelineYield<T>, R>

export type Update<T> = (state: T, delta: number) => void

/**
 * function for starting a timeline
 * @returns an update function which must be executed every frame with the delta time in seconds
 */
export function start<T>(timeline: Timeline<T>, abortSignal?: AbortSignal, onError = console.error): Update<T> {
  const ref: { current?: TimelineYieldActionUpdate<T> } = {}
  startAsync(timeline, ref, abortSignal).catch(onError)
  const clock: TimelineClock = { delta: 0, prevDelta: 0 }
  return (state, delta) => {
    clock.delta = delta
    ref.current?.(state, clock)
    clock.prevDelta = delta
  }
}

export async function startAsync<T>(
  timeline: Timeline<T>,
  updateRef: { current?: TimelineYieldActionUpdate<T> },
  abortSignal: AbortSignal = new AbortController().signal,
) {
  timeline = typeof timeline === 'function' ? timeline() : timeline
  const abortPromise = abortSignalToPromise(abortSignal)

  for await (const timelineYield of timeline) {
    if (abortSignal.aborted) {
      return
    }
    if (timelineYield.type === 'get-global-abort-signal') {
      timelineYield.callback(abortSignal)
      continue
    }
    updateRef.current = timelineYield.update
    await Promise.race([abortPromise, abortSignalToPromise(timelineYield.abortSignal)])
    updateRef.current = undefined
    if (abortSignal?.aborted) {
      return
    }
  }
}

export function abortSignalToPromise(signal: AbortSignal) {
  return new Promise<unknown>((resolve) => signal.addEventListener('abort', resolve, { once: true }))
}

export * from './misc.js'
export * from './graph.js'
export * from './look-at.js'
export * from './offset.js'
export * from './ease.js'
export * from './transition.js'
export * from './replace.js'
export * from './previous.js'
export * from './parallel.js'
export * from './queue.js'
export * from './action.js'
export * from './scope.js'
export * from './abortable.js'
