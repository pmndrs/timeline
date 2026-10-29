import { TimelineFallbacks } from './misc.js'
import { TimelineRunner } from './runner.js'
import type { ActionUpdate } from './action.js'
import type { NonReuseableTimeline, ReusableTimeline } from './index.js'

export type SwitchTimelineCase<T> = {
  /**
   * leaving the condition empty means this is the default case
   */
  condition?: SwitchTimelineCaseCondition<T>
  timeline: ReusableTimeline<T, unknown>
}
export type SwitchTimelineCaseCondition<T> = (...params: Parameters<ActionUpdate<T>>) => boolean

export class SwitchTimeline<T = unknown> {
  constructor(private readonly cases: Array<SwitchTimelineCase<T> | undefined> = []) {}

  attach(index: number, condition: SwitchTimelineCaseCondition<T>, timeline: ReusableTimeline<T, unknown>) {
    if (index < 0) {
      throw new Error(`the switch case index must be a positive number including 0`)
    }
    if (this.cases[index] != null) {
      throw new Error(`cannot attach to case "${index}" that already has another timeline attached`)
    }
    this.cases[index] = { condition, timeline }
  }

  unattach(index: number) {
    //no need to cancel the case timeline because the next frame will switch away from it
    delete this.cases[index]
  }

  /**
   * every frame, runs the first case whose condition holds, restarting when the case changes
   * finishes when the running case's timeline finishes
   */
  *run(): NonReuseableTimeline<T> {
    let runner: TimelineRunner<T> | undefined
    let caseIndex = -1
    let actionTime = 0
    const memo = {}
    try {
      yield (state, clock) => {
        actionTime += clock.delta
        const newCaseIndex = this.cases.findIndex(
          (case_) => case_ != null && (case_.condition == null || case_.condition(state, clock, actionTime, memo)),
        )
        if (runner == null || newCaseIndex != caseIndex) {
          caseIndex = newCaseIndex
          runner?.cancel()
          runner = new TimelineRunner(this.cases[caseIndex]?.timeline ?? TimelineFallbacks.Idle)
        }
        return runner.step(state, clock)
      }
    } finally {
      runner?.cancel()
    }
  }
}

export function* switch_<T>(cases: Array<SwitchTimelineCase<T>>): NonReuseableTimeline<T> {
  yield* new SwitchTimeline<T>(cases).run()
}
