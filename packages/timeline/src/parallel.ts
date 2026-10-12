import { TimelineRunner } from './runner.js'
import { Singleton } from './singleton.js'
import type { ActionStatus, NonReuseableTimeline, ReusableTimeline, Timeline, TimelineClock } from './index.js'

export class ParallelTimeline<T = unknown> extends Singleton<T> {
  private runners?: Map<ReusableTimeline<T>, TimelineRunner<T>>

  constructor(
    private readonly type: 'all' | 'race',
    private readonly timelines = new Set<ReusableTimeline<T>>(),
  ) {
    super()
  }

  attach(timeline: ReusableTimeline<T>): void {
    this.timelines.add(timeline)
    this.runners?.set(timeline, new TimelineRunner(timeline))
  }

  unattach(timeline: ReusableTimeline<T>): void {
    this.timelines.delete(timeline)
    this.runners?.get(timeline)?.cancel()
    this.runners?.delete(timeline)
  }

  protected *unsafeRun(): NonReuseableTimeline<T> {
    const runners = new Map<ReusableTimeline<T>, TimelineRunner<T>>()
    this.runners = runners
    try {
      for (const timeline of this.timelines) {
        runners.set(timeline, new TimelineRunner(timeline))
      }
      yield (state, clock) => this.step(runners, state, clock)
    } finally {
      this.runners = undefined
      for (const runner of runners.values()) {
        runner.cancel()
      }
    }
  }

  private step(runners: Map<ReusableTimeline<T>, TimelineRunner<T>>, state: T, clock: TimelineClock): ActionStatus {
    if (this.isDone(runners)) {
      return 'skipped'
    }
    let usedFrame = false
    for (const runner of runners.values()) {
      if (runner.finished) {
        continue
      }
      if (runner.step(state, clock) != 'skipped') {
        usedFrame = true
      }
      if (this.type === 'race' && runner.finished) {
        break
      }
    }
    if (!this.isDone(runners)) {
      return 'running'
    }
    return usedFrame ? 'finished' : 'skipped'
  }

  private isDone(runners: Map<ReusableTimeline<T>, TimelineRunner<T>>): boolean {
    const finished = [...runners.values()].map((runner) => runner.finished)
    return this.type === 'race' ? finished.includes(true) : !finished.includes(false)
  }
}

/**
 * function for executing multiple timelines in parallel
 * each timeline receives every frame; `false` entries are skipped
 * @param type when to stop all timelines - either wait for `"all"` or cancel all timelines once the first timeline is done via `"race"`
 */
export function* parallel<T>(
  type: 'all' | 'race',
  ...timelines: Array<Timeline<T> | boolean>
): NonReuseableTimeline<T> {
  const reusables = timelines
    .filter((timeline) => typeof timeline != 'boolean')
    .map((timeline): ReusableTimeline<T> => (typeof timeline === 'function' ? timeline : () => timeline))
  yield* new ParallelTimeline<T>(type, new Set(reusables)).run()
}
