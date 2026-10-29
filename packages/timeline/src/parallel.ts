import { TimelineRunner } from './runner.js'
import { Singleton } from './singleton.js'
import type { ActionStatus, NonReuseableTimeline, ReusableTimeline, Timeline, TimelineClock } from './index.js'

/**
 * runs its timelines side by side; how it ends and what it returns depends on its type:
 * - `"race"` ends once the first timeline ends, cancels the others and returns what the first one returned
 * - `"all"` ends once every timeline has ended and returns `false` if one of them returned `false`, otherwise `true`
 */
export class ParallelTimeline<T = unknown> extends Singleton<T, unknown> {
  private runners?: Map<ReusableTimeline<T, unknown>, TimelineRunner<T>>

  constructor(
    private readonly type: 'all' | 'race',
    private readonly timelines = new Set<ReusableTimeline<T, unknown>>(),
  ) {
    super()
  }

  attach(timeline: ReusableTimeline<T, unknown>): void {
    if (this.timelines.has(timeline)) {
      throw new Error(`cannot attach a timeline that is already attached`)
    }
    this.timelines.add(timeline)
    this.runners?.set(timeline, new TimelineRunner(timeline))
  }

  unattach(timeline: ReusableTimeline<T, unknown>): void {
    this.timelines.delete(timeline)
    this.runners?.get(timeline)?.cancel()
    this.runners?.delete(timeline)
  }

  protected *unsafeRun(): NonReuseableTimeline<T, unknown> {
    const runners = new Map<ReusableTimeline<T, unknown>, TimelineRunner<T>>()
    this.runners = runners
    try {
      for (const timeline of this.timelines) {
        runners.set(timeline, new TimelineRunner(timeline))
      }
      yield (state, clock) => this.step(runners, state, clock)
      return this.outcome(runners)
    } finally {
      this.runners = undefined
      for (const runner of runners.values()) {
        runner.cancel()
      }
    }
  }

  private step(
    runners: Map<ReusableTimeline<T, unknown>, TimelineRunner<T>>,
    state: T,
    clock: TimelineClock,
  ): ActionStatus {
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

  private isDone(runners: Map<ReusableTimeline<T, unknown>, TimelineRunner<T>>): boolean {
    //an empty container idles until a timeline is attached
    if (runners.size === 0) {
      return false
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

  private outcome(runners: Map<ReusableTimeline<T, unknown>, TimelineRunner<T>>): unknown {
    const branches = Array.from(runners.values())
    if (this.type === 'all') {
      return branches.every((runner) => runner.outcome !== false)
    }
    //the race was decided by the first timeline in order that ended (see isDone)
    const winner = branches.find((runner) => runner.finished)
    if (winner == null) {
      throw new Error(`a race can only end once one of its timelines has ended`)
    }
    return winner.outcome
  }
}

/**
 * what `parallel` accepts: timelines and booleans, which are skipped (e.g. `condition && timeline`)
 */
export type ParallelTimelines<T = never> = Array<Timeline<T, unknown> | boolean>

/**
 * what a `"race"` over `B` returns: what one of its timelines returns,
 * or `undefined` if it may have no timeline to run (it is empty, spread from an array, or has boolean entries)
 */
export type RaceOutcome<B extends ParallelTimelines> =
  | (B[number] extends infer E ? (E extends Timeline<never, infer R> ? R : never) : never)
  | (B extends [Timeline<never, unknown>, ...ParallelTimelines] ? never : undefined)

/**
 * function for executing multiple timelines in parallel
 * each timeline receives every frame in the given order; `false` and `true` entries are skipped
 * without any timelines (e.g. all entries are `false`), it returns immediately
 *
 * in a `"race"`, the first timeline that finishes ends the race before later timelines receive the frame;
 * put conditions (e.g. `action({ until })`) first so that a met condition hands the frame on to what follows the race
 *
 * the outcome (what `yield* parallel(...)` returns):
 * - `"race"` returns what the timeline that ended first returned (never what a cancelled timeline returns); `undefined` without timelines
 * - `"all"` returns `false` if any timeline returned `false`, otherwise `true` (a timeline returning nothing counts as succeeded); `true` without timelines
 *
 * the race's outcome is typed from its timelines; with an explicit state type argument (`parallel<State>('race', ...)`) it is `unknown`
 * @param type when to stop all timelines - either wait for `"all"` or cancel all timelines once the first timeline is done via `"race"`
 */
export function parallel<T, B extends ParallelTimelines<T> = ParallelTimelines<T>>(
  type: 'race',
  ...timelines: B & ParallelTimelines<T>
): NonReuseableTimeline<T, RaceOutcome<B>>
export function parallel<T>(type: 'all', ...timelines: ParallelTimelines<T>): NonReuseableTimeline<T, boolean>
export function parallel<T>(type: 'all' | 'race', ...timelines: ParallelTimelines<T>): NonReuseableTimeline<T, unknown>
export function* parallel<T>(
  type: 'all' | 'race',
  ...timelines: ParallelTimelines<T>
): NonReuseableTimeline<T, unknown> {
  const reusables = timelines
    .filter((timeline) => typeof timeline != 'boolean')
    .map((timeline): ReusableTimeline<T, unknown> => (typeof timeline === 'function' ? timeline : () => timeline))
  if (reusables.length === 0) {
    return type === 'all' ? true : undefined
  }
  return yield* new ParallelTimeline<T>(type, new Set(reusables)).run()
}
