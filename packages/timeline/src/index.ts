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
  readonly prevDelta: number | undefined
}

export type Timeline<T, R = any> = ReusableTimeline<T, R> | NonReuseableTimeline<T, R>

export type ReusableTimeline<T, R = any> = () => NonReuseableTimeline<T, R>

export type NonReuseableTimeline<T, R = any> = AsyncIterable<Action<T>, R>

/**
 * core function for yielding an action used via `yield* action({...})`
 * allows to run this action `until` a certain event and execute an `update` function until the action is finished
 */
export async function* action<T>(a: Action<T>): NonReuseableTimeline<T> {
  a.init?.()
  yield a
}

/**
 * function for executing multiple timelines in parallel
 * @param type when to stop all timelines - either wait for `"all"` or cancel all timelines once the first timeline is done via `"race"`
 */
export async function* parallel<T>(
  type: 'all' | 'race',
  ...timelines: Array<Timeline<T> | boolean>
): NonReuseableTimeline<T> {
  const internalAbortController = new AbortController()
  const refs: Array<UpdateRef<T>> = timelines.map(() => ({}))
  const promises = timelines
    .filter((timeline) => typeof timeline != 'boolean')
    .map((timeline, i) =>
      startAsync(typeof timeline === 'function' ? timeline() : timeline, refs[i]!, internalAbortController.signal),
    )
  const subClocks: Array<{ -readonly [Key in keyof ActionClock]: ActionClock[Key] }> = []
  yield {
    update(state, clock) {
      const length = timelines.length
      for (let i = 0; i < length; i++) {
        let subClock = subClocks[i]
        if (subClock == null) {
          subClocks[i] = subClock = { actionTime: 0, delta: 0, prevDelta: 0, timelineTime: 0 }
        }
        subClock.delta = clock.delta
        subClock.prevDelta = clock.prevDelta
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

/**
 * function for starting a timeline
 * @returns an update function which must be executed every frame with the delta time in seconds
 */
export function start<T>(timeline: Timeline<T>, abortSignal?: AbortSignal, onError = console.error): Update<T> {
  const ref: UpdateRef<T> = {}
  startAsync(timeline, ref, abortSignal).catch(onError)
  const clock = { delta: undefined as any, prevDelta: undefined, timelineTime: 0, actionTime: 0 } satisfies ActionClock
  return (state, delta) => {
    clock.actionTime += delta
    clock.timelineTime += delta
    clock.prevDelta = clock.delta
    clock.delta = Math.max(1e-6, Math.min(delta, 1 / 30))
    ref.current?.(state, clock)
  }
}

/**
 * a timeline wrapper that allows to make any timeline externally cancelable via an abort signal
 */
export async function* abortable<T>(timeline: Timeline<T>, abortSignal?: AbortSignal) {
  const ref: UpdateRef<T> = {}
  const abortController = new AbortController()
  const timelineFinishedOrAborted = startAsync(
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

async function startAsync<T>(timeline: Timeline<T>, updateRef: UpdateRef<T>, abortSignal?: AbortSignal) {
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
export * from './misc.js'
export * from './graph.js'
export * from './look-at.js'
export * from './offset.js'
export * from './ease.js'
export * from './transition.js'
