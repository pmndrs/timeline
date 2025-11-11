import { action, NonReuseableTimeline, ReusableTimeline, timePassed } from './index.js'
import { Singleton } from './singleton.js'

export class SequentialTimeline<T = unknown, C extends {} = {}> extends Singleton<T, C> {
  constructor(private readonly timelines: Array<ReusableTimeline<T, C> | undefined> = []) {
    super()
  }

  attach(index: number, timeline: ReusableTimeline<T, C>): void {
    if (this.timelines[index] != null) {
      throw new Error(`there's already an timeline set at index '${index}'`)
    }
    this.timelines[index] = timeline
  }

  unattach(index: number): void {
    this.timelines[index] = undefined
  }

  protected async *unsafeRun(): NonReuseableTimeline<T, C> {
    let ranAnyTimeline = false
    for (const timeline of this.timelines) {
      if (timeline == null) {
        continue
      }
      ranAnyTimeline = true
      yield* timeline()
    }
    if (!ranAnyTimeline) {
      yield* action({ until: timePassed(50, 'milliseconds') })
    }
  }
}
