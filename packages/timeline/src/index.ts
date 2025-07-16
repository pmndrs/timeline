export type Action<T> = {
  readonly update?: ActionUpdate<T>
  readonly until?: Promise<unknown>
  readonly cleanup?: () => void
} & ActionUpdateOptions

export type ActionUpdateOptions = Partial<{
  //readonly ease: EaseFunction
}>

export type ActionUpdate<T> = (state: T, clock: ActionClock, options?: ActionUpdateOptions) => boolean

export type ActionClock = {
  readonly time: number
  readonly delta: number
}

export type Timeline<T> = AsyncIterableActionsFunction<T> | AsyncIterableActions<T>

export type AsyncIterableActionsFunction<T> = () => AsyncIterableActions<T>

export type AsyncIterableActions<T> = AsyncIterable<Action<T>>

export async function* action<T>(a: Action<T>): AsyncIterableActions<T> {
  yield a
}

export async function* parallel<T>(
  type: 'all' | 'race',
  ...timelines: Array<Timeline<T> | boolean>
): AsyncIterableActions<T> {
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

export function build<T>(timeline: Timeline<T>, abortSignal?: AbortSignal): Update<T> {
  const ref: UpdateRef<T> = {}
  buildAsync(timeline, ref, abortSignal)
  const clock = { delta: 0.00001, time: 0 } satisfies ActionClock
  return (state, delta) => {
    clock.time += delta
    clock.delta = delta
    ref.current?.(state, clock)
  }
}

type UpdateRef<T> = { current?: (...params: Parameters<ActionUpdate<T>>) => void }

async function buildAsync<T>(
  timeline: Timeline<T>,
  updateRef: UpdateRef<T>,
  abortSignal?: AbortSignal,
  options?: ActionUpdateOptions,
) {
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
        if (!actionUpdate(state, delta, options)) {
          resolveRef(undefined)
        }
      }
    } else {
      promises.push(new Promise(() => {}))
    }
    await Promise.race(promises)
    updateRef.current = undefined
  }
}

export * from './helpers/index.js'
//export * from './ease.js'
