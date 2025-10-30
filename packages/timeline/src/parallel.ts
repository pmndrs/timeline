import { action } from './action.js'
import {
  type Timeline,
  type NonReuseableTimeline,
  runTimelineAsync,
  TimelineYieldActionUpdate,
  ReusableTimeline,
  abortSignalToPromise,
} from './index.js'
import { Singleton } from './singleton.js'

export class ParallelTimeline<T> extends Singleton<T> {
  private runningState?: {
    internalAbortController: AbortController
    timelines: Map<
      ReusableTimeline<T>,
      {
        ref: {
          current?: TimelineYieldActionUpdate<T>
        }
        finished: boolean
        abortController: AbortController
      }
    >
  }

  constructor(
    private readonly type: 'all' | 'race',
    private readonly timelines = new Set<ReusableTimeline<T>>(),
  ) {
    super()
  }

  attach(timeline: ReusableTimeline<T>): void {
    this.timelines.add(timeline)
    this.startTimeline(timeline)
  }

  unattach(timeline: ReusableTimeline<T>): void {
    this.timelines.delete(timeline)
    if (this.runningState == null) {
      return
    }
    this.runningState.timelines.get(timeline)?.abortController.abort()
  }

  private async startTimeline(timeline: ReusableTimeline<T>) {
    const runningState = this.runningState
    if (runningState == null) {
      return
    }
    const timelineRunningState: (typeof runningState)['timelines'] extends Map<any, infer K> ? K : never = {
      ref: {},
      finished: false,
      abortController: new AbortController(),
    }

    runningState.timelines.set(timeline, timelineRunningState)
    await runTimelineAsync(
      timeline(),
      timelineRunningState.ref,
      AbortSignal.any([runningState.internalAbortController.signal, timelineRunningState.abortController.signal]),
    )
    timelineRunningState.finished = true
    if (this.type === 'all' && !runningState.timelines.values().every((value) => value.finished)) {
      return
    }
    runningState.internalAbortController.abort()
  }

  protected async *unsafeRun(): NonReuseableTimeline<T> {
    const runningState: typeof this.runningState = (this.runningState = {
      internalAbortController: new AbortController(),
      timelines: new Map(),
    })
    for (const timeline of this.timelines) {
      this.startTimeline(timeline)
    }
    yield* action({
      init: () => () => {
        this.runningState = undefined
        runningState.internalAbortController.abort()
      },
      update: (state, clock) => {
        for (const { ref } of runningState.timelines.values()) {
          ref.current?.(state, clock)
        }
      },
      until: abortSignalToPromise(runningState.internalAbortController.signal),
    })
  }
}

/**
 * function for executing multiple timelines in parallel
 * @param type when to stop all timelines - either wait for `"all"` or cancel all timelines once the first timeline is done via `"race"`
 */
export async function* parallel<T>(
  type: 'all' | 'race',
  ...timelines: Array<Timeline<T> | boolean>
): NonReuseableTimeline<T> {
  const parallel = new ParallelTimeline(
    type,
    new Set(
      timelines
        .filter((timeline) => typeof timeline != 'boolean')
        .map((timeline) => (typeof timeline === 'function' ? timeline : () => timeline)),
    ),
  )
  yield* parallel.run()
}
