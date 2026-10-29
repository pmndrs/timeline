import { TimelineFallbacks } from './misc.js'
import { TimelineRunner } from './runner.js'
import type { NonReuseableTimeline, ReusableTimeline } from './index.js'

type Run<T> = { runner: TimelineRunner<T>; restart: boolean }

export class ReplacableTimeline<T = unknown> {
  private readonly runs = new Set<Run<T>>()

  private currentTimeline: ReusableTimeline<T, unknown>
  private isAttached = false

  constructor(private readonly fallback: ReusableTimeline<T, unknown> = TimelineFallbacks.Idle) {
    this.currentTimeline = fallback
  }

  attach(timeline: ReusableTimeline<T, unknown>): void {
    if (this.isAttached) {
      throw new Error(`cannot attach to a timeline that already has another timeline attached`)
    }
    this.isAttached = true
    this.currentTimeline = timeline
    this.restart()
  }

  unattach(): void {
    if (!this.isAttached) {
      return
    }
    this.isAttached = false
    this.currentTimeline = this.fallback
    this.restart()
  }

  private restart() {
    for (const run of this.runs) {
      run.restart = true
      run.runner.cancel()
    }
  }

  /**
   * ends all current runs
   */
  cancel() {
    for (const run of this.runs) {
      run.restart = false
      run.runner.cancel()
    }
    //a later restart must not revive cancelled runs
    this.runs.clear()
  }

  *run(): NonReuseableTimeline<T> {
    let restart: boolean
    do {
      const run: Run<T> = { runner: new TimelineRunner(this.currentTimeline), restart: false }
      this.runs.add(run)
      try {
        yield* run.runner.run()
      } finally {
        this.runs.delete(run)
      }
      restart = run.restart
    } while (restart)
  }
}
