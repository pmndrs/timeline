import type { ActionStatus, NonReuseableTimeline, Timeline, TimelineClock, TimelineYield, Update } from './index.js'

/**
 * how many actions may finish without using the frame within one step before the runner assumes an endless loop
 */
const MaxSkippedActions = 10_000

/**
 * steps a timeline frame by frame
 * the timeline starts running (until its first action) when the runner is created
 */
export class TimelineRunner<T = unknown> {
  private readonly generator: NonReuseableTimeline<T, unknown>
  private action?: TimelineYield<T>
  private busy = false
  private cancelRequested = false

  constructor(timeline: Timeline<T, unknown>) {
    this.generator = typeof timeline === 'function' ? timeline() : timeline
    this.resume(() => this.generator.next())
  }

  get finished(): boolean {
    return this.action == null
  }

  /**
   * delivers one frame to the current action
   * when the action finishes, the timeline continues to its next action within this call;
   * the next action receives this frame only if the finished action skipped it
   */
  step(state: T, clock: TimelineClock): ActionStatus {
    for (let skipped = 0; this.action != null; skipped++) {
      if (skipped === MaxSkippedActions) {
        throw new Error(
          `more than ${MaxSkippedActions} actions finished within a single frame without using it. The timeline most likely loops over actions that are already done, e.g. "while (true) yield* action({ until: () => true })".`,
        )
      }
      const status = this.stepAction(this.action, state, clock)
      if (status === 'running') {
        return 'running'
      }
      if (status === 'finished') {
        return this.action == null ? 'finished' : 'running'
      }
    }
    return 'skipped'
  }

  /**
   * stops the timeline, running its `finally` blocks and action cleanups
   * if the timeline is executing right now, it is stopped as soon as it reaches its next action
   */
  cancel(): void {
    if (this.busy) {
      this.cancelRequested = true
      return
    }
    if (this.action == null) {
      return
    }
    this.action = undefined
    this.busy = true
    try {
      if (!this.generator.return(undefined).done) {
        throw new Error(`timelines must not yield inside a finally block that runs on cancellation`)
      }
    } finally {
      this.busy = false
    }
  }

  /**
   * a timeline that runs this runner until it finishes and cancels it when the timeline is cancelled
   */
  *run(): NonReuseableTimeline<T> {
    try {
      yield (state, clock) => this.step(state, clock)
    } finally {
      this.cancel()
    }
  }

  private stepAction(action: TimelineYield<T>, state: T, clock: TimelineClock): ActionStatus {
    let status: ActionStatus
    try {
      status = action(state, clock)
    } catch (error) {
      //surface the error at the yield so the timeline can catch it; otherwise it propagates out of the update
      this.resume(() => this.generator.throw(error))
      return 'finished'
    }
    //the action might have been cancelled while it was stepped
    if (status !== 'running' && this.action === action) {
      this.resume(() => this.generator.next())
    }
    return status
  }

  private resume(advance: () => IteratorResult<TimelineYield<T>, unknown>): void {
    this.action = undefined
    this.busy = true
    try {
      const result = advance()
      if (!result.done) {
        this.action = result.value
      }
    } finally {
      this.busy = false
    }
    if (this.cancelRequested) {
      this.cancelRequested = false
      this.cancel()
    }
  }
}

/**
 * function for starting a timeline
 * the timeline advances only inside the returned update function; errors thrown by the timeline propagate out of it
 * @returns an update function which must be executed every frame with the delta time in seconds
 */
export function runTimeline<T>(timeline: Timeline<T, unknown>, abortSignal?: AbortSignal): Update<T> {
  if (abortSignal?.aborted) {
    return () => {}
  }
  const runner = new TimelineRunner(timeline)
  abortSignal?.addEventListener('abort', () => runner.cancel(), { once: true })
  const clock: TimelineClock = { delta: 0, prevDelta: 0 }
  return (state, delta) => {
    clock.delta = delta
    runner.step(state, clock)
    clock.prevDelta = delta
  }
}

/**
 * @deprecated use `runTimeline` instead
 */
export const start = runTimeline
