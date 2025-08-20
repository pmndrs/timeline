export type Action<T> = {
  readonly init?: () => void
  readonly update?: ActionUpdate<T> | Array<ActionUpdate<T>>
  readonly until?: Promise<unknown>
  readonly cleanup?: () => void
}

/**
 * @returns true if the action update should continue (default)
 * @returns false if the action update should not continue
 */
export type ActionUpdate<T> = (state: T, clock: ActionClock) => boolean | void | undefined

export type ActionClock = {
  readonly timelineTime: number
  readonly actionTime: number
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
  const subClocks: Array<{ -readonly [Key in keyof ActionClock]: ActionClock[Key] }> = []
  yield {
    update(state, clock) {
      const length = timelines.length
      for (let i = 0; i < length; i++) {
        let subClock = subClocks[i]
        if (subClock == null) {
          subClocks[i] = subClock = { actionTime: 0, delta: 0, timelineTime: 0 }
        }
        subClock.delta = clock.delta
        subClock.timelineTime = clock.timelineTime
        subClock.actionTime += clock.delta
        refs[i]!.current?.(state, subClock)
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
  const clock = { delta: 0.00001, timelineTime: 0, actionTime: 0 } satisfies ActionClock
  return (state, delta) => {
    clock.actionTime += delta
    clock.timelineTime += delta
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
    update: (state, clock) => {
      ref.current?.(state, clock)
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
  let shouldResetActionTime = false
  function resetActionTime(clock: ActionClock) {
    if (!shouldResetActionTime) {
      return
    }
    shouldResetActionTime = false
    ;(clock as { -readonly [Key in keyof ActionClock]: ActionClock[Key] }).actionTime = 0
  }
  for await (const action of timeline) {
    shouldResetActionTime = true
    if (abortSignal?.aborted) {
      return
    }
    const promises: Array<Promise<unknown>> = []
    if (abortPromise != null) {
      promises.push(abortPromise)
    }
    if (action.until != null) {
      promises.push(action.until)
      updateRef.current =
        action.update == null
          ? undefined
          : (state, clock) => {
              resetActionTime(clock)
              executeActionUpdates(state, clock, action.update)
            }
    } else if (action.update != null) {
      const actionUpdate = action.update
      let resolveRef!: (value: unknown) => void
      promises.push(new Promise((resolve) => (resolveRef = resolve)))
      updateRef.current = (state, clock) => {
        resetActionTime(clock)
        const shouldContinue = executeActionUpdates(state, clock, actionUpdate) ?? true
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

function executeActionUpdates<T>(
  state: T,
  clock: ActionClock,
  updates: Action<T>['update'],
): ReturnType<ActionUpdate<T>> {
  if (!Array.isArray(updates)) {
    return updates?.(state, clock)
  }
  let shouldContinue = undefined
  for (const update of updates) {
    const newShouldContinue = update(state, clock)
    if (shouldContinue == null || (shouldContinue === false && newShouldContinue === true)) {
      shouldContinue = newShouldContinue
    }
  }
  return shouldContinue
}

export * from './helpers/index.js'
export * from './ease.js'
export * from './transition.js'
