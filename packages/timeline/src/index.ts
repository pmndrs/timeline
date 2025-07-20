export type Action<T> = {
  readonly init?: () => void
  readonly update?: ActionUpdate<T>
  readonly until?: Promise<unknown>
  readonly cleanup?: () => void
}

export type ActionUpdate<T> = (state: T, clock: ActionClock, easing?: number) => boolean | void | undefined

export type ActionClock = {
  readonly time: number
  readonly delta: number
}

export type Timeline<T, R = any> = ReusableTimeline<T, R> | NonReuseableTimeline<T, R>

export type ReusableTimeline<T, R = any> = () => NonReuseableTimeline<T, R>

export type NonReuseableTimeline<T, R = any> = AsyncIterable<Action<T>, R>

export async function* action<T>(a: Action<T>): NonReuseableTimeline<T> {
  a.init?.()
  yield a
}

export async function* parallel<T>(
  type: 'all' | 'race',
  ...timelines: Array<Timeline<T> | boolean>
): NonReuseableTimeline<T> {
  const internalAbortController = new AbortController()
  const refs: Array<UpdateRef<T>> = timelines.map(() => ({}))
  const promises = timelines
    .filter((timeline) => typeof timeline != 'boolean')
    .map((timeline, i) =>
      buildAsync(typeof timeline === 'function' ? timeline() : timeline, refs[i]!, internalAbortController.signal),
    )
  yield {
    update(state, clock) {
      const length = timelines.length
      for (let i = 0; i < length; i++) {
        refs[i]!.current?.(state, clock)
      }
      return true
    },
    cleanup() {
      internalAbortController.abort()
    },
    until: type === 'all' ? Promise.all(promises) : Promise.race(promises),
  }
}

export type Update<T> = (state: T, delta: number) => void

export function build<T>(timeline: Timeline<T>, abortSignal?: AbortSignal, onError = console.error): Update<T> {
  const ref: UpdateRef<T> = {}
  buildAsync(timeline, ref, abortSignal).catch(onError)
  const clock = { delta: 0.00001, time: 0 } satisfies ActionClock
  return (state, delta) => {
    clock.time += delta
    clock.delta = delta
    ref.current?.(state, clock)
  }
}

export async function* abortable<T>(timeline: Timeline<T>, abortSignal?: AbortSignal) {
  const ref: UpdateRef<T> = {}
  const abortController = new AbortController()
  const timelineFinishedOrAborted = buildAsync(
    timeline,
    ref,
    abortSignal != null ? AbortSignal.any([abortSignal, abortController.signal]) : abortController.signal,
  )
  yield* action<T>({
    update: (state, clock, easing) => {
      ref.current?.(state, clock, easing)
      return true
    },
    cleanup: abortController.abort.bind(abortController),
    until: timelineFinishedOrAborted,
  })
}

type UpdateRef<T> = { current?: (...params: Parameters<ActionUpdate<T>>) => void }

async function buildAsync<T>(timeline: Timeline<T>, updateRef: UpdateRef<T>, abortSignal?: AbortSignal) {
  const abortPromise =
    abortSignal != null ? new Promise<unknown>((resolve) => abortSignal.addEventListener('abort', resolve)) : undefined
  timeline = typeof timeline === 'function' ? timeline() : timeline
  for await (const action of timeline) {
    if (abortSignal?.aborted) {
      return
    }
    const promises: Array<Promise<unknown>> = []
    if (abortPromise != null) {
      promises.push(abortPromise)
    }
    if (action.until != null) {
      promises.push(action.until)
      updateRef.current = action.update
    } else if (action.update != null) {
      const actionUpdate = action.update
      let resolveRef!: (value: unknown) => void
      promises.push(new Promise((resolve) => (resolveRef = resolve)))
      updateRef.current = (state, delta) => {
        const shouldContinue = actionUpdate(state, delta) ?? true
        if (!shouldContinue) {
          resolveRef(undefined)
        }
      }
    } else {
      promises.push(new Promise(() => {}))
    }
    await Promise.race(promises)
    action.cleanup?.()
    updateRef.current = undefined
    if (abortSignal?.aborted) {
      return
    }
  }
}

export * from './helpers/index.js'
//export * from './ease.js'
