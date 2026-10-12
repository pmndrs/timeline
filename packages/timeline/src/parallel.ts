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
    if (this.timelines.has(timeline)) {
      throw new Error(`cannot attach a timeline that is already attached`)
    }
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
    if (runners.size === 0) {
      return true
    }
    for (const runner of runners.values()) {
      if (this.type === 'race' && runner.finished) {
        return true
      }
      if (this.type === 'all' && !runner.finished) {
        return false
      }
    }
    return this.type === 'all'
  }
}

/**
 * function for executing multiple timelines in parallel
 * each timeline receives every frame in the given order; `false` entries are skipped
 * without any timelines, the parallel is done immediately and passes the frame on
 *
 * in a `"race"`, the first timeline that finishes ends the race before later timelines receive the frame;
 * put conditions (e.g. `action({ until })`) first so that a met condition hands the frame on to what follows the race
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
